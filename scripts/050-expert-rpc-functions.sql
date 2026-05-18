-- ============================================================================
-- EXPERT RPC FUNCTIONS - Optimizations Restafy
-- Remplace N+1 queries par des jointures RPC intelligentes
-- ============================================================================

-- 1. get_restos_with_events: Restaurants avec leurs événements actifs
CREATE OR REPLACE FUNCTION get_restos_with_events(p_limit INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  logo_url TEXT,
  cuisine_type TEXT,
  avg_rating NUMERIC,
  delivery_time_min INT,
  delivery_time_max INT,
  delivery_fee NUMERIC,
  is_active BOOLEAN,
  events_count BIGINT,
  next_event_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.slug,
    r.logo_url,
    r.cuisine_type,
    r.avg_rating,
    r.delivery_time_min,
    r.delivery_time_max,
    r.delivery_fee,
    r.is_active,
    COUNT(e.id) AS events_count,
    MIN(e.start_time) FILTER (WHERE e.start_time > NOW()) AS next_event_date
  FROM restaurants r
  LEFT JOIN events e ON e.restaurant_id = r.id AND e.is_published = true
  WHERE r.is_active = true
  GROUP BY r.id
  ORDER BY r.avg_rating DESC NULLS LAST, r.name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. get_restaurant_menu_full: Menu complet avec catégories et items en une seule requête
CREATE OR REPLACE FUNCTION get_restaurant_menu_full(p_restaurant_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'restaurant', (
      SELECT json_build_object(
        'id', r.id,
        'name', r.name,
        'slug', r.slug,
        'logo_url', r.logo_url,
        'is_open', r.is_open,
        'delivery_fee', r.delivery_fee,
        'delivery_time_min', r.delivery_time_min,
        'delivery_time_max', r.delivery_time_max
      )
      FROM restaurants r WHERE r.id = p_restaurant_id
    ),
    'categories', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', c.id,
          'name', c.name,
          'description', c.description,
          'sort_order', c.sort_order,
          'items', (
            SELECT COALESCE(json_agg(
              json_build_object(
                'id', i.id,
                'name', i.name,
                'description', i.description,
                'price', i.price,
                'image_url', i.image_url,
                'is_available', i.is_available
              ) ORDER BY i.name
            ), '[]'::json)
            FROM items i
            WHERE i.category_id = c.id AND i.is_available = true
          )
        ) ORDER BY c.sort_order
      ), '[]'::json)
      FROM categories c
      WHERE c.restaurant_id = p_restaurant_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. get_user_dashboard: Dashboard utilisateur complet (commandes, points, notifications)
CREATE OR REPLACE FUNCTION get_user_dashboard(p_user_id UUID)
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'profile', (
      SELECT json_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'phone', p.phone,
        'loyalty_points', COALESCE(p.loyalty_points, 0),
        'total_orders', COALESCE(p.total_orders, 0)
      )
      FROM profiles p WHERE p.id = p_user_id
    ),
    'recent_orders', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', o.id,
          'status', o.status,
          'total_amount', o.total_amount,
          'created_at', o.created_at,
          'restaurant_name', r.name
        ) ORDER BY o.created_at DESC
      ), '[]'::json)
      FROM orders o
      JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.customer_id = p_user_id
      LIMIT 5
    ),
    'unread_notifications', (
      SELECT COUNT(*) FROM notifications n
      WHERE n.user_id = p_user_id AND n.is_read = false
    ),
    'upcoming_events', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', e.id,
          'title', e.title,
          'start_time', e.start_time,
          'ticket_number', tp.ticket_number
        ) ORDER BY e.start_time
      ), '[]'::json)
      FROM ticket_purchases tp
      JOIN events e ON e.id = tp.event_id
      WHERE tp.customer_id = p_user_id
      AND e.start_time > NOW()
      AND tp.status = 'confirmed'
      LIMIT 3
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. get_order_stats: Statistiques de commandes optimisées
CREATE OR REPLACE FUNCTION get_order_stats()
RETURNS TABLE (
  total_orders BIGINT,
  total_revenue NUMERIC,
  avg_order_value NUMERIC,
  orders_today BIGINT,
  revenue_today NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_orders,
    COALESCE(SUM(total_amount), 0)::NUMERIC AS total_revenue,
    COALESCE(AVG(total_amount), 0)::NUMERIC AS avg_order_value,
    COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::BIGINT AS orders_today,
    COALESCE(SUM(total_amount) FILTER (WHERE created_at::date = CURRENT_DATE), 0)::NUMERIC AS revenue_today
  FROM orders
  WHERE status NOT IN ('cancelled', 'refunded');
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. get_restaurant_analytics: Analytics restaurant complet
CREATE OR REPLACE FUNCTION get_restaurant_analytics(
  p_restaurant_id UUID,
  p_days INT DEFAULT 30
)
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'summary', (
      SELECT json_build_object(
        'total_orders', COUNT(*),
        'total_revenue', COALESCE(SUM(total_amount), 0),
        'avg_order_value', COALESCE(AVG(total_amount), 0),
        'completed_orders', COUNT(*) FILTER (WHERE status = 'delivered')
      )
      FROM orders
      WHERE restaurant_id = p_restaurant_id
      AND created_at > NOW() - (p_days || ' days')::INTERVAL
    ),
    'daily_stats', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'date', day::date,
          'orders', COALESCE(order_count, 0),
          'revenue', COALESCE(daily_revenue, 0)
        ) ORDER BY day
      ), '[]'::json)
      FROM generate_series(
        NOW() - (p_days || ' days')::INTERVAL,
        NOW(),
        '1 day'::INTERVAL
      ) AS day
      LEFT JOIN (
        SELECT 
          created_at::date AS order_date,
          COUNT(*) AS order_count,
          SUM(total_amount) AS daily_revenue
        FROM orders
        WHERE restaurant_id = p_restaurant_id
        AND created_at > NOW() - (p_days || ' days')::INTERVAL
        GROUP BY created_at::date
      ) stats ON stats.order_date = day::date
    ),
    'top_items', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'item_name', i.name,
          'quantity_sold', item_stats.qty,
          'revenue', item_stats.rev
        ) ORDER BY item_stats.qty DESC
      ), '[]'::json)
      FROM (
        SELECT 
          oi.item_id,
          SUM(oi.quantity) AS qty,
          SUM(oi.subtotal) AS rev
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.restaurant_id = p_restaurant_id
        AND o.created_at > NOW() - (p_days || ' days')::INTERVAL
        GROUP BY oi.item_id
        ORDER BY qty DESC
        LIMIT 10
      ) item_stats
      JOIN items i ON i.id = item_stats.item_id
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_restos_with_events TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_restaurant_menu_full TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_restaurant_analytics TO authenticated;
