-- Problème 3: Ajouter les RLS policies sur ticket_purchases

-- Vérifier que RLS est activée
ALTER TABLE ticket_purchases ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes si elles existent
DROP POLICY IF EXISTS "tp_customer_insert" ON ticket_purchases;
DROP POLICY IF EXISTS "tp_customer_read" ON ticket_purchases;
DROP POLICY IF EXISTS "tp_restaurant_read" ON ticket_purchases;
DROP POLICY IF EXISTS "tp_restaurant_update" ON ticket_purchases;

-- Client peut acheter (insérer) ses propres billets
CREATE POLICY "tp_customer_insert"
  ON ticket_purchases FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Client peut voir ses propres billets
CREATE POLICY "tp_customer_read"
  ON ticket_purchases FOR SELECT
  USING (auth.uid() = customer_id);

-- Restaurant peut voir les billets de ses événements
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

-- Restaurant peut mettre à jour (valider un billet scanné)
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

-- SuperAdmin peut tout voir et modifier
CREATE POLICY "tp_superadmin_all"
  ON ticket_purchases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

SELECT 'RLS policies for ticket_purchases created' AS status;
