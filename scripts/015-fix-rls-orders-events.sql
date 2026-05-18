-- 015-fix-rls-orders-events.sql
-- Corrections des politiques RLS pour orders, events, et order_items

-- ============================================
-- 1. FIX: Table orders - Permettre INSERT pour les clients authentifies
-- ============================================

-- Supprimer l'ancienne politique si elle existe
DROP POLICY IF EXISTS "orders_insert_authenticated" ON orders;
DROP POLICY IF EXISTS "orders_customer_insert" ON orders;

-- Creer une nouvelle politique pour permettre aux clients de creer des commandes
CREATE POLICY "orders_customer_insert" ON orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Permettre aux clients de voir leurs commandes
DROP POLICY IF EXISTS "orders_customer_read" ON orders;
CREATE POLICY "orders_customer_read" ON orders FOR SELECT
  USING (auth.uid() = customer_id);

-- Permettre aux restaurants de voir les commandes de leur restaurant
DROP POLICY IF EXISTS "orders_restaurant_read" ON orders;
CREATE POLICY "orders_restaurant_read" ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.restaurant_id = orders.restaurant_id
      AND profiles.role IN ('restaurant_owner', 'restaurant', 'manager', 'staff')
    )
  );

-- Permettre aux restaurants de mettre a jour les commandes
DROP POLICY IF EXISTS "orders_restaurant_update" ON orders;
CREATE POLICY "orders_restaurant_update" ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.restaurant_id = orders.restaurant_id
      AND profiles.role IN ('restaurant_owner', 'restaurant', 'manager', 'staff')
    )
  );

-- ============================================
-- 2. FIX: Table order_items - Permettre INSERT apres creation de commande
-- ============================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "order_items_insert_authenticated" ON order_items;
DROP POLICY IF EXISTS "order_items_customer_insert" ON order_items;

-- Permettre l'insertion d'items pour une commande appartenant au client
CREATE POLICY "order_items_customer_insert" ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.customer_id = auth.uid()
    )
  );

-- Permettre la lecture des items pour le client ou le restaurant
DROP POLICY IF EXISTS "order_items_read" ON order_items;
CREATE POLICY "order_items_read" ON order_items FOR SELECT
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

-- ============================================
-- 3. FIX: Table events - Permettre CRUD pour les restaurants
-- ============================================

-- Activer RLS si pas deja fait
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "events_restaurant_insert" ON events;
DROP POLICY IF EXISTS "events_restaurant_all" ON events;
DROP POLICY IF EXISTS "events_public_read" ON events;

-- Lecture publique des evenements publies
CREATE POLICY "events_public_read" ON events FOR SELECT
  USING (is_published = true);

-- Gestion complete pour le proprietaire du restaurant
CREATE POLICY "events_restaurant_owner" ON events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.restaurant_id = events.restaurant_id
      AND profiles.role IN ('restaurant_owner', 'restaurant', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.restaurant_id = events.restaurant_id
      AND profiles.role IN ('restaurant_owner', 'restaurant', 'manager')
    )
  );

-- ============================================
-- 4. FIX: Table restaurants - Permettre UPDATE pour les owners
-- ============================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "restaurants_owner_update" ON restaurants;

-- Permettre aux proprietaires de mettre a jour leur restaurant
CREATE POLICY "restaurants_owner_update" ON restaurants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.restaurant_id = restaurants.id
        OR restaurants.owner_id = auth.uid()
      )
      AND profiles.role IN ('restaurant_owner', 'restaurant')
    )
  );

-- ============================================
-- 5. FIX: Table event_tickets - Permettre CRUD pour les restaurants
-- ============================================

ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_tickets_restaurant_all" ON event_tickets;
DROP POLICY IF EXISTS "event_tickets_public_read" ON event_tickets;

-- Lecture publique
CREATE POLICY "event_tickets_public_read" ON event_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_tickets.event_id
      AND events.is_published = true
    )
  );

-- Gestion complete pour le restaurant
CREATE POLICY "event_tickets_restaurant_manage" ON event_tickets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events
      JOIN profiles ON profiles.restaurant_id = events.restaurant_id
      WHERE events.id = event_tickets.event_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('restaurant_owner', 'restaurant', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      JOIN profiles ON profiles.restaurant_id = events.restaurant_id
      WHERE events.id = event_tickets.event_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('restaurant_owner', 'restaurant', 'manager')
    )
  );

-- ============================================
-- 6. FIX: Supprimer updated_at de order_items si present
-- ============================================

-- Note: order_items n'a pas de colonne updated_at donc on ne fait rien ici
-- Le code useOrderManager sera corrige separement

-- ============================================
-- 7. GRANT permissions explicites
-- ============================================

GRANT SELECT, INSERT ON orders TO authenticated;
GRANT SELECT, INSERT ON order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_tickets TO authenticated;
GRANT SELECT, UPDATE ON restaurants TO authenticated;
