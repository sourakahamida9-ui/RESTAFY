-- =====================================================
-- 096 - Credit restaurant on payment confirmation (INSERT + UPDATE)
-- =====================================================
-- Fix:
-- - Le trigger du script 093 ne se déclenche que sur UPDATE.
-- - Or la RPC confirm_payment fait souvent un INSERT payments (premier passage).
-- - Résultat: available_balance / total_earnings restent à 0.
--
-- Cette migration rend le crédit idempotent et compatible INSERT/UPDATE.
-- =====================================================

BEGIN;

-- 1) Ajoute une colonne pour empêcher le double-crédit
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS restaurant_credited_at TIMESTAMPTZ;

-- 2) Fonction idempotente : crédite une seule fois, au moment où status devient "confirmed"
CREATE OR REPLACE FUNCTION public.credit_restaurant_on_payment_confirm()
RETURNS TRIGGER AS $$
DECLARE
  fees NUMERIC;
  net_amount NUMERIC;
BEGIN
  -- Déjà crédité → no-op
  IF NEW.restaurant_credited_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Ne traiter que les paiements confirmés
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Montant net (même formule que script 093)
  fees := (COALESCE(NEW.amount, 0) * 0.01) + 100 + 150;
  net_amount := COALESCE(NEW.amount, 0) - fees;
  IF net_amount < 0 THEN
    net_amount := 0;
  END IF;

  -- Crédit restaurant
  UPDATE restaurants
  SET
    available_balance = available_balance + net_amount,
    total_earnings = total_earnings + net_amount,
    updated_at = NOW()
  WHERE id = NEW.restaurant_id;

  -- Historique transaction
  INSERT INTO restaurant_transactions (
    restaurant_id,
    type,
    amount,
    currency,
    reference,
    description,
    related_order_id,
    metadata
  ) VALUES (
    NEW.restaurant_id,
    'payment_received',
    net_amount,
    COALESCE(NEW.currency, 'XOF'),
    NEW.transaction_ref,
    'Paiement reçu (confirmation)',
    NEW.order_id,
    jsonb_build_object(
      'gross_amount', NEW.amount,
      'fees', fees,
      'payment_id', NEW.id
    )
  );

  -- Marquer la ligne payments comme créditée (évite les doubles crédits)
  NEW.restaurant_credited_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Triggers: INSERT + UPDATE
DROP TRIGGER IF EXISTS trg_credit_restaurant_after_payment ON payments;
DROP TRIGGER IF EXISTS trg_credit_restaurant_after_payment_insert ON payments;
DROP TRIGGER IF EXISTS trg_credit_restaurant_after_payment_update ON payments;

CREATE TRIGGER trg_credit_restaurant_after_payment_insert
  BEFORE INSERT ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION public.credit_restaurant_on_payment_confirm();

CREATE TRIGGER trg_credit_restaurant_after_payment_update
  BEFORE UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.restaurant_credited_at IS DISTINCT FROM NEW.restaurant_credited_at))
  EXECUTE FUNCTION public.credit_restaurant_on_payment_confirm();

COMMIT;

SELECT 'Script 096 completed - restaurant credited on payments INSERT/UPDATE' AS status;

