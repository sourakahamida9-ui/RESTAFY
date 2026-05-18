-- Script 037: Commandes visibles + Livreurs directs + WhatsApp
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ajouter name/phone/zone directement dans livreurs (profile_id optionnel)
-- 2. Ajouter livreur_id dans orders pour l'assignation
-- 3. RLS : restaurant peut lire/modifier ses livreurs
-- 4. Fix RLS orders : 'restaurant_owner' manquant dans les policies

-- ── 1. Table livreurs : colonnes directes (plus besoin d'un profil séparé) ───
ALTER TABLE livreurs ALTER COLUMN profile_id DROP NOT NULL;
ALTER TABLE livreurs ADD COLUMN IF NOT EXISTS name  TEXT;
ALTER TABLE livreurs ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE livreurs ADD COLUMN IF NOT EXISTS zone  TEXT;

-- ── 2. orders : colonne livreur_id pour assignation ──────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS livreur_id UUID REFERENCES livreurs(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- ── 3. RLS livreurs ───────────────────────────────────────────────────────────
ALTER TABLE livreurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "livreurs_restaurant_all"  ON livreurs CASCADE;
DROP POLICY IF EXISTS "livreurs_superadmin_all"  ON livreurs CASCADE;
DROP POLICY IF EXISTS "livreurs_public_read"     ON livreurs CASCADE;

-- Restaurant : gère ses propres livreurs
CREATE POLICY "livreurs_restaurant_all" ON livreurs FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles WHERE id = auth.uid()
    )
    OR restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles WHERE id = auth.uid()
    )
    OR restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- SuperAdmin : tout voir
CREATE POLICY "livreurs_superadmin_all" ON livreurs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ── 4. RLS orders : fix complet (restaurant_owner inclus) ────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_restaurant"   ON orders CASCADE;
DROP POLICY IF EXISTS "orders_update_restaurant"   ON orders CASCADE;
DROP POLICY IF EXISTS "orders_superadmin_all"      ON orders CASCADE;
DROP POLICY IF EXISTS "orders_insert_own"          ON orders CASCADE;
DROP POLICY IF EXISTS "orders_select_customer"     ON orders CASCADE;

-- Client : créer et voir ses commandes
CREATE POLICY "orders_insert_own" ON orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "orders_select_customer" ON orders FOR SELECT
  USING (auth.uid() = customer_id);

-- Restaurant : voir ET modifier ses commandes (tous les rôles staff)
CREATE POLICY "orders_select_restaurant" ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.restaurant_id = orders.restaurant_id
        AND profiles.role IN ('restaurant_owner', 'manager', 'staff', 'livreur')
    )
    OR EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = orders.restaurant_id
        AND restaurants.owner_id = auth.uid()
    )
  );

CREATE POLICY "orders_update_restaurant" ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.restaurant_id = orders.restaurant_id
        AND profiles.role IN ('restaurant_owner', 'manager', 'staff')
    )
    OR EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = orders.restaurant_id
        AND restaurants.owner_id = auth.uid()
    )
  );

-- SuperAdmin
CREATE POLICY "orders_superadmin_all" ON orders FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ── 5. RLS order_items : restaurant peut lire les items de ses commandes ──────
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques existantes sur order_items
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'order_items'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON order_items CASCADE', pol.policyname);
    END LOOP;
END $$;

-- Créer les nouvelles politiques
CREATE POLICY "order_items_insert_customer" ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
        AND orders.customer_id = auth.uid()
    )
  );

CREATE POLICY "order_items_select_customer" ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
        AND orders.customer_id = auth.uid()
    )
  );

CREATE POLICY "order_items_select_restaurant" ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND (
          EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.restaurant_id = o.restaurant_id
              AND p.role IN ('restaurant_owner', 'manager', 'staff')
          )
          OR EXISTS (
            SELECT 1 FROM restaurants r
            WHERE r.id = o.restaurant_id 
              AND r.owner_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "order_items_update_restaurant" ON order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND (
          EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.restaurant_id = o.restaurant_id
              AND p.role IN ('restaurant_owner', 'manager', 'staff')
          )
          OR EXISTS (
            SELECT 1 FROM restaurants r
            WHERE r.id = o.restaurant_id 
              AND r.owner_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "order_items_superadmin_all" ON order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ── 6. Ajout de triggers pour la gestion des livreurs ─────────────────────────
-- Trigger pour mettre à jour le statut quand un livreur est assigné
CREATE OR REPLACE FUNCTION update_order_status_on_livreur_assign()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.livreur_id IS NOT NULL AND OLD.livreur_id IS NULL THEN
    NEW.status = 'assigned';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_order_livreur_assign ON orders;
CREATE TRIGGER trigger_order_livreur_assign
  BEFORE UPDATE OF livreur_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_on_livreur_assign();

-- ── 7. Index pour optimiser les requêtes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_livreur_id ON orders(livreur_id);
CREATE INDEX IF NOT EXISTS idx_orders_cancel_reason ON orders(cancel_reason) WHERE cancel_reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_livreurs_restaurant_id ON livreurs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_livreurs_zone ON livreurs(zone) WHERE zone IS NOT NULL;

-- ── 8. Vérification et message de succès ──────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ Script 037 exécuté avec succès :';
  RAISE NOTICE '   - Livreurs : colonnes name, phone, zone ajoutées';
  RAISE NOTICE '   - Orders : livreur_id et cancel_reason ajoutés';
  RAISE NOTICE '   - RLS : toutes les policies recréées proprement';
  RAISE NOTICE '   - Triggers : assignation livreur → status=assigned';
END $$;

SELECT '✅ Script 037 completed — orders + livreurs + RLS fixés' AS status;