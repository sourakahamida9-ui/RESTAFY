-- ============================================================
-- Script 038 — Consolidation ticket_purchases + event_tickets
-- ============================================================
-- Auteur : Restafy Dev
-- Description : 
--   - Ajoute les colonnes manquantes sur ticket_purchases
--   - Corrige la fonction generate_ticket_number si absente
--   - Nettoie les policies RLS dupliquées
-- ============================================================

BEGIN;

-- ── 1. Ajouter colonnes manquantes sur ticket_purchases ──────────────────────
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'confirmed', 'cancelled'));

ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(20) UNIQUE;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS confirmation_sent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

-- Forcer un défaut sane sur customer_name si vide
ALTER TABLE ticket_purchases ALTER COLUMN customer_name SET DEFAULT 'Client';

-- ── 2. Fonction + trigger pour auto-générer ticket_number ────────────────────
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'TKT-' || UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_ticket_number ON ticket_purchases;
CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON ticket_purchases
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL)
  EXECUTE FUNCTION generate_ticket_number();

-- Remplir les ticket_number null existants
UPDATE ticket_purchases
SET ticket_number = 'TKT-' || UPPER(SUBSTRING(MD5(id::TEXT) FROM 1 FOR 6))
WHERE ticket_number IS NULL;

-- ── 3. S'assurer que event_tickets a bien les colonnes attendues ─────────────
ALTER TABLE event_tickets ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Standard';
ALTER TABLE event_tickets ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE event_tickets ADD COLUMN IF NOT EXISTS quantity_available INTEGER NOT NULL DEFAULT 100;
ALTER TABLE event_tickets ADD COLUMN IF NOT EXISTS quantity_sold INTEGER NOT NULL DEFAULT 0;

-- ── 4. Index de performance ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tp_status       ON ticket_purchases(status);
CREATE INDEX IF NOT EXISTS idx_tp_customer     ON ticket_purchases(customer_id);
CREATE INDEX IF NOT EXISTS idx_tp_event        ON ticket_purchases(event_id);
CREATE INDEX IF NOT EXISTS idx_tp_ticket       ON ticket_purchases(ticket_id);
CREATE INDEX IF NOT EXISTS idx_et_event        ON event_tickets(event_id);

-- ── 5. RLS policies propres (sans doublons) ──────────────────────────────────
ALTER TABLE ticket_purchases ENABLE ROW LEVEL SECURITY;

-- Supprimer toutes les policies existantes pour repartir propre
DROP POLICY IF EXISTS "tp_customer_insert"      ON ticket_purchases;
DROP POLICY IF EXISTS "tp_customer_read"        ON ticket_purchases;
DROP POLICY IF EXISTS "tp_restaurant_read"      ON ticket_purchases;
DROP POLICY IF EXISTS "tp_restaurant_update"    ON ticket_purchases;
DROP POLICY IF EXISTS "tp_superadmin_all"       ON ticket_purchases;
DROP POLICY IF EXISTS "ticket_purchases_insert" ON ticket_purchases;
DROP POLICY IF EXISTS "ticket_purchases_read"   ON ticket_purchases;
DROP POLICY IF EXISTS "Users can create ticket purchases" ON ticket_purchases;

-- Client peut acheter ses propres billets
CREATE POLICY "tp_customer_insert"
  ON ticket_purchases FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Client peut lire ses propres billets
CREATE POLICY "tp_customer_read"
  ON ticket_purchases FOR SELECT
  USING (auth.uid() = customer_id);

-- Restaurant peut lire les billets de ses événements
CREATE POLICY "tp_restaurant_read"
  ON ticket_purchases FOR SELECT
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN profiles p ON p.restaurant_id = e.restaurant_id
      WHERE p.id = auth.uid()
    )
  );

-- Restaurant peut confirmer / annuler (UPDATE status)
CREATE POLICY "tp_restaurant_update"
  ON ticket_purchases FOR UPDATE
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN profiles p ON p.restaurant_id = e.restaurant_id
      WHERE p.id = auth.uid()
    )
  );

-- SuperAdmin : accès total
CREATE POLICY "tp_superadmin_all"
  ON ticket_purchases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

COMMIT;

SELECT 'Script 038 completed — ticket_purchases consolidated' AS status;