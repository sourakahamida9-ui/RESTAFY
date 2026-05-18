-- ============================================================================
-- Script 098 — Helper SQL : annuler des scans de test sur les billets
-- ============================================================================
-- Contexte : pendant les tests d'un événement, l'organisateur scanne ses
-- propres billets depuis le Dashboard restaurateur OU depuis scan.restafy.
-- Ces scans marquent `ticket_purchases.is_used = TRUE` + `qr_scanned_at`.
-- Quand le vrai jour arrive, le portier obtient "Billet déjà utilisé" sur ces
-- billets de test (et c'est légitime côté DB, pas un faux positif).
--
-- Ce script fournit deux fonctions SECURITY DEFINER pour annuler ces scans :
--
--   1. reset_event_test_scans(p_event_id UUID)
--      Annule TOUS les scans de l'événement. À utiliser AVANT le jour J.
--
--   2. reset_ticket_scan(p_ticket_id UUID)
--      Annule un seul billet (par son id). Utile si un agent s'est trompé.
--
-- Les deux fonctions vérifient que l'appelant est bien owner/manager/super_admin
-- du restaurant qui possède l'événement avant d'autoriser le reset.
--
-- IDEMPOTENT : safe à rejouer (CREATE OR REPLACE).
-- Si tu as déjà appliqué une version précédente de ce script avec le typo
-- 'superadmin' (sans underscore) ou sans la garde v_role IS NULL, rejoue
-- simplement ce script — il remplacera les fonctions par les versions
-- corrigées.
-- ============================================================================

BEGIN;

-- ── reset_event_test_scans ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reset_event_test_scans(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    UUID := auth.uid();
  v_role      TEXT;
  v_resto_id  UUID;
  v_my_resto  UUID;
  v_count     INT;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT role, restaurant_id INTO v_role, v_my_resto
  FROM profiles WHERE id = v_caller;

  SELECT restaurant_id INTO v_resto_id
  FROM events WHERE id = p_event_id;

  IF v_resto_id IS NULL THEN
    RETURN jsonb_build_object('error', 'event_not_found');
  END IF;

  -- IMPORTANT: trois pièges PG à gérer ici (cf. Devin Review PR #59).
  --
  -- 1) Le bon enum est 'super_admin' (avec underscore), pas 'superadmin'.
  --    Cf. scripts/01-create-schema.sql:16 et scripts/036-fix-superadmin-role-typo.sql.
  --    Sans underscore, le check NOT IN évalue à TRUE pour tous les vrais
  --    super_admin et les bloque.
  --
  -- 2) Three-valued logic: profiles.restaurant_id est nullable, donc v_my_resto
  --    peut être NULL. NULL <> X renvoie NULL, et IF NULL n'entre pas dans le
  --    THEN. Sans le `v_my_resto IS NULL` explicite, un compte avec
  --    role='restaurant_owner' mais sans restaurant_id passerait l'autorisation.
  --
  -- 3) v_role peut aussi être NULL (utilisateur authentifié sans ligne profiles).
  --    Pareil, NULL NOT IN (…) = NULL, IF NULL ne saute pas le THEN. On garde
  --    une garde explicite avant le check OR.
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF v_role NOT IN ('super_admin', 'restaurant_owner', 'manager')
     OR (v_role <> 'super_admin' AND (v_my_resto IS NULL OR v_my_resto <> v_resto_id)) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  UPDATE ticket_purchases
     SET is_used          = FALSE,
         qr_scanned_at    = NULL,
         qr_scanned_by    = NULL,
         qr_scan_location = NULL
   WHERE event_id = p_event_id
     AND (is_used = TRUE OR qr_scanned_at IS NOT NULL);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',  TRUE,
    'event_id', p_event_id,
    'reset',    v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reset_event_test_scans(UUID) TO authenticated;
COMMENT ON FUNCTION reset_event_test_scans(UUID) IS
  'Réinitialise tous les scans (is_used=false, qr_scanned_at=null) des billets d''un événement. Owner/manager du restaurant uniquement.';

-- ── reset_ticket_scan ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reset_ticket_scan(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    UUID := auth.uid();
  v_role      TEXT;
  v_resto_id  UUID;
  v_my_resto  UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT role, restaurant_id INTO v_role, v_my_resto
  FROM profiles WHERE id = v_caller;

  SELECT e.restaurant_id INTO v_resto_id
  FROM ticket_purchases tp
  JOIN events e ON e.id = tp.event_id
  WHERE tp.id = p_ticket_id;

  IF v_resto_id IS NULL THEN
    RETURN jsonb_build_object('error', 'ticket_not_found');
  END IF;

  -- Mêmes gardes que dans reset_event_test_scans (cf. commentaire là-bas) :
  -- enum 'super_admin' avec underscore + v_role IS NULL + v_my_resto IS NULL.
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF v_role NOT IN ('super_admin', 'restaurant_owner', 'manager')
     OR (v_role <> 'super_admin' AND (v_my_resto IS NULL OR v_my_resto <> v_resto_id)) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  UPDATE ticket_purchases
     SET is_used          = FALSE,
         qr_scanned_at    = NULL,
         qr_scanned_by    = NULL,
         qr_scan_location = NULL
   WHERE id = p_ticket_id;

  RETURN jsonb_build_object('success', TRUE, 'ticket_id', p_ticket_id);
END;
$$;

GRANT EXECUTE ON FUNCTION reset_ticket_scan(UUID) TO authenticated;
COMMENT ON FUNCTION reset_ticket_scan(UUID) IS
  'Annule le scan d''un billet (is_used=false). Owner/manager du restaurant uniquement.';

COMMIT;

-- ── USAGE ───────────────────────────────────────────────────────────────────
-- Annuler tous les scans de test d'un événement (avant le jour J) :
--   SELECT reset_event_test_scans('00000000-0000-0000-0000-000000000000');
--
-- Annuler un seul scan :
--   SELECT reset_ticket_scan('11111111-1111-1111-1111-111111111111');
-- ============================================================================
