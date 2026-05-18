-- ============================================================================
-- RESTAFY 075 — Corrige « function gen_salt(unknown) does not exist » sur Supabase
-- ============================================================================
-- ℹ️ Ce fichier ne touche PAS aux RLS « orders » / chargement dashboard.
--    Pour « Échec du chargement des commandes », exécuter plutôt :
--    scripts/075-fix-orders-rls-roles.sql
-- ============================================================================
-- Cause : pgcrypto est installé dans le schéma « extensions », alors que
-- owner_set_staff_kiosk_pin et staff_kiosk_login utilisaient SET search_path = public
-- uniquement : crypt / gen_salt / gen_random_bytes n’étaient pas résolus.
--
-- À exécuter une fois dans l’éditeur SQL Supabase (après 072, même si 074 déjà appliqué).
-- Les fichiers 072 et 074 du dépôt incluent désormais ce correctif pour les nouvelles installs.
-- ============================================================================

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
