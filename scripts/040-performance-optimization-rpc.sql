-- Function RPC pour récupérer les stats des commandes (agrégation côté BD)
CREATE OR REPLACE FUNCTION get_order_stats()
RETURNS TABLE (total_revenue NUMERIC, count_orders BIGINT) AS $$
SELECT
  COALESCE(SUM(total_amount), 0) as total_revenue,
  COUNT(*) as count_orders
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days';
$$ LANGUAGE SQL STABLE PARALLEL SAFE;
