-- RESTAFY COMPLETE SCHEMA
-- Target: PostgreSQL (Supabase)

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('super_admin', 'restaurant_owner', 'manager', 'staff', 'livreur', 'client');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled');
CREATE TYPE payment_method AS ENUM ('USSD_MTN', 'USSD_MOOV', 'USSD_CELTIIS', 'CASH');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE order_type AS ENUM ('delivery', 'dine_in', 'takeaway');

-- 2. TABLES

-- Restaurants (Tenants)
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    address TEXT,
    city TEXT DEFAULT 'Cotonou',
    phone TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles (Linked to Auth.Users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT UNIQUE,
    role user_role DEFAULT 'client',
    restaurant_id UUID REFERENCES restaurants(id), -- Null for super_admin and clients
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Menus & Items
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE item_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_override DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES profiles(id),
    status order_status DEFAULT 'pending',
    type order_type NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    delivery_address TEXT,
    delivery_lat_lng POINT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    variant_id UUID REFERENCES item_variants(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    method payment_method NOT NULL,
    status payment_status DEFAULT 'pending',
    amount DECIMAL(12,2) NOT NULL,
    transaction_ref TEXT UNIQUE, -- USSD Transaction ID
    provider_response JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Events & Ticketing
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE event_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    quantity_available INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ticket_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES event_tickets(id),
    customer_id UUID REFERENCES profiles(id),
    qr_code_data TEXT UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Loyalty
CREATE TABLE loyalty_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES profiles(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    points INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI & Analytics
CREATE TABLE ai_data_logs (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id UUID REFERENCES restaurants(id),
    user_id UUID REFERENCES profiles(id),
    action_type TEXT NOT NULL, -- e.g., 'order_created', 'menu_viewed'
    payload JSONB NOT NULL,
    context JSONB, -- Browser, OS, Location
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id),
    event_name TEXT NOT NULL,
    properties JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS POLICIES

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_data_logs ENABLE ROW LEVEL SECURITY;

-- Example RLS: Only staff/owner can see their restaurant's orders
CREATE POLICY "Restaurant staff can view their orders" ON orders
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE restaurant_id = orders.restaurant_id
        )
    );

-- 4. INDEXES
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_items_restaurant_id ON items(restaurant_id);
CREATE INDEX idx_payments_transaction_ref ON payments(transaction_ref);
CREATE INDEX idx_ai_logs_action ON ai_data_logs(action_type);

-- 5. SEED DATA (Benin Context)
INSERT INTO restaurants (name, slug, address, city) VALUES 
('Maquis Le Béninois', 'maquis-beninois', 'Haie Vive', 'Cotonou'),
('Saveurs du Nord', 'saveurs-nord', 'Parakou Centre', 'Parakou');

INSERT INTO categories (restaurant_id, name) 
SELECT id, 'Plats Locaux' FROM restaurants WHERE slug = 'maquis-beninois';

INSERT INTO items (restaurant_id, category_id, name, price, description)
SELECT 
    r.id, 
    c.id, 
    'Igname Pilée + Sauce Arachide', 
    2500, 
    'Le classique béninois avec viande de brousse'
FROM restaurants r, categories c 
WHERE r.slug = 'maquis-beninois' AND c.name = 'Plats Locaux';
