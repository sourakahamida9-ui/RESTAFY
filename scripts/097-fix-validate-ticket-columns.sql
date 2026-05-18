-- ============================================================================
-- Script 097 — Hotfix: validate_ticket_atomic references wrong event columns
-- ============================================================================
-- Context: script 096 created validate_ticket_atomic() that SELECTs
-- `e.name, e.start_at FROM events` — but the actual schema (scripts/01-create-
-- schema.sql) has `events.title` and `events.start_time`. The RPC therefore
-- throws `column e.name does not exist` (SQLSTATE 42703) for any valid ticket
-- that reaches the expiry check, making ticket validation impossible at the
-- door.
--
-- This migration drops and recreates `validate_ticket_atomic` with the correct
-- column names. Everything else (columns added by 096, indexes, the sibling
-- `list_event_tickets_for_scanner` function, grants) is preserved.
--
-- IDEMPOTENT: safe to run multiple times.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION validate_ticket_atomic(
  p_lookup        TEXT,
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
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'missing_code');
  END IF;

  SELECT tp.* INTO v_row
  FROM ticket_purchases tp
  WHERE (tp.qr_code_data = p_lookup OR tp.ticket_number = p_lookup)
    AND (p_event_id IS NULL OR tp.event_id = p_event_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'not_found');
  END IF;

  IF p_event_id IS NOT NULL AND v_row.event_id <> p_event_id THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'wrong_event');
  END IF;

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

  -- ✅ FIX: schema has events.title + events.start_time (not name/start_at).
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

COMMIT;

-- Sanity: calling the RPC with a bogus code must now return a clean JSON
-- (not raise). Expected: {"status":"invalid","reason":"not_found"}.
SELECT validate_ticket_atomic('__probe__', NULL, 'migration-probe', NULL) AS probe_result;
