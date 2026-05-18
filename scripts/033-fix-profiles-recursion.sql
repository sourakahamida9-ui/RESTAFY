-- Script 033: Fix infinite recursion in profiles RLS policies
-- The issue: policies reference profiles table which causes infinite recursion
-- Solution: Use auth.uid() directly without joining profiles

BEGIN;

-- 1. Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- 2. Recreate simple, non-recursive policies
-- SELECT: Users can read their own profile + public restaurant profiles
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR role = 'restaurant'
  );

-- INSERT: Authenticated users can create their own profile
CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- UPDATE: Users can update their own profile
CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- DELETE: Users can delete their own profile
CREATE POLICY "profiles_delete"
  ON profiles FOR DELETE
  USING (id = auth.uid());

-- Verify RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

SELECT 'Script 033 completed - Fixed infinite recursion in profiles RLS' AS status;
