-- 042-optimize-rls-policies.sql - Simplifier et optimiser les RLS policies
-- Les policies complexes causent des timeouts massifs

-- 1. Simplifier la policy profiles - SELECT rapide
DROP POLICY IF EXISTS "Profiles are viewable by their owner" ON profiles;
CREATE POLICY "Profiles are viewable by owner"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 2. Restaurant staff - éviter les joins complexes
DROP POLICY IF EXISTS "Staff can view restaurant" ON restaurant_staff;
CREATE POLICY "Staff members can read"
  ON restaurant_staff FOR SELECT
  USING (auth.uid() = profile_id);

-- 3. Restaurants - SELECT sans joins
DROP POLICY IF EXISTS "Restaurants are publicly viewable" ON restaurants;
CREATE POLICY "Restaurants publicly viewable"
  ON restaurants FOR SELECT
  USING (true);

-- 4. Orders - Simplifié
DROP POLICY IF EXISTS "Orders visible to owners and staff" ON orders;
CREATE POLICY "Orders viewable by owner"
  ON orders FOR SELECT
  USING (auth.uid() = customer_id);

-- 5. Créer des index pour accélérer les lookups
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_profile_id ON restaurant_staff(profile_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_id ON restaurants(id);

-- 6. Index composés pour les queries fréquentes
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_profile_restaurant ON restaurant_staff(profile_id, restaurant_id);
