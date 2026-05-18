-- ============================================================================
-- COMPOSITE INDEXES - Optimisation des requêtes fréquentes Restafy
-- ============================================================================

-- 1. Index restaurants actifs avec tri par rating
CREATE INDEX IF NOT EXISTS idx_restaurants_active_rating 
ON restaurants(is_active, avg_rating DESC NULLS LAST);

-- 2. Index items disponibles par restaurant
CREATE INDEX IF NOT EXISTS idx_items_restaurant_available 
ON items(restaurant_id, is_available, category_id);

-- 3. Index categories par restaurant avec tri
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_sort 
ON categories(restaurant_id, sort_order);

-- 4. Index notifications non lues par utilisateur
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, is_read) WHERE is_read = false;

-- 5. Index ticket_purchases pour événements
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_event_status 
ON ticket_purchases(event_id, status);

-- 6. Index profiles par rôle
CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON profiles(role, is_active);

-- 7. Index orders par restaurant et statut
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status 
ON orders(restaurant_id, status);

-- 8. Index orders par client et date
CREATE INDEX IF NOT EXISTS idx_orders_customer_date 
ON orders(customer_id, created_at DESC);

-- 9. Index events par restaurant et publication
CREATE INDEX IF NOT EXISTS idx_events_restaurant_published 
ON events(restaurant_id, is_published, start_time DESC);

-- 10. Index event_tickets par événement
CREATE INDEX IF NOT EXISTS idx_event_tickets_event_price
ON event_tickets(event_id, price);

-- 11. Index loyalty_accounts par customer et restaurant
CREATE INDEX IF NOT EXISTS idx_loyalty_customer_restaurant
ON loyalty_accounts(customer_id, restaurant_id);

-- 12. Index order_items pour analytics
CREATE INDEX IF NOT EXISTS idx_order_items_order_item
ON order_items(order_id, item_id);

-- 13. Index payments par statut
CREATE INDEX IF NOT EXISTS idx_payments_order_status 
ON payments(order_id, status);

-- 14. Index reviews par restaurant
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant
ON reviews(restaurant_id);

-- 15. Index promo_codes actives par restaurant
CREATE INDEX IF NOT EXISTS idx_promo_codes_restaurant_active
ON promo_codes(restaurant_id, is_active);

-- Analyze tables pour mettre à jour les statistiques
ANALYZE restaurants;
ANALYZE orders;
ANALYZE items;
ANALYZE categories;
ANALYZE events;
ANALYZE ticket_purchases;
ANALYZE notifications;
ANALYZE profiles;
