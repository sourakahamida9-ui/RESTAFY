-- ÉTAPE 7 : RLS (Row Level Security) Policies

-- Restaurants : lecture publique
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "restaurants_public_read" ON restaurants;
CREATE POLICY "restaurants_public_read" ON restaurants
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "restaurants_owner_all" ON restaurants;
CREATE POLICY "restaurants_owner_all" ON restaurants
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE restaurant_id = restaurants.id
    )
  );

-- Profiles : lecture/écriture propre
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_own_read" ON profiles;
CREATE POLICY "profiles_own_read" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_own_update" ON profiles;
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Orders : client voit ses commandes, restaurant voit les siennes
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_customer_read" ON orders;
CREATE POLICY "orders_customer_read" ON orders
  FOR SELECT USING (
    auth.uid() = customer_id
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE restaurant_id = orders.restaurant_id
    )
  );

DROP POLICY IF EXISTS "orders_customer_insert" ON orders;
CREATE POLICY "orders_customer_insert" ON orders
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "orders_restaurant_update" ON orders;
CREATE POLICY "orders_restaurant_update" ON orders
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE restaurant_id = orders.restaurant_id
    )
  );

-- order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_read" ON order_items;
CREATE POLICY "order_items_read" ON order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
    OR order_id IN (SELECT id FROM orders WHERE restaurant_id IN (
      SELECT restaurant_id FROM profiles WHERE id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "order_items_insert" ON order_items;
CREATE POLICY "order_items_insert" ON order_items
  FOR INSERT WITH CHECK (true);

-- Notifications : chacun voit les siennes
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_own" ON notifications;
CREATE POLICY "notif_own" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- restaurant_staff
ALTER TABLE restaurant_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_restaurant_read" ON restaurant_staff;
CREATE POLICY "staff_restaurant_read" ON restaurant_staff
  FOR SELECT USING (
    auth.uid() = profile_id
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE restaurant_id = restaurant_staff.restaurant_id
    )
  );

DROP POLICY IF EXISTS "staff_restaurant_manage" ON restaurant_staff;
CREATE POLICY "staff_restaurant_manage" ON restaurant_staff
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE restaurant_id = restaurant_staff.restaurant_id
    )
  );

-- items & categories
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "items_public_read" ON items;
CREATE POLICY "items_public_read" ON items
  FOR SELECT USING (is_available = true);

DROP POLICY IF EXISTS "items_owner_all" ON items;
CREATE POLICY "items_owner_all" ON items
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE restaurant_id = items.restaurant_id
    )
  );

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "categories_owner_all" ON categories;
CREATE POLICY "categories_owner_all" ON categories
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE restaurant_id = categories.restaurant_id
    )
  );
