-- Script 036: Correction CRITIQUE — toutes les policies RLS superadmin
-- =====================================================================
-- CAUSE RACINE : script 026 utilise role = 'superadmin' (sans underscore)
-- alors que le vrai rôle en base est 'super_admin' (avec underscore).
-- Résultat : le superadmin ne peut PAS valider les restaurants (update is_active
-- silencieusement bloqué), ni voir/modifier les commandes et profils.

-- ── 1. RESTAURANTS ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "restaurants_superadmin_all"   ON restaurants;
DROP POLICY IF EXISTS "restaurants_superadmin"        ON restaurants;

CREATE POLICY "restaurants_superadmin_all" ON restaurants
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ── 2. ORDERS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders_superadmin_all"        ON orders;
DROP POLICY IF EXISTS "orders_superadmin"            ON orders;

CREATE POLICY "orders_superadmin_all" ON orders
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ── 3. PROFILES ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_superadmin_all"      ON profiles;
DROP POLICY IF EXISTS "profiles_superadmin"          ON profiles;
-- Note : on ne supprime pas les policies légitimes d'autres scripts

CREATE POLICY "profiles_superadmin_all" ON profiles
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'super_admin')
  );

-- ── 4. EVENTS ────────────────────────────────────────────────────────────────
-- Déjà corrigé dans script 032 mais on s'assure de l'uniformité
DROP POLICY IF EXISTS "events_superadmin_all"        ON events;

CREATE POLICY "events_superadmin_all" ON events
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ── 5. Vérification rapide ────────────────────────────────────────────────────
-- Ce SELECT retourne toutes les policies actives pour le superadmin
-- Vous pouvez le copier séparément pour vérifier après exécution :
-- SELECT schemaname, tablename, policyname
-- FROM pg_policies
-- WHERE policyname ILIKE '%superadmin%' OR policyname ILIKE '%super_admin%'
-- ORDER BY tablename, policyname;

SELECT 'Script 036 completed — policies superadmin corrigées (super_admin avec underscore)' AS status;