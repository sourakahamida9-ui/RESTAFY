-- ================================================================
-- Script 041 — FIX DÉFINITIF : toutes les récursions profiles
-- ================================================================
-- PROBLÈME RACINE :
--   Toute policy sur `profiles` qui contient SELECT FROM profiles
--   provoque une récursion infinie car Postgres applique les
--   policies en évaluant la condition, qui re-déclenche les policies.
--
-- POLICIES RÉCURSIVES IDENTIFIÉES (tous scripts confondus) :
--   • profiles_superadmin_all  (script 036) → SELECT FROM profiles p2
--   • profiles_read_own        (script 026) → SELECT FROM profiles p
--   • profiles_delete_superadmin (script 014) → SELECT FROM profiles p
--   • profiles_restaurant_staff  (script 01) → auth_restaurant_id()
--     (sûr SEULEMENT si auth_restaurant_id est SECURITY DEFINER)
--
-- SOLUTION : utiliser UNIQUEMENT les fonctions SECURITY DEFINER
--   auth_role() et auth_restaurant_id() qui exécutent leur SELECT
--   avec les droits postgres → bypass RLS → zéro récursion.
-- ================================================================

BEGIN;

-- ── 1. Recréer les fonctions SECURITY DEFINER (idempotent) ──────────────────
-- Ces fonctions lisent profiles SANS passer par les policies RLS.

CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_restaurant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION auth_role()          TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth_restaurant_id() TO authenticated, anon;

-- ── 2. Supprimer ABSOLUMENT TOUTES les policies sur profiles ─────────────────
-- (y compris celles qui ne sont pas récursives, pour repartir proprement)

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_own"                  ON profiles;
DROP POLICY IF EXISTS "profiles_own_read"             ON profiles;
DROP POLICY IF EXISTS "profiles_own_update"           ON profiles;
DROP POLICY IF EXISTS "profiles_insert"               ON profiles;
DROP POLICY IF EXISTS "profiles_read_own"             ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"           ON profiles;
DROP POLICY IF EXISTS "profiles_restaurant_staff"     ON profiles;
DROP POLICY IF EXISTS "profiles_restaurant_read"      ON profiles;
DROP POLICY IF EXISTS "profiles_superadmin"           ON profiles;
DROP POLICY IF EXISTS "profiles_superadmin_all"       ON profiles;
DROP POLICY IF EXISTS "profiles_delete_superadmin"    ON profiles;

-- ── 3. Recréer UNIQUEMENT des policies sans récursion ────────────────────────

-- Chaque utilisateur accède à son propre profil (READ + UPDATE + INSERT)
-- SAFE : auth.uid() = id → aucune subquery vers profiles
CREATE POLICY "profiles_own_read"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_own_update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Staff/manager d'un même restaurant peut voir ses collègues
-- SAFE : auth_restaurant_id() est SECURITY DEFINER → pas de récursion
CREATE POLICY "profiles_restaurant_read"
  ON profiles FOR SELECT
  USING (
    restaurant_id IS NOT NULL
    AND restaurant_id = auth_restaurant_id()
  );

-- Super admin — accès total
-- SAFE : auth_role() est SECURITY DEFINER → pas de récursion
CREATE POLICY "profiles_superadmin_all"
  ON profiles FOR ALL
  USING (auth_role() = 'super_admin')
  WITH CHECK (auth_role() = 'super_admin');

-- Suppression par super admin uniquement
-- SAFE : auth_role() est SECURITY DEFINER
CREATE POLICY "profiles_delete_superadmin"
  ON profiles FOR DELETE
  USING (
    auth_role() = 'super_admin'
    AND role != 'super_admin'
  );

-- ── 4. Fix restaurants : lecture publique (restaure après scripts 026/027) ───

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurants_read_public"          ON restaurants;
DROP POLICY IF EXISTS "restaurants_public_read"          ON restaurants;
DROP POLICY IF EXISTS "restaurants_public_select"        ON restaurants;
DROP POLICY IF EXISTS "restaurants_select_all"           ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_update"         ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_all"            ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_all_operations" ON restaurants;
DROP POLICY IF EXISTS "restaurants_superadmin_all"       ON restaurants;
DROP POLICY IF EXISTS "restaurants_superadmin"           ON restaurants;

-- Lecture publique (anon + connecté)
-- SAFE : is_active = true → aucune subquery
CREATE POLICY "restaurants_read_public"
  ON restaurants FOR SELECT
  USING (is_active = true);

-- Propriétaire/manager
-- SAFE : auth_restaurant_id() SECURITY DEFINER
CREATE POLICY "restaurants_owner_all"
  ON restaurants FOR ALL
  USING (id = auth_restaurant_id())
  WITH CHECK (id = auth_restaurant_id());

-- Super admin
-- SAFE : auth_role() SECURITY DEFINER
CREATE POLICY "restaurants_superadmin_all"
  ON restaurants FOR ALL
  USING (auth_role() = 'super_admin')
  WITH CHECK (auth_role() = 'super_admin');

-- ── 5. Activer les restaurants existants ─────────────────────────────────────
UPDATE restaurants
SET is_active = true
WHERE is_active IS DISTINCT FROM true
  AND name IS NOT NULL
  AND name != '';

COMMIT;

-- ── 6. Vérifications ─────────────────────────────────────────────────────────

-- Policies actives sur profiles
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Policies actives sur restaurants
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'restaurants'
ORDER BY policyname;

-- Restaurants visibles
SELECT id, name, is_active FROM restaurants ORDER BY name;

SELECT 'Script 041 OK — recursion fixed, restaurants visible' AS status;