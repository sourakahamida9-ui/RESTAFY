-- ════════════════════════════════════════════════════════════════════
-- 025-fix-events-rls-final.sql
-- Nettoyer toutes les policies events conflictuelles et repartir proprement
-- ════════════════════════════════════════════════════════════════════

-- 1. Supprimer TOUTES les policies existantes sur events (nettoyage complet)
DROP POLICY IF EXISTS events_public_read              ON events;
DROP POLICY IF EXISTS events_restaurant_owner         ON events;
DROP POLICY IF EXISTS events_owner_insert             ON events;
DROP POLICY IF EXISTS events_owner_update             ON events;
DROP POLICY IF EXISTS events_owner_delete             ON events;
DROP POLICY IF EXISTS events_owner_all                ON events;
DROP POLICY IF EXISTS events_admin_all                ON events;
DROP POLICY IF EXISTS events_restaurant_owner_crud    ON events;
DROP POLICY IF EXISTS "events_public_read"            ON events;
DROP POLICY IF EXISTS "events_restaurant_owner"       ON events;
DROP POLICY IF EXISTS "events_restaurant_owner_crud"  ON events;
DROP POLICY IF EXISTS "events_owner_all"              ON events;
DROP POLICY IF EXISTS "events_admin_all"              ON events;

-- 2. S'assurer que RLS est activée
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 3. Policy 1 : lecture publique des événements publiés
CREATE POLICY "events_public_read" ON events
  FOR SELECT
  USING (is_published = true);

-- 4. Policy 2 : restaurant owner/manager peut tout faire sur SES événements
CREATE POLICY "events_owner_all" ON events
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('restaurant_owner', 'manager')
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('restaurant_owner', 'manager')
    )
  );

-- 5. Policy 3 : super admin peut tout faire
CREATE POLICY "events_superadmin_all" ON events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
