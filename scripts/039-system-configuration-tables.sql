-- ========================================
-- PHASE 1: SYSTEM CONFIGURATION TABLES
-- ========================================

-- 1. System Settings (Global app configuration)
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  is_editable BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now()
);

-- 2. Payment Methods (MTN, Moov, Celtiis, Card, etc.)
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  provider TEXT,
  is_active BOOLEAN DEFAULT true,
  ussd_pattern TEXT,
  api_key TEXT,
  merchant_code TEXT,
  webhook_url TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 3. Order Modes (Delivery, Dine-in, Takeaway, Drive-thru)
CREATE TABLE IF NOT EXISTS order_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 4. App Features (Loyalty, Notifications, Events, etc.)
CREATE TABLE IF NOT EXISTS app_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- 5. Notification Templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title_template TEXT,
  message_template TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_payment_methods_code ON payment_methods(code);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active);
CREATE INDEX IF NOT EXISTS idx_order_modes_code ON order_modes(code);
CREATE INDEX IF NOT EXISTS idx_order_modes_active ON order_modes(is_active);
CREATE INDEX IF NOT EXISTS idx_app_features_name ON app_features(name);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);

-- ========================================
-- INSERT DEFAULT DATA
-- ========================================

-- System Settings Defaults
INSERT INTO system_settings (key, value, description, is_editable) VALUES
  ('app_name', '"Restafy"'::jsonb, 'Application name', true),
  ('app_logo_url', '"/logo.png"'::jsonb, 'App logo URL', true),
  ('currency', '"FCFA"'::jsonb, 'Currency code', false),
  ('currency_symbol', '"₣"'::jsonb, 'Currency symbol', false),
  ('default_timezone', '"Africa/Porto-Novo"'::jsonb, 'Default timezone', true),
  ('delivery_time_minutes', '35'::jsonb, 'Default delivery time in minutes', true),
  ('min_order_value', '500'::jsonb, 'Minimum order value', true),
  ('delivery_fee', '500'::jsonb, 'Default delivery fee', true),
  ('support_email', '"support@restafy.shop"'::jsonb, 'Support email', true),
  ('support_phone', '"+229 97 XX XX XX"'::jsonb, 'Support phone', true)
ON CONFLICT (key) DO NOTHING;

-- Payment Methods Defaults
INSERT INTO payment_methods (name, code, provider, is_active, ussd_pattern, sort_order) VALUES
  ('MTN Mobile Money', 'MTN', 'mtn_benin', true, '*133*1*{amount}*{code}#', 1),
  ('Moov Mobile Money', 'MOOV', 'moov_benin', true, '*155*1*{amount}*{code}#', 2),
  ('Celtiis Cash', 'CELTIIS', 'celtiis_benin', false, '*150*1*{amount}*{code}#', 3),
  ('Carte Bancaire', 'CARD', 'stripe', false, null, 4)
ON CONFLICT (code) DO NOTHING;

-- Order Modes Defaults
INSERT INTO order_modes (name, code, icon, description, is_active, sort_order) VALUES
  ('Livraison', 'delivery', '🚗', 'Livré à votre domicile', true, 1),
  ('Sur place', 'dine_in', '🍽️', 'À manger sur place', true, 2),
  ('À emporter', 'takeaway', '📦', 'À emporter', true, 3),
  ('Drive-thru', 'drive_thru', '🚙', 'Service drive-thru', false, 4)
ON CONFLICT (code) DO NOTHING;

-- App Features Defaults
INSERT INTO app_features (name, is_enabled, description) VALUES
  ('loyalty', true, 'Système de fidélité et points'),
  ('notifications', true, 'Notifications en temps réel'),
  ('events', true, 'Événements et billetterie'),
  ('analytics', true, 'Dashboard analytiques'),
  ('reviews', true, 'Avis et commentaires clients'),
  ('referral', false, 'Système de parrainage')
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can read these)
CREATE POLICY "system_settings_public_read" ON system_settings FOR SELECT USING (true);
CREATE POLICY "payment_methods_public_read" ON payment_methods FOR SELECT USING (true);
CREATE POLICY "order_modes_public_read" ON order_modes FOR SELECT USING (true);
CREATE POLICY "app_features_public_read" ON app_features FOR SELECT USING (true);
CREATE POLICY "notification_templates_public_read" ON notification_templates FOR SELECT USING (true);

-- Admin only write access
CREATE POLICY "system_settings_admin_write" ON system_settings
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

CREATE POLICY "payment_methods_admin_write" ON payment_methods
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

CREATE POLICY "order_modes_admin_write" ON order_modes
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

CREATE POLICY "app_features_admin_write" ON app_features
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

CREATE POLICY "notification_templates_admin_write" ON notification_templates
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));
