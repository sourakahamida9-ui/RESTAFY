-- ════════════════════════════════════════════════════════════════
-- RESTAFY — Script 075 : FIX commandes invisibles dashboard
-- ⚠️ Ne pas confondre avec 075-supabase-pgcrypto-search-path.sql (PIN kiosque uniquement).
--
-- Corrige notamment :
--   1. Rôles legacy / équipe : 'restaurant', 'caissier', 'chef' (profil)
--   2. SELECT sur order_items pour le restaurateur
--   3. Fallback owner_id sur orders (proprio sans restaurant_id sur le profil)
--   4. Fallback restaurant_staff : membre d'équipe avec profile_id = auth.uid()
--      mais profiles.restaurant_id encore NULL → voyait 0 commande
--   5. Côté app : le dashboard utilisait à tort .eq('user_id') sur restaurant_staff ;
--      la colonne correcte est profile_id (= id du profil / auth.uid()). Corrigé dans le dépôt.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 1. Recréer get_my_role() pour normaliser le rôle 'restaurant' → inclus
-- ────────────────────────────────────────────────────────────────

-- La fonction existe déjà (script 054), on la garde telle quelle.
-- On va simplement ajouter les rôles manquants dans les policies.

-- ────────────────────────────────────────────────────────────────
-- 2. FIX ORDERS : SELECT + UPDATE avec rôles 'restaurant' et 'caissier'
-- ────────────────────────────────────────────────────────────────

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "orders_select_restaurant"  ON orders;
DROP POLICY IF EXISTS "orders_update_restaurant"  ON orders;

-- SELECT : le restaurant voit ses commandes
-- ✅ Ajout des rôles manquants : 'restaurant' (legacy) et 'caissier'
-- ✅ Ajout fallback owner_id pour les cas où restaurant_id n'est pas dans le profil
CREATE POLICY "orders_select_restaurant" ON orders
  FOR SELECT
  USING (
    (
      restaurant_id = get_my_restaurant_id()
      AND get_my_role() IN ('restaurant_owner', 'restaurant', 'manager', 'staff', 'livreur', 'caissier')
    )
    OR
    (
      -- Fallback : le propriétaire du restaurant peut aussi voir via owner_id
      EXISTS (
        SELECT 1 FROM restaurants r
        WHERE r.id = orders.restaurant_id
          AND r.owner_id = auth.uid()
      )
    )
  );

-- UPDATE : le restaurant peut modifier le statut
CREATE POLICY "orders_update_restaurant" ON orders
  FOR UPDATE
  USING (
    (
      restaurant_id = get_my_restaurant_id()
      AND get_my_role() IN (
        'restaurant_owner', 'restaurant', 'manager', 'staff', 'livreur',
        'caissier', 'chef'
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM restaurants r
        WHERE r.id = orders.restaurant_id
          AND r.owner_id = auth.uid()
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.profile_id = auth.uid()
          AND COALESCE(rs.is_active, TRUE)
          AND rs.restaurant_id = orders.restaurant_id
      )
    )
  );

-- ────────────────────────────────────────────────────────────────
-- 3. FIX ORDER_ITEMS : ajouter SELECT pour le restaurateur
-- Sans cela, le join order_items(...) échoue silencieusement
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "order_items_select_restaurant" ON order_items;
DROP POLICY IF EXISTS "order_items_select_customer"   ON order_items;
DROP POLICY IF EXISTS "order_items_superadmin_all"     ON order_items;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Le restaurateur voit les items de SES commandes
CREATE POLICY "order_items_select_restaurant" ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND (
          o.restaurant_id = get_my_restaurant_id()
          OR EXISTS (
            SELECT 1 FROM restaurants r
            WHERE r.id = o.restaurant_id AND r.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.profile_id = auth.uid()
              AND COALESCE(rs.is_active, TRUE)
              AND rs.restaurant_id = o.restaurant_id
          )
        )
    )
  );

-- Le client voit les items de SES commandes
CREATE POLICY "order_items_select_customer" ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.customer_id = auth.uid()
    )
  );

-- Super admin voit tout
CREATE POLICY "order_items_superadmin_all" ON order_items
  FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- ────────────────────────────────────────────────────────────────
-- 4. FIX PROFILES : normaliser 'restaurant' → 'restaurant_owner'
-- pour les profils déjà enregistrés avec le rôle legacy
-- ────────────────────────────────────────────────────────────────

-- NOTE : Décommentez cette ligne si vous voulez migrer automatiquement
-- les profils avec le rôle 'restaurant' vers 'restaurant_owner'.
-- Cela corrige le problème à la racine.

-- UPDATE profiles SET role = 'restaurant_owner' WHERE role::TEXT = 'restaurant';

-- Si les commandes restent vides pour le propriétaire : vérifier en SQL (remplacer l’UUID) :
-- SELECT id, restaurant_id, role FROM profiles WHERE id = auth.uid();
-- SELECT id, owner_id FROM restaurants WHERE id = '<restaurant_uuid>';

COMMIT;

-- ────────────────────────────────────────────────────────────────
-- VÉRIFICATION
-- ────────────────────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  LEFT(qual, 100) AS condition
FROM pg_policies
WHERE tablename IN ('orders', 'order_items')
ORDER BY tablename, policyname;

SELECT 'Script 075 OK — Rôles restaurant/caissier + order_items SELECT ajoutés' AS status;
