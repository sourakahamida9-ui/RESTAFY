-- ═══════════════════════════════════════════════════════════════════════════════
-- RESTAFY 102 — OMS state machine + RPC change_order_status
--
-- À EXÉCUTER UNE SEULE FOIS dans Supabase SQL Editor (idempotent).
--
-- Ce script :
--   1. Crée un trigger BEFORE UPDATE qui REJETTE les transitions de statut
--      invalides sur public.orders (ex : pending → delivered direct = bloqué).
--   2. Ajoute une fonction RPC change_order_status(order_id, new_status, device)
--      SECURITY DEFINER qui est la SEULE voie autorisée pour modifier le statut
--      depuis le dashboard frontend (le trigger reste actif comme garde-fou).
--   3. Enrichit le trigger existant trigger_log_order_event (script 038) pour
--      capturer staff_id et device_type via des session variables que la RPC
--      positionne avant l'UPDATE.
--
-- Transitions autorisées (graphe) :
--
--   pending     → accepted | confirmed | cancelled | payment_failed
--   accepted    → confirmed | preparing | cancelled
--   confirmed   → preparing | cancelled
--   preparing   → ready | cancelled
--   ready       → delivering | delivered
--   delivering  → delivered | cancelled
--
-- États terminaux : delivered, cancelled, payment_failed (aucune transition
-- sortante autorisée — modification = ticket support).
--
-- BYPASS : un super_admin peut forcer une transition en posant
--   SELECT set_config('restafy.bypass_state_machine', 'true', true);
-- avant l'UPDATE (utile pour scripts ops uniquement, à éviter en prod).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Fonction de validation des transitions ────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_valid_order_transition(
  p_from order_status,
  p_to   order_status
) RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Self-transition autorisée (UPDATE qui ne change pas le statut)
  IF p_from = p_to THEN
    RETURN TRUE;
  END IF;

  RETURN (p_from, p_to) IN (
    ('pending'::order_status,    'accepted'::order_status),
    ('pending'::order_status,    'confirmed'::order_status),
    ('pending'::order_status,    'cancelled'::order_status),
    ('pending'::order_status,    'payment_failed'::order_status),
    ('accepted'::order_status,   'confirmed'::order_status),
    ('accepted'::order_status,   'preparing'::order_status),
    ('accepted'::order_status,   'cancelled'::order_status),
    ('confirmed'::order_status,  'preparing'::order_status),
    ('confirmed'::order_status,  'cancelled'::order_status),
    ('preparing'::order_status,  'ready'::order_status),
    ('preparing'::order_status,  'cancelled'::order_status),
    ('ready'::order_status,      'delivering'::order_status),
    ('ready'::order_status,      'delivered'::order_status),
    ('delivering'::order_status, 'delivered'::order_status),
    ('delivering'::order_status, 'cancelled'::order_status)
  );
END;
$$;

COMMENT ON FUNCTION public.is_valid_order_transition(order_status, order_status)
IS 'Returns TRUE if the (from, to) order_status pair is a valid OMS transition.';

-- ─── 2. Trigger BEFORE UPDATE qui rejette les transitions invalides ───────────
CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_bypass TEXT;
BEGIN
  -- Bypass explicite (super-admin scripts ops)
  v_bypass := current_setting('restafy.bypass_state_machine', TRUE);
  IF v_bypass = 'true' THEN
    RETURN NEW;
  END IF;

  -- Rien à valider si le statut ne change pas
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Transition invalide → exception explicite
  IF NOT public.is_valid_order_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> % (order_id=%)',
      OLD.status, NEW.status, NEW.id
      USING ERRCODE = 'check_violation',
            HINT   = 'Use the change_order_status() RPC and follow the OMS state machine.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_order_status_transition ON public.orders;
CREATE TRIGGER trigger_enforce_order_status_transition
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_status_transition();

-- ─── 3. Réécrire trigger_log_order_event pour capturer staff_id + device ──────
-- Ce trigger AFTER UPDATE existait déjà (script 038) et loggue dans order_events.
-- On le ré-écrit pour lire les session vars positionnées par la RPC.
CREATE OR REPLACE FUNCTION public.trigger_log_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prev_event       TIMESTAMP;
  duration_seconds INT;
  v_staff_id       UUID;
  v_device         TEXT;
  v_triggered_by   TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Skip silently if order_events table does not exist yet
    IF to_regclass('public.order_events') IS NULL THEN
      RETURN NEW;
    END IF;

    -- Lire les session vars (positionnées par change_order_status RPC)
    BEGIN
      v_staff_id := NULLIF(current_setting('restafy.staff_id', TRUE), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_staff_id := NULL;
    END;

    v_device := NULLIF(current_setting('restafy.device_type', TRUE), '');
    IF v_device IS NULL OR v_device NOT IN ('mobile', 'desktop', 'pos') THEN
      v_device := NULL;
    END IF;

    -- Inférer triggered_by : staff_id présent → 'staff', sinon 'auto' (webhook/cron)
    v_triggered_by := COALESCE(
      NULLIF(current_setting('restafy.triggered_by', TRUE), ''),
      CASE WHEN v_staff_id IS NOT NULL THEN 'staff' ELSE 'auto' END
    );
    IF v_triggered_by NOT IN ('customer', 'staff', 'auto') THEN
      v_triggered_by := 'auto';
    END IF;

    -- Calculer durée depuis l'événement précédent
    BEGIN
      SELECT created_at INTO prev_event
      FROM public.order_events
      WHERE order_id = NEW.id
      ORDER BY created_at DESC
      LIMIT 1;
    EXCEPTION WHEN undefined_table THEN
      RETURN NEW;
    END;

    IF prev_event IS NOT NULL THEN
      duration_seconds := EXTRACT(EPOCH FROM (NOW() - prev_event))::INT;
    END IF;

    BEGIN
      INSERT INTO public.order_events (
        order_id, restaurant_id, event_type, triggered_by,
        duration_since_previous_event_seconds, staff_id, device_type, created_at
      ) VALUES (
        NEW.id, NEW.restaurant_id, NEW.status::TEXT, v_triggered_by,
        duration_seconds, v_staff_id, v_device, NOW()
      );
    EXCEPTION WHEN undefined_table THEN
      -- order_events table dropped mid-flight — silently skip
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- Le trigger lui-même existait déjà depuis 038 (AFTER UPDATE). On s'assure
-- qu'il est bien en place après notre nouvelle fonction.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_order_status_change'
      AND tgrelid = 'public.orders'::regclass
  ) THEN
    CREATE TRIGGER trigger_order_status_change
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_log_order_event();
  END IF;
END $$;

-- ─── 4. RPC change_order_status (frontend doit passer par ici) ────────────────
CREATE OR REPLACE FUNCTION public.change_order_status(
  p_order_id    UUID,
  p_new_status  TEXT,
  p_device      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_role        TEXT;
  v_staff_role  TEXT;
  v_rid         UUID;
  v_old_status  order_status;
  v_new_status  order_status;
  v_order_rid   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'unauthenticated');
  END IF;

  -- Caster le nouveau statut → erreur explicite si valeur inconnue
  BEGIN
    v_new_status := lower(trim(p_new_status))::order_status;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_status', 'value', p_new_status);
  END;

  -- Récupérer le rôle + restaurant_id du caller
  SELECT p.role::TEXT, p.restaurant_id
  INTO v_role, v_rid
  FROM public.profiles p
  WHERE p.id = v_uid;

  -- Si pas de restaurant_id côté profile, regarder restaurant_staff
  IF v_rid IS NULL THEN
    SELECT rs.restaurant_id, rs.role::TEXT
    INTO v_rid, v_staff_role
    FROM public.restaurant_staff rs
    WHERE rs.user_id = v_uid AND rs.is_active = TRUE
    LIMIT 1;
  END IF;

  IF v_rid IS NULL AND v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'no_restaurant_assignment');
  END IF;

  -- Récupérer la commande + son statut actuel + son restaurant_id
  SELECT o.status, o.restaurant_id
  INTO v_old_status, v_order_rid
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF v_old_status IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'order_not_found');
  END IF;

  -- Autorisation : super_admin OK, sinon le restaurant_id doit matcher
  IF v_role <> 'super_admin' AND v_order_rid <> v_rid THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'forbidden');
  END IF;

  -- Cancel restreint : seuls owner/manager/caissier (pas livreur)
  IF v_new_status = 'cancelled'::order_status THEN
    IF v_role NOT IN ('restaurant_owner', 'manager', 'super_admin')
       AND COALESCE(v_staff_role, '') NOT IN ('manager', 'caissier') THEN
      RETURN jsonb_build_object('ok', FALSE, 'error', 'forbidden_cancel');
    END IF;
  END IF;

  -- Pré-vérifier la transition (le trigger fera la même vérif, mais on
  -- préfère renvoyer un JSON propre plutôt qu'une exception serveur)
  IF NOT public.is_valid_order_transition(v_old_status, v_new_status) THEN
    RETURN jsonb_build_object(
      'ok', FALSE, 'error', 'invalid_transition',
      'from', v_old_status::TEXT, 'to', v_new_status::TEXT
    );
  END IF;

  -- Positionner les session vars pour le trigger AFTER UPDATE (logging)
  PERFORM set_config('restafy.staff_id', v_uid::TEXT, TRUE);
  PERFORM set_config('restafy.device_type', COALESCE(p_device, ''), TRUE);
  PERFORM set_config('restafy.triggered_by', 'staff', TRUE);

  -- Effectuer l'UPDATE (le trigger BEFORE UPDATE re-vérifie la transition)
  UPDATE public.orders
  SET status = v_new_status,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'order_id', p_order_id,
    'from', v_old_status::TEXT,
    'to',   v_new_status::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_order_status(UUID, TEXT, TEXT)
TO authenticated;

COMMENT ON FUNCTION public.change_order_status(UUID, TEXT, TEXT)
IS 'Authoritative RPC for changing order status. Validates transition + role + ownership, then logs via order_events trigger. Frontend MUST use this instead of direct UPDATE.';

-- ─── 5. Sanity checks ──────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Vérifier que les transitions canoniques passent
  IF NOT public.is_valid_order_transition('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Sanity check failed: pending -> confirmed should be valid';
  END IF;
  IF NOT public.is_valid_order_transition('preparing', 'ready') THEN
    RAISE EXCEPTION 'Sanity check failed: preparing -> ready should be valid';
  END IF;
  -- Vérifier qu'une transition invalide est rejetée
  IF public.is_valid_order_transition('pending', 'delivered') THEN
    RAISE EXCEPTION 'Sanity check failed: pending -> delivered should be invalid';
  END IF;
  IF public.is_valid_order_transition('delivered', 'pending') THEN
    RAISE EXCEPTION 'Sanity check failed: delivered -> pending should be invalid';
  END IF;
  RAISE NOTICE 'OMS state machine sanity checks passed.';
END $$;

-- Fin 102 — state machine + RPC OMS
