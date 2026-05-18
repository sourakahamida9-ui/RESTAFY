-- ============================================================
-- RESTAFY — SUPABASE COMPLETE SETUP
-- ============================================================

-- ============================================================
-- ÉTAPE 1 : EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ÉTAPE 2 : ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'super_admin', 'restaurant_owner', 'manager',
    'staff', 'livreur', 'client'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending', 'confirmed', 'preparing',
    'ready', 'delivering', 'delivered', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM (
    'USSD_MTN', 'USSD_MOOV', 'USSD_CELTIIS', 'CASH'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending', 'completed', 'failed', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_type AS ENUM (
    'delivery', 'dine_in', 'takeaway'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notif_type AS ENUM (
    'order', 'payment', 'loyalty', 'event',
    'team', 'promo', 'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- ÉTAPE 3 : TABLES
-- ============================================================

-- ──────────────────────────────────────────
-- RESTAURANTS (tenants)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        UNIQUE NOT NULL,
  description   TEXT,
  address       TEXT,
  city          TEXT        DEFAULT 'Cotonou',
  phone         TEXT,
  logo_url      TEXT,
  banner_url    TEXT,
  is_active     BOOLEAN     DEFAULT true,
  is_open       BOOLEAN     DEFAULT false,
  cuisine_type  TEXT,
  avg_rating    NUMERIC(3,2) DEFAULT 0,
  total_reviews INTEGER     DEFAULT 0,
  delivery_time_min INTEGER DEFAULT 30,
  delivery_time_max INTEGER DEFAULT 45,
  delivery_fee  NUMERIC(12,2) DEFAULT 1000,
  min_order     NUMERIC(12,2) DEFAULT 0,
  ussd_mtn      TEXT,
  ussd_moov     TEXT,
  ussd_celtiis  TEXT,
  lat           NUMERIC(10,7),
  lng           NUMERIC(10,7),
  settings      JSONB       DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────
-- PROFILES (linked to auth.users)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  phone         TEXT        UNIQUE,
  role          user_role   DEFAULT 'client',
  restaurant_id UUID        REFERENCES restaurants(id) ON DELETE SET NULL,
  avatar_url    TEXT,
  city          TEXT        DEFAULT 'Cotonou',
  address       TEXT,
  is_active     BOOLEAN     DEFAULT true,
  preferred_cuisines TEXT[],
  avg_order_value    NUMERIC(12,2) DEFAULT 0,
  total_orders       INTEGER       DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────
-- RESTAURANT STAFF
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_staff (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  profile_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          user_role   NOT NULL DEFAULT 'staff',
  shift_start   TIME,
  shift_end     TIME,
  is_active     BOOLEAN     DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, profile_id)
);

CREATE TABLE IF NOT EXISTS shifts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_id      UUID        NOT NULL REFERENCES restaurant_staff(id) ON DELETE CASCADE,
  date          DATE        NOT NULL,
  start_time    TIME        NOT NULL,
  end_time      TIME        NOT NULL,
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────
-- MENU
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT,
  image_url     TEXT,
  sort_order    INTEGER     DEFAULT 0,
  is_active     BOOLEAN     DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id   UUID        REFERENCES categories(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  description   TEXT,
  price         NUMERIC(12,2) NOT NULL,
  image_url     TEXT,
  is_available  BOOLEAN     DEFAULT true,
  prep_time_min INTEGER     DEFAULT 15,
  rating        NUMERIC(3,2) DEFAULT 0,
  total_reviews INTEGER     DEFAULT 0,
  total_ordered INTEGER     DEFAULT 0,
  metadata      JSONB       DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_variants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  price_override NUMERIC(12,2),
  is_available  BOOLEAN     DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────
-- ORDERS
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    TEXT        UNIQUE NOT NULL DEFAULT 'ORD-' || LPAD(FLOOR(RANDOM()*99999)::TEXT, 5, '0'),
  restaurant_id   UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  status          order_status DEFAULT 'pending',
  type            order_type   NOT NULL DEFAULT 'delivery',
  subtotal        NUMERIC(12,2) NOT NULL,
  delivery_fee    NUMERIC(12,2) DEFAULT 0,
  discount        NUMERIC(12,2) DEFAULT 0,
  total_amount    NUMERIC(12,2) NOT NULL,
  delivery_address TEXT,
  delivery_lat    NUMERIC(10,7),
  delivery_lng    NUMERIC(10,7),
  notes           TEXT,
  customer_name   TEXT,
  customer_email  TEXT,
  customer_phone  TEXT,
  points_earned   INTEGER     DEFAULT 0,
  points_used     INTEGER     DEFAULT 0,
  confirmed_at    TIMESTAMPTZ,
  preparing_at    TIMESTAMPTZ,
  ready_at        TIMESTAMPTZ,
  delivering_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id       UUID        NOT NULL REFERENCES items(id),
  variant_id    UUID        REFERENCES item_variants(id),
  item_name     TEXT        NOT NULL,
  quantity      INTEGER     NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL,
  subtotal      NUMERIC(12,2) NOT NULL,
  notes         TEXT
);

-- ──────────────────────────────────────────
-- PAYMENTS USSD
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID          REFERENCES orders(id) ON DELETE CASCADE,
  ticket_id       UUID,
  restaurant_id   UUID          NOT NULL REFERENCES restaurants(id),
  method          payment_method NOT NULL,
  status          payment_status DEFAULT 'pending',
  amount          NUMERIC(12,2) NOT NULL,
  ussd_code       TEXT,
  ussd_number     TEXT,
  transaction_ref TEXT,
  confirmed_by    UUID          REFERENCES profiles(id),
  confirmed_at    TIMESTAMPTZ,
  provider_response JSONB,
  created_at      TIMESTAMPTZ   DEFAULT now()
);

-- ──────────────────────────────────────────
-- EVENTS & TICKETING
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ,
  location      TEXT,
  image_url     TEXT,
  is_published  BOOLEAN     DEFAULT false,
  total_capacity INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_tickets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  description       TEXT,
  price             NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_available INTEGER     NOT NULL,
  quantity_sold     INTEGER     DEFAULT 0,
  benefits          TEXT[],
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_purchases (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES events(id),
  ticket_id     UUID        NOT NULL REFERENCES event_tickets(id),
  customer_id   UUID        REFERENCES profiles(id),
  customer_name TEXT        NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  qr_code_data  TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  qr_scanned_at TIMESTAMPTZ,
  is_used       BOOLEAN     DEFAULT false,
  amount_paid   NUMERIC(12,2) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────
-- LOYALTY PROGRAM
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id   UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  points          INTEGER     DEFAULT 0,
  total_earned    INTEGER     DEFAULT 0,
  total_redeemed  INTEGER     DEFAULT 0,
  level           TEXT        DEFAULT 'DÉCOUVREUR',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, restaurant_id)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID        NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL,
  points        INTEGER     NOT NULL,
  description   TEXT,
  order_id      UUID        REFERENCES orders(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rewards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT,
  points_cost   INTEGER     NOT NULL,
  category      TEXT,
  is_active     BOOLEAN     DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────
-- NOTIFICATIONS
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          notif_type  DEFAULT 'system',
  title         TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  emoji         TEXT,
  action_url    TEXT,
  is_read       BOOLEAN     DEFAULT false,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_tokens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token         TEXT        NOT NULL UNIQUE,
  platform      TEXT        DEFAULT 'web',
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

-- ──────────────────────────────────────────
-- REVIEWS
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id      UUID        REFERENCES orders(id),
  rating        INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  restaurant_reply TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_id, customer_id)
);

-- ──────────────────────────────────────────
-- DELIVERY STAFF
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS livreurs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID        NOT NULL REFERENCES profiles(id) UNIQUE,
  restaurant_id UUID        REFERENCES restaurants(id),
  is_available  BOOLEAN     DEFAULT false,
  current_lat   NUMERIC(10,7),
  current_lng   NUMERIC(10,7),
  vehicle_type  TEXT        DEFAULT 'moto',
  rating        NUMERIC(3,2) DEFAULT 0,
  total_deliveries INTEGER  DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  livreur_id    UUID        NOT NULL REFERENCES livreurs(id),
  picked_up_at  TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  distance_km   NUMERIC(8,2),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────
-- AI DATA LOGGING
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_data_logs (
  id              BIGSERIAL   PRIMARY KEY,
  session_id      UUID,
  user_id         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  restaurant_id   UUID        REFERENCES restaurants(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,
  event_data      JSONB       NOT NULL DEFAULT '{}',
  page_url        TEXT,
  device_info     JSONB,
  location_data   JSONB,
  outcome         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID        REFERENCES restaurants(id) ON DELETE CASCADE,
  event_name      TEXT        NOT NULL,
  properties      JSONB,
  user_id         UUID,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_restaurant    ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer      ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_restaurant     ON items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_items_category       ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_available      ON items(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_payments_order       ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments(status);
CREATE INDEX IF NOT EXISTS idx_notifs_user          ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer     ON loyalty_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_restaurant   ON loyalty_accounts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_type         ON ai_data_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created      ON ai_data_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_session      ON ai_data_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event        ON ticket_purchases(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr           ON ticket_purchases(qr_code_data);
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant   ON reviews(restaurant_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE restaurants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_staff  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_variants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tickets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_purchases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE livreurs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_data_logs      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_restaurant_id()
RETURNS UUID AS $$
  SELECT restaurant_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Public: Restaurants
CREATE POLICY "restaurants_public_select" ON restaurants
  FOR SELECT USING (is_active = true);

CREATE POLICY "restaurants_owner_all" ON restaurants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
        AND profiles.restaurant_id = restaurants.id
        AND profiles.role IN ('restaurant_owner', 'manager')
    )
  );

CREATE POLICY "restaurants_superadmin" ON restaurants
  FOR ALL USING (auth_role() = 'super_admin');

-- Profiles
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "profiles_restaurant_staff" ON profiles
  FOR SELECT USING (
    role IN ('staff', 'manager') AND restaurant_id = auth_restaurant_id()
  );

CREATE POLICY "profiles_superadmin" ON profiles
  FOR ALL USING (auth_role() = 'super_admin');

-- Orders - Customers see own
CREATE POLICY "orders_customer" ON orders
  FOR SELECT USING (customer_id = auth.uid());

-- Orders - Restaurants see their own
CREATE POLICY "orders_restaurant" ON orders
  FOR SELECT USING (restaurant_id = auth_restaurant_id() AND auth_role() IN ('manager', 'staff'));

-- Orders - Super admin
CREATE POLICY "orders_superadmin" ON orders
  FOR ALL USING (auth_role() = 'super_admin');

-- Payments - Linked users & restaurants
CREATE POLICY "payments_visibility" ON payments
  FOR SELECT USING (
    restaurant_id = auth_restaurant_id() OR
    EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.customer_id = auth.uid())
  );

-- Notifications
CREATE POLICY "notifications_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Loyalty accounts
CREATE POLICY "loyalty_own" ON loyalty_accounts
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "loyalty_restaurant_staff" ON loyalty_accounts
  FOR SELECT USING (restaurant_id = auth_restaurant_id());
