-- ================================================================
-- SCRIPT 026: Fix ALL RLS Policies - Final Comprehensive Fix
-- ================================================================

-- 1. Fix restaurants UPDATE policy (owner_id doesn't exist)
DROP POLICY IF EXISTS "restaurants_owner_update" ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_all" ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_all_operations" ON restaurants;

-- Create correct UPDATE policy using profiles.restaurant_id
CREATE POLICY "restaurants_owner_update" ON restaurants
  FOR UPDATE
  USING (
    id IN (
      SELECT restaurant_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('restaurant_owner', 'manager', 'superadmin')
    )
  );

-- 2. Ensure superadmin has full access to restaurants
DROP POLICY IF EXISTS "restaurants_superadmin_all" ON restaurants;
CREATE POLICY "restaurants_superadmin_all" ON restaurants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'superadmin'
    )
  );

-- 3. Fix promo_codes table RLS
DROP POLICY IF EXISTS "promo_codes_read" ON promo_codes;
DROP POLICY IF EXISTS "promo_codes_owner" ON promo_codes;
DROP POLICY IF EXISTS "promo_codes_public_read" ON promo_codes;

-- Anyone can read active promo codes
CREATE POLICY "promo_codes_public_read" ON promo_codes
  FOR SELECT
  USING (is_active = true);

-- Restaurant owners can manage their promo codes
CREATE POLICY "promo_codes_owner_all" ON promo_codes
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('restaurant_owner', 'manager', 'superadmin')
    )
  );

-- 4. Ensure profiles table allows superadmin check
DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
CREATE POLICY "profiles_read_own" ON profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'superadmin'
    )
  );

-- 5. Ensure profiles can be updated by owner
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (id = auth.uid());

-- 6. Add default values to promo_codes to prevent NULL errors
ALTER TABLE promo_codes 
  ALTER COLUMN discount_type SET DEFAULT 'percentage',
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN usage_count SET DEFAULT 0;

-- 7. Note: superadmin role should already exist in the user_role enum
-- If it doesn't, the user needs to manually add it via Supabase Dashboard

SELECT 'Script 026 completed - All RLS policies fixed' AS status;
