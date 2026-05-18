-- ============================================================================
-- Script 096 — Validation atomique des billets (event ticket scan at gate)
-- ============================================================================
-- What this adds:
--   1. Missing scanner audit columns (qr_scanned_by, qr_scan_location).
--   2. Index on qr_code_data and ticket_number for <5 ms gate lookups.
--   3. RPC validate_ticket_atomic(): single-call, race-safe validate + mark-used
--      used by POST /api/tickets/validate from scan.restafy.shop.
--   4. RPC list_event_tickets_for_scanner(): preload all confirmed tickets of
--      an event into the offline PWA (IndexedDB) at agent login.
--
-- Why atomic RPC: prevents the "both gates scan the same QR at the same time,
-- both say valid" race. A single SQL UPDATE...WHERE qr_scanned_at IS NULL
-- guarantees only ONE scanner wins.
--
-- IDEMPOTENT: safe to run multiple times.
-- ============================================================================

BEGIN;

-- ── 1. Audit columns ────────────────────────────────────────────────────────
ALTER TABLE ticket_purchases
  ADD COLUMN IF NOT EXISTS qr_scanned_by    TEXT,
  ADD COLUMN IF NOT EXISTS qr_scan_location TEXT;

COMMENT ON COLUMN ticket_purchases.qr_scanned_by    IS 'Identifiant de l''agent (team_scan_tokens.member_name) ayant scanné ce billet.';
COMMENT ON COLUMN ticket_purchases.qr_scan_location IS 'Lieu libre (ex: "Entrée principale"). Défini par l''agent à l''auth.';

-- ── 2. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tp_qr_code_data
  ON ticket_purchases(qr_code_data)
  WHERE qr_code_data IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tp_ticket_number
  ON ticket_purchases(ticket_number)
  WHERE ticket_number IS NOT NULL;

-- ── 3. Atomic validation RPC ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_ticket_atomic(
  p_lookup        TEXT,             -- qr_code_data OR ticket_number (format libre du QR)
  p_event_id      UUID    DEFAULT NULL,
  p_scanned_by    TEXT    DEFAULT NULL,
  p_scan_location TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row         ticket_purchases%ROWTYPE;
  v_event_name  TEXT;
  v_event_start TIMESTAMPTZ;
  v_ticket_name TEXT;
BEGIN
  IF p_lookup IS NULL OR length(trim(p_lookup)) = 0 THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'reason', 'missing_code'
    );
  END IF;

  -- Lookup by qr_code_data first (opaque UUID), then by ticket_number.
  -- Same query + LIMIT 1 so a prefix match on one column doesn't leak into the other.
  SELECT tp.* INTO v_row
  FROM ticket_purchases tp
  WHERE (tp.qr_code_data = p_lookup OR tp.ticket_number = p_lookup)
    AND (p_event_id IS NULL OR tp.event_id = p_event_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'reason', 'not_found'
    );
  END IF;

  -- Scope enforcement: if caller passed p_event_id and ticket is for another event.
  IF p_event_id IS NOT NULL AND v_row.event_id <> p_event_id THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'reason', 'wrong_event'
    );
  END IF;

  -- Not confirmed yet = not paid = cannot enter.
  IF v_row.status NOT IN ('confirmed', 'paid', 'completed') THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'reason', 'unpaid',
      'ticket', jsonb_build_object(
        'id',             v_row.id,
        'ticket_number',  v_row.ticket_number,
        'customer_name',  v_row.customer_name,
        'payment_status', v_row.status
      )
    );
  END IF;

  -- Expiry: event already finished (best-effort).
  -- Schema (scripts/01-create-schema.sql): events.title, events.start_time.
  SELECT e.title, e.start_time INTO v_event_name, v_event_start
  FROM events e
  WHERE e.id = v_row.event_id;

  IF v_event_start IS NOT NULL AND v_event_start < (NOW() - INTERVAL '24 hours') THEN
    RETURN jsonb_build_object(
      'status', 'expired',
      'reason', 'event_passed',
      'ticket', jsonb_build_object(
        'id',             v_row.id,
        'ticket_number',  v_row.ticket_number,
        'customer_name',  v_row.customer_name,
        'event_name',     v_event_name,
        'event_start_at', v_event_start
      )
    );
  END IF;

  -- Already used?
  IF COALESCE(v_row.is_used, false) OR v_row.qr_scanned_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'used',
      'reason', 'already_scanned',
      'ticket', jsonb_build_object(
        'id',             v_row.id,
        'ticket_number',  v_row.ticket_number,
        'customer_name',  v_row.customer_name,
        'event_name',     v_event_name,
        'scanned_at',     v_row.qr_scanned_at,
        'scanned_by',     v_row.qr_scanned_by
      )
    );
  END IF;

  -- Atomic mark-used. The WHERE clause prevents a race between 2 gates
  -- scanning the same QR concurrently — only the first UPDATE wins.
  UPDATE ticket_purchases tp
     SET is_used          = TRUE,
         qr_scanned_at    = NOW(),
         qr_scanned_by    = p_scanned_by,
         qr_scan_location = p_scan_location
   WHERE tp.id = v_row.id
     AND COALESCE(tp.is_used, false) = FALSE
     AND tp.qr_scanned_at IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    -- Race lost: another scanner got it between our SELECT and UPDATE.
    SELECT tp.* INTO v_row FROM ticket_purchases tp WHERE tp.id = v_row.id;
    RETURN jsonb_build_object(
      'status', 'used',
      'reason', 'race_lost',
      'ticket', jsonb_build_object(
        'id',             v_row.id,
        'ticket_number',  v_row.ticket_number,
        'customer_name',  v_row.customer_name,
        'event_name',     v_event_name,
        'scanned_at',     v_row.qr_scanned_at,
        'scanned_by',     v_row.qr_scanned_by
      )
    );
  END IF;

  -- Ticket type name (optional for display).
  SELECT et.name INTO v_ticket_name
  FROM event_tickets et
  WHERE et.id = v_row.ticket_id;

  RETURN jsonb_build_object(
    'status', 'valid',
    'reason', 'ok',
    'ticket', jsonb_build_object(
      'id',             v_row.id,
      'ticket_number',  v_row.ticket_number,
      'customer_name',  v_row.customer_name,
      'event_id',       v_row.event_id,
      'event_name',     v_event_name,
      'ticket_type',    COALESCE(v_ticket_name, 'Standard'),
      'scanned_at',     v_row.qr_scanned_at,
      'scanned_by',     v_row.qr_scanned_by,
      'scan_location',  v_row.qr_scan_location
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION validate_ticket_atomic(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_ticket_atomic(TEXT, UUID, TEXT, TEXT)
  TO service_role, authenticated;

COMMENT ON FUNCTION validate_ticket_atomic IS
  'Vérifie et marque un billet événement comme utilisé, atomiquement. Retour JSONB {status, reason, ticket?}.';

-- ── 4. Preload RPC (agent login → IndexedDB) ────────────────────────────────
CREATE OR REPLACE FUNCTION list_event_tickets_for_scanner(
  p_event_id UUID
)
RETURNS TABLE (
  id             UUID,
  qr_code_data   TEXT,
  ticket_number  VARCHAR,
  customer_name  TEXT,
  is_used        BOOLEAN,
  qr_scanned_at  TIMESTAMPTZ,
  event_id       UUID,
  ticket_type_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tp.id,
    tp.qr_code_data,
    tp.ticket_number,
    tp.customer_name,
    COALESCE(tp.is_used, false) AS is_used,
    tp.qr_scanned_at,
    tp.event_id,
    tp.ticket_id AS ticket_type_id
  FROM ticket_purchases tp
  WHERE tp.event_id = p_event_id
    AND tp.status IN ('confirmed', 'paid', 'completed')
  ORDER BY tp.created_at DESC
  LIMIT 10000;
$$;

REVOKE ALL ON FUNCTION list_event_tickets_for_scanner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_event_tickets_for_scanner(UUID)
  TO service_role, authenticated;

COMMENT ON FUNCTION list_event_tickets_for_scanner IS
  'Liste les billets confirmés d''un événement pour preload offline (IndexedDB agent scanner).';

COMMIT;

-- ── Sanity check (non-breaking) ─────────────────────────────────────────────
SELECT 'Script 096 completed — validate_ticket_atomic + list_event_tickets_for_scanner ready' AS status;
