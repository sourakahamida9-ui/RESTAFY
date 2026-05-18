-- ============================================================================
-- MATERIALIZED VIEWS - Pour billetterie/événements Restafy
-- Refresh périodique pour stats pré-calculées
-- ============================================================================

-- 1. Vue matérialisée: Résumé des événements avec tickets vendus
CREATE MATERIALIZED VIEW IF NOT EXISTS events_summary AS
SELECT 
  e.id AS event_id,
  e.restaurant_id,
  e.title,
  e.start_time,
  e.is_published,
  COUNT(DISTINCT tp.id) AS tickets_sold,
  COALESCE(SUM(tp.amount_paid), 0) AS total_revenue,
  COALESCE(SUM(et.quantity_available), 0) AS total_capacity,
  COALESCE(SUM(et.quantity_sold), 0) AS total_tickets_sold,
  CASE 
    WHEN e.start_time < NOW() THEN 'past'
    WHEN e.start_time < NOW() + INTERVAL '24 hours' THEN 'upcoming'
    ELSE 'future'
  END AS event_status
FROM events e
LEFT JOIN event_tickets et ON et.event_id = e.id
LEFT JOIN ticket_purchases tp ON tp.event_id = e.id AND tp.status = 'confirmed'
GROUP BY e.id, e.restaurant_id, e.title, e.start_time, e.is_published;

-- Index pour recherche rapide
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_summary_id ON events_summary(event_id);
CREATE INDEX IF NOT EXISTS idx_events_summary_restaurant ON events_summary(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_events_summary_status ON events_summary(event_status);

-- 2. Vue matérialisée: Stats restaurant agrégées
CREATE MATERIALIZED VIEW IF NOT EXISTS restaurant_stats AS
SELECT 
  r.id AS restaurant_id,
  r.name,
  r.slug,
  COUNT(DISTINCT o.id) AS total_orders,
  COALESCE(SUM(o.total_amount), 0) AS total_revenue,
  COALESCE(AVG(o.total_amount), 0) AS avg_order_value,
  COUNT(DISTINCT o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '30 days') AS orders_last_30d,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.created_at > NOW() - INTERVAL '30 days'), 0) AS revenue_last_30d,
  COUNT(DISTINCT e.id) FILTER (WHERE e.is_published = true AND e.start_time > NOW()) AS upcoming_events,
  r.avg_rating,
  r.total_reviews
FROM restaurants r
LEFT JOIN orders o ON o.restaurant_id = r.id AND o.status NOT IN ('cancelled')
LEFT JOIN events e ON e.restaurant_id = r.id
GROUP BY r.id, r.name, r.slug, r.avg_rating, r.total_reviews;

-- Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_stats_id ON restaurant_stats(restaurant_id);

-- 3. Vue matérialisée: Leaderboard clients fidélité
CREATE MATERIALIZED VIEW IF NOT EXISTS loyalty_leaderboard AS
SELECT 
  p.id AS user_id,
  p.full_name,
  COALESCE(p.loyalty_points, 0) AS points,
  COALESCE(p.total_orders, 0) AS orders_count,
  RANK() OVER (ORDER BY COALESCE(p.loyalty_points, 0) DESC) AS rank
FROM profiles p
WHERE p.role = 'client' AND p.is_active = true
ORDER BY points DESC
LIMIT 100;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_leaderboard_user ON loyalty_leaderboard(user_id);

-- 4. Fonction pour refresh automatique des vues
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY events_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY restaurant_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY loyalty_leaderboard;
END;
$$ LANGUAGE plpgsql;

-- 5. Créer un job de refresh (toutes les 5 minutes via pg_cron si disponible)
-- Note: pg_cron doit être activé dans Supabase Dashboard > Database > Extensions
-- SELECT cron.schedule('refresh-views', '*/5 * * * *', 'SELECT refresh_materialized_views()');

-- Grant permissions
GRANT SELECT ON events_summary TO authenticated, anon;
GRANT SELECT ON restaurant_stats TO authenticated, anon;
GRANT SELECT ON loyalty_leaderboard TO authenticated, anon;
