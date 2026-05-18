-- Script SQL : correction RLS restaurant_tables
-- Fix de l'erreur "new row violates row-level security policy for table restaurant_tables"
--
-- Problème : le script 101 crée une policy FOR ALL avec USING mais SANS WITH CHECK.
-- Pour les INSERT / UPDATE, Postgres exige WITH CHECK, sinon toutes les insertions
-- sont rejetées — même pour le propriétaire du restaurant.
--
-- Solution : on remplace par 4 policies explicites (SELECT/INSERT/UPDATE/DELETE)
-- avec USING + WITH CHECK cohérents, couvrant les rôles restaurant_owner, manager,
-- et super_admin (le super admin doit pouvoir tout gérer).

-- 1. Supprimer l'ancienne policy défaillante
DROP POLICY IF EXISTS "Restaurants can manage their tables" ON restaurant_tables;
DROP POLICY IF EXISTS "restaurant_tables_select" ON restaurant_tables;
DROP POLICY IF EXISTS "restaurant_tables_insert" ON restaurant_tables;
DROP POLICY IF EXISTS "restaurant_tables_update" ON restaurant_tables;
DROP POLICY IF EXISTS "restaurant_tables_delete" ON restaurant_tables;
DROP POLICY IF EXISTS "restaurant_tables_public_read" ON restaurant_tables;

-- 2. SELECT — le propriétaire / manager voit ses tables ; super_admin voit tout ;
-- les clients anonymes peuvent lire une table par id (pour scanner un QR /r/:slug?table=X
-- et savoir qu'elle existe). On garde lecture publique limitée.
CREATE POLICY "restaurant_tables_select_owner"
  ON restaurant_tables FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role = 'super_admin'
          OR (
            profiles.role IN ('restaurant_owner', 'manager')
            AND profiles.restaurant_id = restaurant_tables.restaurant_id
          )
        )
    )
  );

CREATE POLICY "restaurant_tables_select_public"
  ON restaurant_tables FOR SELECT
  USING (is_active = true);

-- 3. INSERT — le propriétaire / manager du restaurant concerné (ou super_admin).
-- WITH CHECK obligatoire, sinon l'INSERT est rejeté.
CREATE POLICY "restaurant_tables_insert_owner"
  ON restaurant_tables FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role = 'super_admin'
          OR (
            profiles.role IN ('restaurant_owner', 'manager')
            AND profiles.restaurant_id = restaurant_tables.restaurant_id
          )
        )
    )
  );

-- 4. UPDATE — mêmes critères, USING (ligne actuelle) + WITH CHECK (nouvelle ligne)
CREATE POLICY "restaurant_tables_update_owner"
  ON restaurant_tables FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role = 'super_admin'
          OR (
            profiles.role IN ('restaurant_owner', 'manager')
            AND profiles.restaurant_id = restaurant_tables.restaurant_id
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role = 'super_admin'
          OR (
            profiles.role IN ('restaurant_owner', 'manager')
            AND profiles.restaurant_id = restaurant_tables.restaurant_id
          )
        )
    )
  );

-- 5. DELETE — propriétaire / manager / super_admin
CREATE POLICY "restaurant_tables_delete_owner"
  ON restaurant_tables FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role = 'super_admin'
          OR (
            profiles.role IN ('restaurant_owner', 'manager')
            AND profiles.restaurant_id = restaurant_tables.restaurant_id
          )
        )
    )
  );

-- Fin : les restaurateurs peuvent désormais créer / modifier / supprimer
-- leurs tables depuis /restaurant/dashboard/tables, et les clients peuvent
-- toujours résoudre un QR scanné grâce à la policy select_public limitée
-- aux tables actives.
