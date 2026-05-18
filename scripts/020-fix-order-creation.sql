-- ════════════════════════════════════════════════════════════════════════════
-- SCRIPT 020 — Fix définitif : RLS orders + items + order_modes
-- ⚠️  CRITIQUE : Ce script résout "Failed to create order"
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════
-- 1. FIX TABLE orders — politiques INSERT permissives
-- ════════════════════════════════════════════════════

-- Supprimer TOUTES les anciennes politiques conflictuelles
DROP POLICY IF EXISTS "orders_customer_insert"      ON orders;
DROP POLICY IF EXISTS "orders_insert_authenticated" ON orders;
DROP POLICY IF EXISTS "orders_customer_read"        ON orders;
DROP POLICY IF EXISTS "orders_restaurant_read"      ON orders;
DROP POLICY IF EXISTS "orders_restaurant_update"    ON orders;

-- Recréer proprement

-- INSERT : un utilisateur connecté peut créer SA propre commande
CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- SELECT : client voit ses commandes
CREATE POLICY "orders_select_customer" ON orders
  FOR SELECT
  USING (auth.uid() = customer_id);

-- SELECT : le restaurant voit les commandes qui lui sont destinées
CREATE POLICY "orders_select_restaurant" ON orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.restaurant_id = orders.restaurant_id
        AND profiles.role IN ('restaurant_owner', 'restaurant', 'manager', 'staff')
    )
  );

-- UPDATE : le restaurant peut changer le statut
CREATE POLICY "orders_update_restaurant" ON orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.restaurant_id = orders.restaurant_id
        AND profiles.role IN ('restaurant_owner', 'restaurant', 'manager', 'staff')
    )
  );

-- S'assurer que RLS est activé
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════
-- 2. FIX TABLE order_items — INSERT permissif
-- ════════════════════════════════════════════════════

DROP POLICY IF EXISTS "order_items_insert"              ON order_items;
DROP POLICY IF EXISTS "order_items_customer_insert"     ON order_items;
DROP POLICY IF EXISTS "order_items_read"                ON order_items;

-- INSERT : autorisé si la commande appartient au client connecté
CREATE POLICY "order_items_insert_own" ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.customer_id = auth.uid()
    )
  );

-- SELECT : client ou restaurant peuvent lire les lignes
CREATE POLICY "order_items_select" ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND (
          orders.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.restaurant_id = orders.restaurant_id
          )
        )
    )
  );

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════
-- 3. FIX TABLE items — SELECT visible même pour l'insertion
-- ════════════════════════════════════════════════════
-- La politique actuelle : is_available = true
-- Le bug : si un item n'est pas disponible, la vérification côté JS
--          croit que l'item n'existe pas du tout
-- Fix : on permet au moins de lire TOUS les items à un utilisateur connecté

DROP POLICY IF EXISTS "items_public_read"      ON items;
DROP POLICY IF EXISTS "items_authenticated_read" ON items;

-- Lecture publique : articles disponibles uniquement (pour la carte)
CREATE POLICY "items_public_read" ON items
  FOR SELECT
  USING (is_available = true);

-- Lecture authentifiée : tous les articles (pour vérification commande)
CREATE POLICY "items_authenticated_read" ON items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- (Les deux politiques coexistent : Supabase applique un OR entre elles)


-- ════════════════════════════════════════════════════
-- 4. GRANTS explicites (sécurité supplémentaire)
-- ════════════════════════════════════════════════════

GRANT SELECT, INSERT ON orders TO authenticated;
GRANT SELECT, INSERT ON order_items TO authenticated;
GRANT SELECT ON items TO authenticated, anon;
GRANT SELECT ON order_modes TO authenticated, anon;
GRANT SELECT ON payment_methods TO authenticated, anon;


-- ════════════════════════════════════════════════════
-- 5. S'assurer que l'ENUM order_type est complet
-- ════════════════════════════════════════════════════
-- Les codes dans order_modes DOIVENT correspondre exactement à l'ENUM
-- Valeurs valides : 'delivery', 'dine_in', 'takeaway'
-- Vérification :
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'order_type' AND e.enumlabel = 'takeaway'
  ) THEN
    ALTER TYPE order_type ADD VALUE 'takeaway';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'order_type' AND e.enumlabel = 'dine_in'
  ) THEN
    ALTER TYPE order_type ADD VALUE 'dine_in';
  END IF;
END $$;


-- ════════════════════════════════════════════════════
-- 6. Vérification finale
-- ════════════════════════════════════════════════════
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('orders', 'order_items', 'items')
ORDER BY tablename, policyname;

-- Doit lister les nouvelles politiques créées ci-dessus.