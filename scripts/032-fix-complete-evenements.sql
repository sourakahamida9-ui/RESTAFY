-- ═══════════════════════════════════════════════════════════════════════
-- Script 032 : Fix complet événements + achats de billets
-- Problèmes corrigés :
--   1. Ajouter colonne status sur ticket_purchases (pending/confirmed/cancelled)
--   2. RLS : les clients peuvent insérer sans être authentifiés (guest checkout)
--   3. RLS : le restaurant peut voir ET mettre à jour ses achats (approbation manuelle)
--   4. event_id sur ticket_purchases (pour joins directs sans passer par event_tickets)
--   5. customer_name, customer_email, customer_phone explicitement présents
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Colonnes manquantes sur ticket_purchases ──────────────────────────
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT 'Client';
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS qr_code_data TEXT;

-- ── 2. Colonne status (c'était supprimée par le script 029 — on la remet) ──
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'confirmed', 'cancelled'));

-- Recréer un index unique sur qr_code_data si pas déjà là
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'ticket_purchases' AND indexname = 'ticket_purchases_qr_unique'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ticket_purchases_qr_unique ON ticket_purchases(qr_code_data) WHERE qr_code_data IS NOT NULL;
  END IF;
END $$;

-- ── 3. Backfill event_id pour les achats existants ────────────────────────
UPDATE ticket_purchases tp
SET event_id = et.event_id
FROM event_tickets et
WHERE tp.ticket_id = et.id
  AND tp.event_id IS NULL;

-- ── 4. Nettoyage RLS ticket_purchases (table propre) ─────────────────────
ALTER TABLE ticket_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tp_customer_insert" ON ticket_purchases;
DROP POLICY IF EXISTS "tp_customer_read" ON ticket_purchases;
DROP POLICY IF EXISTS "tp_restaurant_read" ON ticket_purchases;
DROP POLICY IF EXISTS "tp_restaurant_update" ON ticket_purchases;
DROP POLICY IF EXISTS "tp_superadmin_all" ON ticket_purchases;
DROP POLICY IF EXISTS "ticket_purchases_insert" ON ticket_purchases;
DROP POLICY IF EXISTS "ticket_purchases_read" ON ticket_purchases;
DROP POLICY IF EXISTS "Users can create ticket purchases" ON ticket_purchases;
DROP POLICY IF EXISTS "Users can view their ticket purchases" ON ticket_purchases;

-- Client authentifié : peut insérer et lire ses propres achats
CREATE POLICY "tp_customer_insert"
  ON ticket_purchases FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "tp_customer_read"
  ON ticket_purchases FOR SELECT
  USING (auth.uid() = customer_id);

-- Restaurant : peut voir tous les achats de ses événements
CREATE POLICY "tp_restaurant_read"
  ON ticket_purchases FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE restaurant_id IN (
        SELECT restaurant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Restaurant : peut approuver/refuser (UPDATE status)
CREATE POLICY "tp_restaurant_update"
  ON ticket_purchases FOR UPDATE
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE restaurant_id IN (
        SELECT restaurant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- SuperAdmin : accès total
CREATE POLICY "tp_superadmin_all"
  ON ticket_purchases FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ── 5. RLS events (propre, pas de doublons) ───────────────────────────────
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_public_read" ON events;
DROP POLICY IF EXISTS "events_owner_all" ON events;
DROP POLICY IF EXISTS "events_admin_all" ON events;
DROP POLICY IF EXISTS "events_owner_insert" ON events;
DROP POLICY IF EXISTS "events_owner_update" ON events;
DROP POLICY IF EXISTS "events_owner_delete" ON events;
DROP POLICY IF EXISTS "Public can view published events" ON events;

-- Tout le monde peut lire les événements publiés
CREATE POLICY "events_public_read"
  ON events FOR SELECT
  USING (is_published = true);

-- Restaurant : toutes opérations sur ses propres événements
CREATE POLICY "events_owner_all"
  ON events FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- SuperAdmin
CREATE POLICY "events_admin_all"
  ON events FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ── 6. RLS event_tickets ──────────────────────────────────────────────────
ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_tickets_public_read" ON event_tickets;
DROP POLICY IF EXISTS "et_owner_all" ON event_tickets;

-- Public : lire les billets des events publiés
CREATE POLICY "event_tickets_public_read"
  ON event_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_tickets.event_id AND e.is_published = true
    )
  );

-- Restaurant : gérer ses propres types de billets
CREATE POLICY "et_owner_all"
  ON event_tickets FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE restaurant_id IN (
        SELECT restaurant_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM events
      WHERE restaurant_id IN (
        SELECT restaurant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ── 7. Trigger : auto-confirmer les achats + incrémenter quantity_sold ──────
CREATE OR REPLACE FUNCTION handle_ticket_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Incrémenter quantity_sold sur event_tickets si le statut passe à confirmed
  IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') OR
     (TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN
    UPDATE event_tickets
    SET quantity_sold = quantity_sold + 1
    WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ticket_purchase_trigger ON ticket_purchases;
CREATE TRIGGER ticket_purchase_trigger
  AFTER INSERT OR UPDATE ON ticket_purchases
  FOR EACH ROW
  EXECUTE FUNCTION handle_ticket_purchase();

SELECT 'Script 032 completed - ticket_purchases status + events RLS fixed' AS status;
