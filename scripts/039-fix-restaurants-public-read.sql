-- ============================================================
-- Script 039 — Fix lecture publique restaurants (anon + auth)
-- ============================================================
-- PROBLÈME : scripts 026/027 ont droppé des policies sans
-- recréer la politique SELECT publique → les utilisateurs
-- non connectés (et connectés) ne voient aucun restaurant.
-- ============================================================

BEGIN;

-- Désactiver puis réactiver RLS pour nettoyer l'état
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Supprimer TOUTES les policies existantes sur restaurants
DROP POLICY IF EXISTS "restaurants_read_public"          ON restaurants;
DROP POLICY IF EXISTS "restaurants_public_read"          ON restaurants;
DROP POLICY IF EXISTS "restaurants_public_select"        ON restaurants;
DROP POLICY IF EXISTS "restaurants_select_all"           ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_update"         ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_all"            ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_all_operations" ON restaurants;
DROP POLICY IF EXISTS "restaurants_superadmin_all"       ON restaurants;

-- ── 1. LECTURE PUBLIQUE (anon + authenticated) ───────────────────────────────
-- Tout le monde peut voir les restaurants actifs, SANS être connecté
CREATE POLICY "restaurants_read_public"
  ON restaurants
  FOR SELECT
  USING (is_active = true);

-- ── 2. PROPRIÉTAIRE — toutes les opérations sur son restaurant ───────────────
CREATE POLICY "restaurants_owner_all"
  ON restaurants
  FOR ALL
  USING (
    id IN (
      SELECT restaurant_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('restaurant_owner', 'manager')
    )
  );

-- ── 3. SUPER ADMIN — accès total ─────────────────────────────────────────────
CREATE POLICY "restaurants_superadmin_all"
  ON restaurants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ── 4. S'assurer qu'il y a au moins un restaurant actif visible ──────────────
-- (ne désactive JAMAIS un restaurant existant)
UPDATE restaurants
SET is_active = true
WHERE is_active = false
  AND name IS NOT NULL
  AND name != '';

-- ── 5. Index de performance ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_restaurants_is_active ON restaurants(is_active);
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);

COMMIT;

-- Vérification
SELECT
  id,
  name,
  is_active,
  city
FROM restaurants
ORDER BY name;

SELECT 'Script 039 OK — restaurants public read restored' AS status;