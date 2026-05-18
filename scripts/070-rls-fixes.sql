-- ============================================================
-- RESTAFY — Correctifs RLS manquants
-- À appliquer dans Supabase > SQL Editor
-- ============================================================

-- 1. ai_data_logs (0 policies)
ALTER TABLE ai_data_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "super_admin_only_ai_logs" ON ai_data_logs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- 2. analytics_events (RLS disabled)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "insert_own_analytics" ON analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY IF NOT EXISTS "read_own_analytics" ON analytics_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "super_admin_read_all_analytics" ON analytics_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- 3. deliveries (0 policies)
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "restaurant_read_deliveries" ON deliveries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o
    JOIN profiles p ON p.id = auth.uid()
    WHERE o.id = deliveries.order_id
      AND (o.restaurant_id = p.restaurant_id OR p.role = 'super_admin')
  ));
CREATE POLICY IF NOT EXISTS "restaurant_manage_deliveries" ON deliveries
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o
    JOIN profiles p ON p.id = auth.uid()
    WHERE o.id = deliveries.order_id
      AND (o.restaurant_id = p.restaurant_id OR p.role = 'super_admin')
  ));

-- 4. item_variants (0 policies)
ALTER TABLE item_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public_read_variants" ON item_variants
  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "restaurant_manage_variants" ON item_variants
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM items i
    JOIN profiles p ON p.id = auth.uid()
    WHERE i.id = item_variants.item_id
      AND (i.restaurant_id = p.restaurant_id OR p.role = 'super_admin')
  ));

-- 5. loyalty_transactions (0 policies)
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "read_own_loyalty_tx" ON loyalty_transactions
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
CREATE POLICY IF NOT EXISTS "system_insert_loyalty_tx" ON loyalty_transactions
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY IF NOT EXISTS "super_admin_loyalty_tx" ON loyalty_transactions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- 6. payments (0 policies)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "customer_read_own_payments" ON payments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = payments.order_id AND o.customer_id = auth.uid()
  ));
CREATE POLICY IF NOT EXISTS "restaurant_read_payments" ON payments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (p.restaurant_id = payments.restaurant_id OR p.role = 'super_admin')
  ));
CREATE POLICY IF NOT EXISTS "system_insert_payments" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = payments.order_id AND o.customer_id = auth.uid()
  ));

-- 7. push_tokens (RLS disabled)
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "manage_own_push_tokens" ON push_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 8. rewards (0 policies)
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public_read_rewards" ON rewards
  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "restaurant_manage_rewards" ON rewards
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (p.restaurant_id = rewards.restaurant_id OR p.role = 'super_admin')
  ));

-- 9. shifts (0 policies)
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "staff_read_own_shifts" ON shifts
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (p.restaurant_id = shifts.restaurant_id OR p.role IN ('super_admin', 'restaurant_owner', 'manager'))
  ));
CREATE POLICY IF NOT EXISTS "manager_manage_shifts" ON shifts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (p.restaurant_id = shifts.restaurant_id OR p.role = 'super_admin')
      AND p.role IN ('restaurant_owner', 'manager', 'super_admin')
  ));

-- 10. ussd_template_history (RLS disabled)
ALTER TABLE ussd_template_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "restaurant_read_ussd_history" ON ussd_template_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (p.restaurant_id = ussd_template_history.restaurant_id OR p.role = 'super_admin')
  ));
CREATE POLICY IF NOT EXISTS "restaurant_insert_ussd_history" ON ussd_template_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (p.restaurant_id = ussd_template_history.restaurant_id OR p.role = 'super_admin')
  ));
