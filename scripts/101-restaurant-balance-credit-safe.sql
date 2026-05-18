-- ============================================================
-- Script 101 - Safe restaurant balance crediting
-- ============================================================
-- 1. Adds UNIQUE constraint on restaurant_transactions(restaurant_id, reference)
--    to prevent double-credits from concurrent webhook + polling paths.
-- 2. Creates credit_restaurant_balance_safe RPC for atomic balance crediting.
-- ============================================================

BEGIN;

-- ── 1. Unique constraint for idempotent balance crediting ──────────────────
-- Prevents the race condition where both webhook and polling handlers
-- pass the application-level idempotency check (SELECT ... WHERE reference = $ref)
-- before either inserts a transaction record.
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_transactions_idempotent
  ON restaurant_transactions(restaurant_id, reference)
  WHERE reference IS NOT NULL;

-- ── 2. Atomic RPC for crediting restaurant balance ─────────────────────────
-- Called from api/webhooks/index.ts and api/payments/initiate.ts.
-- Uses INSERT ... ON CONFLICT to guarantee idempotency at the DB level.
CREATE OR REPLACE FUNCTION public.credit_restaurant_balance_safe(
  p_restaurant_id UUID,
  p_net_amount NUMERIC,
  p_gross_amount NUMERIC,
  p_fees NUMERIC,
  p_reference TEXT,
  p_currency TEXT DEFAULT 'XOF'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atomic insert: ON CONFLICT does nothing (idempotent)
  INSERT INTO restaurant_transactions (
    restaurant_id, type, amount, currency, reference, description, metadata
  ) VALUES (
    p_restaurant_id,
    'payment_received',
    p_net_amount,
    p_currency,
    p_reference,
    'Paiement reçu — brut: ' || p_gross_amount || ', frais: ' || ROUND(p_fees),
    jsonb_build_object('gross_amount', p_gross_amount, 'fees', p_fees, 'source', 'rpc_credit')
  )
  ON CONFLICT (restaurant_id, reference) WHERE reference IS NOT NULL
  DO NOTHING;

  -- Only credit balance if the INSERT succeeded (row was actually inserted)
  IF FOUND THEN
    UPDATE restaurants
    SET
      available_balance = available_balance + p_net_amount,
      total_earnings = total_earnings + p_net_amount,
      updated_at = NOW()
    WHERE id = p_restaurant_id;
  END IF;
END;
$$;

-- Only service_role can execute (used by serverless functions)
REVOKE ALL ON FUNCTION public.credit_restaurant_balance_safe(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_restaurant_balance_safe(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO service_role;

COMMIT;

SELECT 'Script 101 completed - Safe restaurant balance crediting ready' AS status;
