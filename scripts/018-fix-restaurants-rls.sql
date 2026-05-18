-- 018-fix-restaurants-rls.sql
-- Correción des politiques RLS pour les restaurants
-- Garantir que les restaurants actifs sont visibles pour tous

-- 1. Drop les anciennes policies non spécifiques
DROP POLICY IF EXISTS "restaurants_public_read" ON restaurants CASCADE;
DROP POLICY IF EXISTS "restaurants_select_all" ON restaurants CASCADE;
DROP POLICY IF EXISTS "restaurants_public_select" ON restaurants CASCADE;

-- 2. Créer une politique claire et simple pour READ public
CREATE POLICY "restaurants_read_public" ON restaurants
  FOR SELECT
  USING (is_active = true);

-- 3. Créer une politique pour les propriétaires (UPDATE)
CREATE POLICY "restaurants_owner_all_operations" ON restaurants
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE restaurant_id = restaurants.id 
      AND role = 'restaurant_owner'
    )
  );

-- 4. Créer une politique pour super admins (ALL)
CREATE POLICY "restaurants_superadmin_all" ON restaurants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- 5. S'assurer que RLS est activée
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- 6. Index pour performance
CREATE INDEX IF NOT EXISTS idx_restaurants_is_active ON restaurants(is_active);
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);

-- 7. Vérifier les restaurants et activer au moins un
UPDATE restaurants 
SET is_active = true 
WHERE name IS NOT NULL 
AND is_active = false;

COMMENT ON POLICY "restaurants_read_public" ON restaurants IS 'Tous les utilisateurs peuvent voir les restaurants actifs';
