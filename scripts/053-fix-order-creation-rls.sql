-- ════════════════════════════════════════════════════════════════════
-- RESTAFY — FIX DÉFINITIF : CRÉATION DE COMMANDES
-- Exécute ce script dans : Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : Compléter l'ENUM order_type si les valeurs manquent
-- (dine_in et takeaway ont peut-être été oubliés au setup)
-- ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Vérifie et ajoute 'dine_in' si absent
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'order_type' AND e.enumlabel = 'dine_in'
  ) THEN
    ALTER TYPE order_type ADD VALUE 'dine_in';
    RAISE NOTICE '✅ ENUM: dine_in ajouté';
  ELSE
    RAISE NOTICE '✓  ENUM: dine_in existe déjà';
  END IF;

  -- Vérifie et ajoute 'takeaway' si absent
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'order_type' AND e.enumlabel = 'takeaway'
  ) THEN
    ALTER TYPE order_type ADD VALUE 'takeaway';
    RAISE NOTICE '✅ ENUM: takeaway ajouté';
  ELSE
    RAISE NOTICE '✓  ENUM: takeaway existe déjà';
  END IF;

  -- Vérifie et ajoute 'delivery' si absent
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'order_type' AND e.enumlabel = 'delivery'
  ) THEN
    ALTER TYPE order_type ADD VALUE 'delivery';
    RAISE NOTICE '✅ ENUM: delivery ajouté';
  ELSE
    RAISE NOTICE '✓  ENUM: delivery existe déjà';
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : Activer RLS sur les tables critiques
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE items       ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : Supprimer TOUTES les anciennes politiques orders
-- (les doublons provoquent des conflits silencieux)
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders_customer_insert"      ON orders;
DROP POLICY IF EXISTS "orders_insert_authenticated" ON orders;
DROP POLICY IF EXISTS "orders_insert_own"           ON orders;
DROP POLICY IF EXISTS "orders_customer_read"        ON orders;
DROP POLICY IF EXISTS "orders_select_customer"      ON orders;
DROP POLICY IF EXISTS "orders_restaurant_read"      ON orders;
DROP POLICY IF EXISTS "orders_select_restaurant"    ON orders;
DROP POLICY IF EXISTS "orders_restaurant_update"    ON orders;
DROP POLICY IF EXISTS "orders_update_restaurant"    ON orders;
DROP POLICY IF EXISTS "orders_superadmin"           ON orders;
DROP POLICY IF EXISTS "orders_superadmin_all"       ON orders;

-- Supprimer toutes les anciennes politiques order_items
DROP POLICY IF EXISTS "order_items_insert"          ON order_items;
DROP POLICY IF EXISTS "order_items_customer_insert" ON order_items;
DROP POLICY IF EXISTS "order_items_insert_own"      ON order_items;
DROP POLICY IF EXISTS "order_items_read"            ON order_items;
DROP POLICY IF EXISTS "order_items_select"          ON order_items;

-- Supprimer les anciennes politiques items
DROP POLICY IF EXISTS "items_public_read"           ON items;
DROP POLICY IF EXISTS "items_authenticated_read"    ON items;


-- ─────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : Recréer les politiques orders proprement
-- ─────────────────────────────────────────────────────────────────────

-- Un client connecté peut créer sa commande
CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Un client voit SES commandes
CREATE POLICY "orders_select_customer" ON orders
  FOR SELECT
  USING (auth.uid() = customer_id);

-- Le restaurant voit les commandes qui lui sont destinées
CREATE POLICY "orders_select_restaurant" ON orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.restaurant_id = orders.restaurant_id
        AND profiles.role IN ('restaurant_owner', 'restaurant', 'manager', 'staff', 'livreur')
    )
  );

-- Le restaurant peut changer le statut d'une commande
CREATE POLICY "orders_update_restaurant" ON orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.restaurant_id = orders.restaurant_id
        AND profiles.role IN ('restaurant_owner', 'restaurant', 'manager', 'staff', 'livreur')
    )
  );

-- Super admin voit tout
CREATE POLICY "orders_superadmin_all" ON orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );


-- ─────────────────────────────────────────────────────────────────────
-- ÉTAPE 5 : Recréer les politiques order_items proprement
-- ─────────────────────────────────────────────────────────────────────

-- INSERT autorisé si la commande appartient au client connecté
CREATE POLICY "order_items_insert_own" ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.customer_id = auth.uid()
    )
  );

-- SELECT : client ou staff restaurant peuvent lire les lignes
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


-- ─────────────────────────────────────────────────────────────────────
-- ÉTAPE 6 : Politiques items — lecture publique + lecture auth
-- ─────────────────────────────────────────────────────────────────────

-- Lecture publique : articles disponibles (pour la carte)
CREATE POLICY "items_public_read" ON items
  FOR SELECT
  USING (is_available = true);

-- Lecture authentifiée : tous les articles
-- (les deux politiques coexistent : Supabase applique un OR)
CREATE POLICY "items_authenticated_read" ON items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- ─────────────────────────────────────────────────────────────────────
-- ÉTAPE 7 : GRANTS explicites
-- ─────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT         ON orders      TO authenticated;
GRANT SELECT, INSERT         ON order_items TO authenticated;
GRANT SELECT, UPDATE (status, points_earned) ON orders TO authenticated;
GRANT SELECT                 ON items       TO authenticated, anon;

-- Séquences si nécessaire
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- ÉTAPE 8 : Vérification — s'affiche en bas après exécution
-- ─────────────────────────────────────────────────────────────────────

-- ENUM values
SELECT 'ENUM order_type' AS check_name,
       string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'order_type'
GROUP BY t.typname;

-- RLS enabled
SELECT tablename,
       CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END AS rls_status
FROM pg_tables
WHERE tablename IN ('orders', 'order_items', 'items')
  AND schemaname = 'public';

-- Politiques actives
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('orders', 'order_items', 'items')
ORDER BY tablename, policyname;
