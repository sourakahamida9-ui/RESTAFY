-- ════════════════════════════════════════════════════════════════════════════════
-- DATA COLLECTION INFRASTRUCTURE FOR AI/ML (Restafy)
-- Tables: order_events, menu_views, daily_restaurant_stats, stock_alerts, admin_actions
-- Triggers: Auto-log events, daily snapshots via pg_cron
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. ORDER_EVENTS (granular order status changes)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('created', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled')),
  triggered_by VARCHAR(30) NOT NULL CHECK (triggered_by IN ('customer', 'staff', 'auto')),
  duration_since_previous_event_seconds INT,
  staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  device_type VARCHAR(20) CHECK (device_type IN ('mobile', 'desktop', 'pos')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_events_order_id ON order_events(order_id);
CREATE INDEX idx_order_events_restaurant_id ON order_events(restaurant_id);
CREATE INDEX idx_order_events_created_at ON order_events(created_at);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. MENU_VIEWS (customer behavior tracking)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  session_id VARCHAR(100),  -- Anonymous session tracking
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  added_to_cart BOOLEAN DEFAULT FALSE,
  ordered BOOLEAN DEFAULT FALSE,
  time_spent_seconds INT,
  device_type VARCHAR(20)
);

CREATE INDEX idx_menu_views_restaurant_id ON menu_views(restaurant_id);
CREATE INDEX idx_menu_views_item_id ON menu_views(item_id);
CREATE INDEX idx_menu_views_user_id ON menu_views(user_id);
CREATE INDEX idx_menu_views_session_id ON menu_views(session_id);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. DAILY_RESTAURANT_STATS (daily snapshots for ML training)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_restaurant_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  total_orders INT DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  orders_by_hour JSONB,  -- {"08":2, "12":15, "13":18, ...}
  top_items JSONB,  -- [{"item_id": "...", "name": "...", "count": 5}, ...]
  cancelled_orders INT DEFAULT 0,
  avg_prep_time_seconds INT,
  new_customers INT DEFAULT 0,
  returning_customers INT DEFAULT 0,
  weather_condition VARCHAR(50),  -- rainy, sunny, cloudy, etc.
  is_public_holiday BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_daily_stats_unique ON daily_restaurant_stats(restaurant_id, stat_date);
CREATE INDEX idx_daily_stats_created_at ON daily_restaurant_stats(created_at);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. STOCK_ALERTS (inventory tracking)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('low', 'out_of_stock', 'back')),
  reported_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hour_of_day INT CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6),
  orders_lost_estimate INT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_alerts_restaurant_id ON stock_alerts(restaurant_id);
CREATE INDEX idx_stock_alerts_item_id ON stock_alerts(item_id);
CREATE INDEX idx_stock_alerts_created_at ON stock_alerts(created_at);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 5. ADMIN_ACTIONS (audit trail)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_role VARCHAR(50) NOT NULL,
  action_type VARCHAR(100) NOT NULL,  -- menu_edit, price_change, order_cancel, etc.
  entity_type VARCHAR(50),  -- menu_item, restaurant, order, etc.
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_actor_id ON admin_actions(actor_id);
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at);
CREATE INDEX idx_admin_actions_action_type ON admin_actions(action_type);

-- ─────────────────────────────────────────────────────────────────────────────────
-- TRIGGER: Log order status changes to order_events
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_log_order_event()
RETURNS TRIGGER AS $$
DECLARE
  prev_event TIMESTAMP;
  duration_seconds INT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Calculate duration since last event
    SELECT created_at INTO prev_event FROM order_events
    WHERE order_id = NEW.id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF prev_event IS NOT NULL THEN
      duration_seconds := EXTRACT(EPOCH FROM (NOW() - prev_event))::INT;
    END IF;

    INSERT INTO order_events (
      order_id, restaurant_id, event_type, triggered_by,
      duration_since_previous_event_seconds, created_at
    ) VALUES (
      NEW.id, NEW.restaurant_id, NEW.status, 'auto',
      duration_seconds, NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_status_change
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION trigger_log_order_event();

-- ─────────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Create daily restaurant statistics snapshot
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_daily_stats()
RETURNS TABLE(status_code INT, message TEXT) AS $$
DECLARE
  stat_record RECORD;
  restaurant RECORD;
BEGIN
  -- For each restaurant
  FOR restaurant IN SELECT id FROM restaurants WHERE is_active = TRUE
  LOOP
    INSERT INTO daily_restaurant_stats (
      restaurant_id,
      stat_date,
      total_orders,
      total_revenue,
      orders_by_hour,
      top_items,
      cancelled_orders,
      avg_prep_time_seconds,
      new_customers,
      returning_customers
    )
    SELECT
      restaurant.id,
      CURRENT_DATE,
      COUNT(DISTINCT o.id) AS total_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_revenue,
      jsonb_object_agg(
        TO_CHAR(o.created_at, 'HH24'),
        COUNT(*)
      ) AS orders_by_hour,
      jsonb_agg(jsonb_build_object(
        'item_id', oi.item_id,
        'name', mi.name,
        'count', COUNT(oi.id)
      ) ORDER BY COUNT(oi.id) DESC LIMIT 5) AS top_items,
      COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_orders,
      COALESCE(
        ROUND(AVG(EXTRACT(EPOCH FROM (oe_ready.created_at - oe_created.created_at))), 0)::INT,
        0
      ) AS avg_prep_time_seconds,
      COUNT(DISTINCT CASE WHEN p.created_at::DATE = CURRENT_DATE THEN p.id END) AS new_customers,
      COUNT(DISTINCT CASE WHEN p.created_at::DATE < CURRENT_DATE AND o.customer_id = p.id THEN p.id END) AS returning_customers
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN menu_items mi ON oi.item_id = mi.id
    LEFT JOIN profiles p ON o.customer_id = p.id
    LEFT JOIN order_events oe_created ON o.id = oe_created.order_id AND oe_created.event_type = 'created'
    LEFT JOIN order_events oe_ready ON o.id = oe_ready.order_id AND oe_ready.event_type = 'ready'
    WHERE o.restaurant_id = restaurant.id
    AND o.created_at::DATE = CURRENT_DATE
    GROUP BY restaurant.id;

    RETURN QUERY SELECT 200::INT, 'Stats created for ' || restaurant.id;
  END LOOP;

  RETURN QUERY SELECT 200::INT, 'Daily stats created successfully';
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES (allow admins to read their data)
-- ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_restaurant_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Restaurant owners can read order_events for their restaurant
CREATE POLICY "restaurant_owner_can_read_order_events" ON order_events
FOR SELECT USING (
  restaurant_id IN (
    SELECT restaurant_id FROM profiles
    WHERE id = auth.uid() AND restaurant_id IS NOT NULL
  )
);

-- Restaurant owners can read daily_restaurant_stats for their restaurant
CREATE POLICY "restaurant_owner_can_read_daily_stats" ON daily_restaurant_stats
FOR SELECT USING (
  restaurant_id IN (
    SELECT restaurant_id FROM profiles
    WHERE id = auth.uid() AND restaurant_id IS NOT NULL
  )
);

-- Restaurant owners can insert menu_views for their restaurant
CREATE POLICY "anyone_can_insert_menu_views" ON menu_views
FOR INSERT WITH CHECK (TRUE);

-- Restaurant owners can read menu_views for their restaurant
CREATE POLICY "restaurant_owner_can_read_menu_views" ON menu_views
FOR SELECT USING (
  restaurant_id IN (
    SELECT restaurant_id FROM profiles
    WHERE id = auth.uid() AND restaurant_id IS NOT NULL
  )
);

-- Restaurant staff can report stock alerts
CREATE POLICY "staff_can_insert_stock_alerts" ON stock_alerts
FOR INSERT WITH CHECK (
  reported_by = auth.uid()
);

-- Restaurant owners can read stock alerts for their restaurant
CREATE POLICY "restaurant_owner_can_read_stock_alerts" ON stock_alerts
FOR SELECT USING (
  restaurant_id IN (
    SELECT restaurant_id FROM profiles
    WHERE id = auth.uid() AND restaurant_id IS NOT NULL
  )
);

-- Only super admins can read admin_actions
CREATE POLICY "super_admin_can_read_admin_actions" ON admin_actions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- ─────────────────────────────────────────────────────────────────────────────────
-- GRANT PERMISSIONS
-- ─────────────────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT ON order_events TO authenticated;
GRANT SELECT, INSERT ON menu_views TO authenticated;
GRANT SELECT ON daily_restaurant_stats TO authenticated;
GRANT SELECT, INSERT ON stock_alerts TO authenticated;
GRANT SELECT ON admin_actions TO authenticated;
