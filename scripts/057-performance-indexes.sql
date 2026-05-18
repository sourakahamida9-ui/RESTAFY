-- Performance indexes for faster restaurant dashboard loading

-- Index sur orders pour les requetes par restaurant
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created ON orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON orders(restaurant_id, status);

-- Index sur profiles pour la recherche par restaurant
CREATE INDEX IF NOT EXISTS idx_profiles_restaurant_id ON profiles(restaurant_id);

-- Index sur restaurants pour owner_id (important pour le fix de liaison)
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);

-- Index sur restaurant_staff
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_restaurant_id ON restaurant_staff(restaurant_id);

-- Index sur order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Index sur livreurs
CREATE INDEX IF NOT EXISTS idx_livreurs_restaurant_id ON livreurs(restaurant_id);

-- Index sur delivery_drivers
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_restaurant_id ON delivery_drivers(restaurant_id);
