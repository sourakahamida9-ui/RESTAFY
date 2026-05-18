-- ============================================================================
-- RESTAFY 072 — Accès équipe : lien unique + PIN + sessions kiosk (RPC)
-- À exécuter sur Supabase après 054 (get_my_role / get_my_restaurant_id).
-- ============================================================================
-- Colonnes restaurant_staff : access_token (UUID secret dans l’URL), pin_hash (bcrypt).
-- Sessions : staff_kiosk_sessions (jeton opaque, TTL 12h).
-- Toutes les lectures / mises à jour commandes passent par des fonctions SECURITY DEFINER
-- pour que le personnel sans compte Supabase puisse travailler avec la clé anon.
-- ============================================================================

-- Sur Supabase, pgcrypto est souvent dans le schéma « extensions » : les fonctions
-- ci-dessous utilisent search_path public, extensions pour résoudre crypt / gen_salt / gen_random_bytes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Colonnes équipe (membres manuels : profile_id nullable si pas encore migré)
ALTER TABLE public.restaurant_staff
  ADD COLUMN IF NOT EXISTS access_token UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

DO $$
BEGIN
  ALTER TABLE public.restaurant_staff ALTER COLUMN profile_id DROP NOT NULL;
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN others THEN NULL;
END $$;

UPDATE public.restaurant_staff
SET access_token = gen_random_uuid()
WHERE access_token IS NULL;

ALTER TABLE public.restaurant_staff
  ALTER COLUMN access_token SET DEFAULT gen_random_uuid();

DO $$
BEGIN
  ALTER TABLE public.restaurant_staff ALTER COLUMN access_token SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Table des sessions kiosk
CREATE TABLE IF NOT EXISTS public.staff_kiosk_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.restaurant_staff(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_kiosk_sessions_expires ON public.staff_kiosk_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_staff_kiosk_sessions_staff ON public.staff_kiosk_sessions (staff_id);

ALTER TABLE public.staff_kiosk_sessions ENABLE ROW LEVEL SECURITY;

-- Qui peut gérer les invitations (proprio, manager profil, ou chef/manager fiche équipe liée au profil)
CREATE OR REPLACE FUNCTION public.kiosk_restaurant_can_manage_invites(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND get_my_restaurant_id() = p_restaurant_id
    AND (
      get_my_role() IN ('restaurant_owner', 'manager', 'restaurant')
      OR EXISTS (
        SELECT 1
        FROM public.restaurant_staff rs
        WHERE rs.restaurant_id = p_restaurant_id
          AND rs.profile_id = auth.uid()
          AND rs.is_active = TRUE
          AND rs.role::TEXT IN ('chef', 'manager')
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_restaurant_can_manage_invites(UUID) TO authenticated;

-- Définir / changer le PIN (bcrypt)
CREATE OR REPLACE FUNCTION public.owner_set_staff_kiosk_pin(p_staff_id UUID, p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rid UUID;
  clean TEXT;
BEGIN
  SELECT restaurant_id INTO rid FROM public.restaurant_staff WHERE id = p_staff_id;
  IF rid IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'staff_not_found');
  END IF;

  IF NOT kiosk_restaurant_can_manage_invites(rid) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'forbidden');
  END IF;

  clean := trim(p_pin);
  IF clean IS NULL OR length(clean) < 4 OR length(clean) > 8 OR clean !~ '^[0-9]+$' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pin_invalid');
  END IF;

  UPDATE public.restaurant_staff
  SET
    pin_hash = crypt(clean, gen_salt('bf')),
    access_token = COALESCE(access_token, gen_random_uuid())
  WHERE id = p_staff_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'update_failed',
      'detail', 'Aucune ligne mise à jour (membre introuvable ou accès refusé par la base).'
    );
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'db_error',
      'detail', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_set_staff_kiosk_pin(UUID, TEXT) TO authenticated;

-- Lien + méta (pas d’exposition systématique du token dans les SELECT équipe)
CREATE OR REPLACE FUNCTION public.owner_get_staff_kiosk_invite(p_staff_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid UUID;
  tok UUID;
  h TEXT;
  rname TEXT;
BEGIN
  SELECT rs.restaurant_id, rs.access_token, rs.pin_hash
  INTO rid, tok, h
  FROM public.restaurant_staff rs
  WHERE rs.id = p_staff_id;

  IF rid IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'staff_not_found');
  END IF;

  IF NOT kiosk_restaurant_can_manage_invites(rid) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'forbidden');
  END IF;

  SELECT r.name INTO rname FROM public.restaurants r WHERE r.id = rid LIMIT 1;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'access_token', tok,
    'has_pin', (h IS NOT NULL AND length(h) > 0),
    'restaurant_name', rname
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_staff_kiosk_invite(UUID) TO authenticated;

-- Régénérer le lien (invalide les sessions)
CREATE OR REPLACE FUNCTION public.owner_regenerate_staff_access_token(p_staff_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid UUID;
  new_t UUID;
BEGIN
  SELECT restaurant_id INTO rid FROM public.restaurant_staff WHERE id = p_staff_id;
  IF rid IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'staff_not_found');
  END IF;

  IF NOT kiosk_restaurant_can_manage_invites(rid) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'forbidden');
  END IF;

  new_t := gen_random_uuid();

  UPDATE public.restaurant_staff SET access_token = new_t WHERE id = p_staff_id;
  DELETE FROM public.staff_kiosk_sessions WHERE staff_id = p_staff_id;

  RETURN jsonb_build_object('ok', TRUE, 'access_token', new_t);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_regenerate_staff_access_token(UUID) TO authenticated;

-- Résolution session (interne aux autres RPC)
CREATE OR REPLACE FUNCTION public._staff_kiosk_resolve_session(p_session_token TEXT)
RETURNS TABLE (
  staff_id UUID,
  restaurant_id UUID,
  team_role TEXT,
  display_name TEXT,
  can_cancel_order BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rs.id,
    rs.restaurant_id,
    rs.role::TEXT,
    COALESCE(rs.full_name, p.full_name, '')::TEXT,
    (rs.role::TEXT IN ('manager', 'chef')) AS can_cancel_order
  FROM public.staff_kiosk_sessions s
  JOIN public.restaurant_staff rs ON rs.id = s.staff_id
  LEFT JOIN public.profiles p ON p.id = rs.profile_id
  WHERE s.token = p_session_token
    AND s.expires_at > now()
    AND rs.is_active = TRUE;
END;
$$;

-- Connexion : access_token (UUID) + PIN → session_token
CREATE OR REPLACE FUNCTION public.staff_kiosk_login(p_access_token UUID, p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rs RECORD;
  sess_token TEXT;
  rname TEXT;
  clean TEXT;
BEGIN
  clean := trim(p_pin);

  SELECT * INTO rs
  FROM public.restaurant_staff
  WHERE access_token = p_access_token AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_token');
  END IF;

  IF rs.pin_hash IS NULL OR length(rs.pin_hash) = 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pin_not_set');
  END IF;

  IF clean IS NULL OR length(clean) < 4 OR crypt(clean, rs.pin_hash) <> rs.pin_hash THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_pin');
  END IF;

  sess_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.staff_kiosk_sessions (staff_id, token, expires_at)
  VALUES (rs.id, sess_token, now() + interval '12 hours');

  SELECT r.name INTO rname FROM public.restaurants r WHERE r.id = rs.restaurant_id LIMIT 1;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'session_token', sess_token,
    'staff', jsonb_build_object(
      'id', rs.id,
      'restaurant_id', rs.restaurant_id,
      'role', rs.role::TEXT,
      'display_name', COALESCE(rs.full_name, (SELECT full_name FROM profiles WHERE id = rs.profile_id LIMIT 1), '')
    ),
    'restaurant', jsonb_build_object('name', rname),
    'capabilities', jsonb_build_object(
      'can_update_order_status', TRUE,
      'can_cancel_order', (rs.role::TEXT IN ('manager', 'chef')),
      'kiosk_scope', 'orders_only'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_kiosk_login(UUID, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_kiosk_logout(p_session_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.staff_kiosk_sessions WHERE token = p_session_token;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_kiosk_logout(TEXT) TO anon, authenticated;

-- Liste commandes + lignes (JSON)
CREATE OR REPLACE FUNCTION public.staff_kiosk_list_orders_json(p_session_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
BEGIN
  SELECT s.restaurant_id INTO v_restaurant_id
  FROM public._staff_kiosk_resolve_session(p_session_token) s
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'session_invalid');
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'orders', COALESCE(
      (
        SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.sort_ts DESC)
        FROM (
          SELECT
            o.id,
            o.order_number,
            o.status::TEXT AS status,
            o.type::TEXT AS type,
            o.subtotal,
            o.delivery_fee,
            o.discount,
            o.total_amount,
            o.delivery_address,
            o.notes,
            o.created_at,
            o.updated_at,
            pr.full_name AS customer_name,
            pr.phone AS customer_phone,
            o.created_at AS sort_ts,
            (
              SELECT COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'id', oi.id,
                    'item_name', oi.item_name,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'subtotal', oi.subtotal,
                    'notes', oi.notes
                  )
                  ORDER BY oi.id
                ),
                '[]'::jsonb
              )
              FROM public.order_items oi
              WHERE oi.order_id = o.id
            ) AS items
          FROM public.orders o
          LEFT JOIN public.profiles pr ON pr.id = o.customer_id
          WHERE o.restaurant_id = v_restaurant_id
          ORDER BY o.created_at DESC
          LIMIT 120
        ) x
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_kiosk_list_orders_json(TEXT) TO anon, authenticated;

-- Mise à jour statut commande
CREATE OR REPLACE FUNCTION public.staff_kiosk_update_order_status(
  p_session_token TEXT,
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_can_cancel BOOLEAN;
  v_team_role TEXT;
  st TEXT;
BEGIN
  SELECT s.restaurant_id, s.can_cancel_order, s.team_role
  INTO v_restaurant_id, v_can_cancel, v_team_role
  FROM public._staff_kiosk_resolve_session(p_session_token) s
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'session_invalid');
  END IF;

  st := lower(trim(p_new_status));

  IF st = 'cancelled' AND NOT v_can_cancel THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'forbidden_cancel');
  END IF;

  UPDATE public.orders o
  SET
    status = st::order_status,
    updated_at = now()
  WHERE o.id = p_order_id
    AND o.restaurant_id = v_restaurant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'order_not_found');
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_status');
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_kiosk_update_order_status(TEXT, UUID, TEXT) TO anon, authenticated;

-- Statut intermédiaire utilisé par le dashboard (ignorer si déjà présent)
DO $$
BEGIN
  ALTER TYPE order_status ADD VALUE 'accepted';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
