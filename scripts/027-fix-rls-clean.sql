-- ================================================================
-- SCRIPT 027: Fix RLS Policies - Clean Version (No Enum Issues)
-- ================================================================

-- 1. Fix restaurants UPDATE policy (use owner_id which exists now)
DROP POLICY IF EXISTS "restaurants_owner_update" ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_all" ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_all_operations" ON restaurants;

-- Create UPDATE policy using owner_id (which exists in restaurants table)
CREATE POLICY "restaurants_owner_update" ON restaurants
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT restaurant_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- 2. Create ALL policy for restaurant owners
CREATE POLICY "restaurants_owner_all" ON restaurants
  FOR ALL
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT restaurant_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- 3. Fix promo_codes RLS - ensure owners can manage
DROP POLICY IF EXISTS "promo_codes_owner_all" ON promo_codes;
CREATE POLICY "promo_codes_owner_all" ON promo_codes
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles
      WHERE id = auth.uid()
    )
    OR restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid()
    )
  );

-- 4. Add default values to prevent NULL errors
ALTER TABLE promo_codes 
  ALTER COLUMN discount_type SET DEFAULT 'percentage',
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN used_count SET DEFAULT 0;

-- 5. Ensure orders can be created with promo codes
ALTER TABLE orders
  ALTER COLUMN promo_code SET DEFAULT NULL,
  ALTER COLUMN promo_code_id SET DEFAULT NULL;

SELECT 'Script 027 completed - RLS policies fixed without enum issues' AS status;
