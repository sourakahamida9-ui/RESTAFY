-- =====================================================
-- 088 - Webhook Logs & Payments Tables + Security Fixes
-- =====================================================
-- Cree les tables necessaires pour GeniusPay webhooks
-- et corrige les politiques RLS vulnerables.

-- =====================================================
-- 1. Table webhook_logs pour audit des webhooks
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'geniuspay',
  event_type TEXT,
  payload JSONB,
  signature_ok BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON webhook_logs(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);

-- RLS: Seul le service_role peut lire/ecrire (via webhook handler)
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_webhook_logs" ON webhook_logs;
CREATE POLICY "service_role_only_webhook_logs" ON webhook_logs
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- =====================================================
-- 2. Table payments pour enregistrer les paiements GeniusPay
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_ref TEXT UNIQUE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  ticket_purchase_id UUID REFERENCES ticket_purchases(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'XOF',
  method TEXT DEFAULT 'geniuspay',
  provider TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled', 'expired', 'refunded')),
  customer_name TEXT,
  customer_phone TEXT,
  provider_response JSONB,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherches
CREATE INDEX IF NOT EXISTS idx_payments_transaction_ref ON payments(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_restaurant_id ON payments(restaurant_id);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Service role peut tout faire (pour webhook)
DROP POLICY IF EXISTS "service_role_payments" ON payments;
-- Note: service_role bypass RLS, pas besoin de policy explicite

-- Les restaurants peuvent voir leurs paiements
DROP POLICY IF EXISTS "restaurant_can_view_own_payments" ON payments;
CREATE POLICY "restaurant_can_view_own_payments" ON payments
  FOR SELECT
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Les clients peuvent voir leurs paiements via orders
DROP POLICY IF EXISTS "customer_can_view_own_payments" ON payments;
CREATE POLICY "customer_can_view_own_payments" ON payments
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE customer_id = auth.uid()
    )
    OR
    ticket_purchase_id IN (
      SELECT id FROM ticket_purchases WHERE customer_id = auth.uid()
    )
  );

-- =====================================================
-- 3. CORRECTION CRITIQUE: Fix RLS restaurant_invites
-- L'ancienne policy exposait tous les tokens a tout le monde
-- =====================================================

-- Supprimer l'ancienne policy vulnerable
DROP POLICY IF EXISTS "Public can check invite tokens" ON restaurant_invites;

-- Nouvelle policy: on ne peut lire un token que si on le connait deja
-- (protection contre enumeration)
-- Note: La verification du token se fait via service_role dans l'API
DROP POLICY IF EXISTS "Authenticated can validate own token" ON restaurant_invites;

-- Pour la validation de token, utiliser une fonction RPC securisee
-- au lieu d'exposer la table en SELECT public

-- Admins uniquement pour lecture complete
DROP POLICY IF EXISTS "Admins can read all invites" ON restaurant_invites;
CREATE POLICY "Admins can read all invites" ON restaurant_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- CORRECTION: Utiliser auth_role() au lieu de email hardcode pour les policies admin
DROP POLICY IF EXISTS "Only admins can create invites" ON restaurant_invites;
CREATE POLICY "Only admins can create invites" ON restaurant_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Only admins can update invites" ON restaurant_invites;
CREATE POLICY "Only admins can update invites" ON restaurant_invites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Only admins can delete invites" ON restaurant_invites;
CREATE POLICY "Only admins can delete invites" ON restaurant_invites
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- =====================================================
-- 4. Fonction RPC securisee pour valider un token d'invitation
-- =====================================================
CREATE OR REPLACE FUNCTION validate_restaurant_invite(invite_token TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  invite_id UUID,
  is_used BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true AS valid,
    ri.id AS invite_id,
    ri.is_used
  FROM restaurant_invites ri
  WHERE ri.token = invite_token
  LIMIT 1;
  
  -- Si pas de resultat, retourner false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::BOOLEAN;
  END IF;
END;
$$;

-- =====================================================
-- 5. Ajouter colonne payment_ref a ticket_purchases si manquante
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_purchases' AND column_name = 'payment_ref'
  ) THEN
    ALTER TABLE ticket_purchases ADD COLUMN payment_ref TEXT;
  END IF;
END $$;

-- =====================================================
-- 6. Ajouter colonnes manquantes a orders si necessaire
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_ref'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_ref TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- =====================================================
-- TERMINE
-- =====================================================
