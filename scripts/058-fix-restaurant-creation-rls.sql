-- Fix RLS policies pour permettre aux restaurant_owner de creer leur restaurant
-- Le probleme: les nouveaux utilisateurs ne peuvent pas creer de restaurant car RLS bloque

-- 1. Supprimer les anciennes policies qui pourraient bloquer
DROP POLICY IF EXISTS "restaurant_owner_insert" ON restaurants;
DROP POLICY IF EXISTS "allow_owner_insert" ON restaurants;
DROP POLICY IF EXISTS "Users can create restaurants" ON restaurants;

-- 2. Creer une policy permettant aux utilisateurs authentifies de creer un restaurant
-- seulement si owner_id = leur propre id
CREATE POLICY "authenticated_users_can_create_own_restaurant"
ON restaurants
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- 3. Policy pour que les owners puissent voir leur restaurant
DROP POLICY IF EXISTS "owner_can_view" ON restaurants;
CREATE POLICY "owner_can_view_own_restaurant"
ON restaurants
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR is_active = true);

-- 4. Policy pour que les owners puissent modifier leur restaurant
DROP POLICY IF EXISTS "owner_can_update" ON restaurants;
CREATE POLICY "owner_can_update_own_restaurant"
ON restaurants
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- 5. Verification - afficher les policies actuelles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'restaurants';
