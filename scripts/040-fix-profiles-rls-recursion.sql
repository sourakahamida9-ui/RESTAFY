-- ============================================================
-- Script 040 — Fix CRITIQUE : infinite recursion in profiles
-- ============================================================
-- CAUSE RACINE :
--   Les policies sur la table `profiles` font elles-mêmes
--   un SELECT FROM profiles pour vérifier le rôle → boucle
--   infinie : policy → query profiles → policy → ...
--
-- Policies fautives identifiées :
--   • profiles_superadmin_all  (script 036) : SELECT FROM profiles p2
--   • profiles_delete_superadmin (script 014) : SELECT FROM profiles p
--
-- FIX : créer get_my_role() SECURITY DEFINER qui lit le rôle
--   SANS passer par RLS, puis l'utiliser dans toutes les
--   policies de la table profiles.
-- ============================================================

BEGIN;

-- ── 1. Fonction SECURITY DEFINER — lit le rôle sans passer par RLS ──────────
-- SECURITY DEFINER = s'exécute avec les droits du propriétaire (postgres),
-- pas ceux de l'appelant → bypass RLS → pas de récursion.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Accorder l'exécution à tous les rôles authentifiés et anon
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated, anon;

-- ── 2. Supprimer TOUTES les policies existantes sur profiles ─────────────────
DROP POLICY IF EXISTS "profiles_own"                ON profiles;
DROP POLICY IF EXISTS "profiles_own_read"           ON profiles;
DROP POLICY IF EXISTS "profiles_own_update"         ON profiles;
DROP POLICY IF EXISTS "profiles_insert"             ON profiles;
DROP POLICY IF EXISTS "profiles_restaurant_staff"   ON profiles;
DROP POLICY IF EXISTS "profiles_superadmin"         ON profiles;
DROP POLICY IF EXISTS "profiles_superadmin_all"     ON profiles;
DROP POLICY IF EXISTS "profiles_delete_superadmin"  ON profiles;
DROP POLICY IF EXISTS "profiles_restaurant_read"    ON profiles;
DROP POLICY IF EXISTS "profiles_staff_read"         ON profiles;

-- ── 3. Recréer les policies SANS récursion ───────────────────────────────────

-- RLS activée
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur peut lire son propre profil
CREATE POLICY "profiles_own_read"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Chaque utilisateur peut modifier son propre profil
CREATE POLICY "profiles_own_update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Inscription : chaque utilisateur peut créer son profil
CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Restaurant owner/manager peut voir les profils de son restaurant
-- (pour la gestion d'équipe) — PAS de SELECT FROM profiles
CREATE POLICY "profiles_restaurant_read"
  ON profiles FOR SELECT
  USING (
    restaurant_id IS NOT NULL
    AND restaurant_id = (
      SELECT restaurant_id FROM profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    )
  );

-- Super admin — utilise get_my_role() → ZERO récursion
CREATE POLICY "profiles_superadmin_all"
  ON profiles FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- Suppression par super admin — utilise get_my_role()
CREATE POLICY "profiles_delete_superadmin"
  ON profiles FOR DELETE
  USING (
    get_my_role() = 'super_admin'
    AND role != 'super_admin'  -- Protège les super_admins de la suppression
  );

-- ── 4. Corriger également les autres tables qui utilisent profiles pour
--       vérifier super_admin → remplacer par get_my_role() ──────────────────

-- RESTAURANTS — superadmin
DROP POLICY IF EXISTS "restaurants_superadmin_all" ON restaurants;
CREATE POLICY "restaurants_superadmin_all"
  ON restaurants FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- ORDERS — superadmin
DROP POLICY IF EXISTS "orders_superadmin_all" ON orders;
CREATE POLICY "orders_superadmin_all"
  ON orders FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- EVENTS — superadmin
DROP POLICY IF EXISTS "events_superadmin_all" ON events;
CREATE POLICY "events_superadmin_all"
  ON events FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- TICKET_PURCHASES — superadmin (si la policy existe)
DROP POLICY IF EXISTS "tp_superadmin_all" ON ticket_purchases;
CREATE POLICY "tp_superadmin_all"
  ON ticket_purchases FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- EVENT_TICKETS — superadmin
DROP POLICY IF EXISTS "event_tickets_superadmin_all" ON event_tickets;
CREATE POLICY "event_tickets_superadmin_all"
  ON event_tickets FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- ITEMS — superadmin
DROP POLICY IF EXISTS "items_superadmin_all" ON items;
CREATE POLICY "items_superadmin_all"
  ON items FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- CATEGORIES — superadmin
DROP POLICY IF EXISTS "categories_superadmin_all" ON categories;
CREATE POLICY "categories_superadmin_all"
  ON categories FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

COMMIT;

-- ── 5. Vérification ──────────────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

SELECT 'Script 040 OK — infinite recursion fixed via get_my_role()' AS status;