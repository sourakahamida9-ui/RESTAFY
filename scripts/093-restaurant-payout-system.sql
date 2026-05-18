-- ============================================================
-- Script 093 - Système de retrait pour restaurants
-- ============================================================
-- Description: Ajoute les colonnes et tables pour gérer
--            les retraits automatiques des restaurants
-- ============================================================

BEGIN;

-- ── 1. Ajouter colonnes balance aux restaurants ─────────────────────────────
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS available_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_payout_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS geniuspay_merchant_id TEXT,
ADD COLUMN IF NOT EXISTS geniuspay_public_key TEXT,
ADD COLUMN IF NOT EXISTS geniuspay_secret_key TEXT,
ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'manual' 
  CHECK (payout_method IN ('manual', 'auto_daily', 'auto_weekly', 'auto_monthly', 'direct_geniuspay')),
ADD COLUMN IF NOT EXISTS payout_destination JSONB,
ADD COLUMN IF NOT EXISTS last_payout_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS min_payout_amount DECIMAL(10,2) DEFAULT 5000,
ADD COLUMN IF NOT EXISTS payout_schedule JSONB DEFAULT '{"enabled": false}';

-- ── 2. Créer table des retraits ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'XOF',
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  payout_method TEXT NOT NULL,
  destination_info JSONB,
  geniuspay_payout_id TEXT,
  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  provider_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_payouts_restaurant ON restaurant_payouts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON restaurant_payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_geniuspay_id ON restaurant_payouts(geniuspay_merchant_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_balance ON restaurants(available_balance) 
  WHERE available_balance > 0;

-- ── 3. Créer table d'historique des transactions ───────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  type TEXT NOT NULL 
    CHECK (type IN ('payment_received', 'payout_sent', 'payout_failed', 'refund', 'fee', 'adjustment')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'XOF',
  reference TEXT,
  description TEXT,
  related_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  related_payout_id UUID REFERENCES restaurant_payouts(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_restaurant ON restaurant_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON restaurant_transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON restaurant_transactions(created_at);

-- ── 4. Trigger pour mettre à jour updated_at ──────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_restaurant_payouts_updated_at ON restaurant_payouts;
CREATE TRIGGER update_restaurant_payouts_updated_at
  BEFORE UPDATE ON restaurant_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── 5. Fonction pour créditer un restaurant après paiement ─────────────────
CREATE OR REPLACE FUNCTION credit_restaurant_after_payment()
RETURNS TRIGGER AS $$
DECLARE
  restaurant_record RECORD;
  net_amount DECIMAL(12,2);
  fees DECIMAL(12,2);
BEGIN
  -- Ne traiter que les paiements confirmés
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Calculer le montant net (moins frais estimés: 1% + 100 + 150)
    fees := (NEW.amount * 0.01) + 100 + 150;
    net_amount := NEW.amount - fees;
    
    -- Récupérer le restaurant
    SELECT id, available_balance, total_earnings 
    INTO restaurant_record
    FROM restaurants 
    WHERE id = NEW.restaurant_id;
    
    IF FOUND THEN
      -- Mettre à jour le solde
      UPDATE restaurants
      SET 
        available_balance = available_balance + net_amount,
        total_earnings = total_earnings + net_amount,
        updated_at = NOW()
      WHERE id = NEW.restaurant_id;
      
      -- Créer une transaction d'historique
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
        NEW.currency,
        NEW.transaction_ref,
        'Paiement reçu via ' || COALESCE(NEW.method, 'inconnu'),
        NEW.order_id,
        jsonb_build_object(
          'gross_amount', NEW.amount,
          'fees', fees,
          'payment_id', NEW.id
        )
      );
      
      -- Log
      RAISE NOTICE 'Restaurant % credited with % XOF (fees: %)', 
        NEW.restaurant_id, net_amount, fees;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger sur la table payments
DROP TRIGGER IF EXISTS trg_credit_restaurant_after_payment ON payments;
CREATE TRIGGER trg_credit_restaurant_after_payment
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status != 'confirmed')
  EXECUTE FUNCTION credit_restaurant_after_payment();

-- ── 6. Fonction pour demander un retrait automatique ───────────────────────
CREATE OR REPLACE FUNCTION request_automatic_payout(p_restaurant_id UUID)
RETURNS JSONB AS $$
DECLARE
  restaurant_record RECORD;
  min_amount DECIMAL(10,2) := 5000; -- Minimum 5000 FCFA
BEGIN
  -- Récupérer le restaurant avec solde
  SELECT 
    id, 
    available_balance, 
    pending_payout_amount,
    payout_method,
    payout_destination,
    min_payout_amount,
    geniuspay_merchant_id
  INTO restaurant_record
  FROM restaurants
  WHERE id = p_restaurant_id;
  
  -- Vérifier si le restaurant existe
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Restaurant not found'
    );
  END IF;
  
  -- Utiliser le min configuré ou le défaut
  IF restaurant_record.min_payout_amount IS NOT NULL THEN
    min_amount := restaurant_record.min_payout_amount;
  END IF;
  
  -- Vérifier si assez de fonds
  IF restaurant_record.available_balance < min_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'available', restaurant_record.available_balance,
      'minimum_required', min_amount
    );
  END IF;
  
  -- Vérifier si une méthode de retrait est configurée
  IF restaurant_record.payout_destination IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No payout destination configured'
    );
  END IF;
  
  -- Créer la demande de retrait
  INSERT INTO restaurant_payouts (
    restaurant_id,
    amount,
    currency,
    status,
    payout_method,
    destination_info
  ) VALUES (
    p_restaurant_id,
    restaurant_record.available_balance,
    'XOF',
    'pending',
    COALESCE(restaurant_record.payout_method, 'manual'),
    restaurant_record.payout_destination
  );
  
  -- Mettre à jour les soldes
  UPDATE restaurants
  SET 
    pending_payout_amount = pending_payout_amount + restaurant_record.available_balance,
    available_balance = 0,
    updated_at = NOW()
  WHERE id = p_restaurant_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Payout request created',
    'amount', restaurant_record.available_balance,
    'restaurant_id', p_restaurant_id
  );
END;
$$ LANGUAGE plpgsql;

-- ── 7. Vue pour le dashboard restaurant ────────────────────────────────────
CREATE OR REPLACE VIEW restaurant_financial_summary AS
SELECT 
  r.id as restaurant_id,
  r.name as restaurant_name,
  r.available_balance,
  r.pending_payout_amount,
  r.total_earnings,
  r.last_payout_at,
  r.min_payout_amount,
  r.payout_method,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'completed') as total_payouts,
  COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'payment_received' AND t.created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as earnings_this_month,
  COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'payment_received' AND t.created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND t.created_at < DATE_TRUNC('month', CURRENT_DATE)), 0) as earnings_last_month
FROM restaurants r
LEFT JOIN restaurant_payouts p ON r.id = p.restaurant_id
LEFT JOIN restaurant_transactions t ON r.id = t.restaurant_id
GROUP BY r.id, r.name, r.available_balance, r.pending_payout_amount, r.total_earnings, r.last_payout_at, r.min_payout_amount, r.payout_method;

-- ── 8. RLS Policies ────────────────────────────────────────────────────────
ALTER TABLE restaurant_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_transactions ENABLE ROW LEVEL SECURITY;

-- Restaurant peut voir ses propres retraits
CREATE POLICY "restaurant_payouts_own" ON restaurant_payouts
  FOR SELECT USING (restaurant_id IN (
    SELECT restaurant_id FROM profiles WHERE id = auth.uid()
  ));

-- Restaurant peut voir ses propres transactions
CREATE POLICY "restaurant_transactions_own" ON restaurant_transactions
  FOR SELECT USING (restaurant_id IN (
    SELECT restaurant_id FROM profiles WHERE id = auth.uid()
  ));

-- SuperAdmin peut tout voir/gérer
CREATE POLICY "superadmin_payouts_all" ON restaurant_payouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "superadmin_transactions_all" ON restaurant_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

COMMIT;

SELECT 'Script 093 completed - Restaurant payout system ready' AS status;
