# Restafy Database Schema

## Overview

Complete Supabase schema for the 3-tier user system with real-time order management, loyalty program, and event marketplace.

---

## Core Tables

### 1. **profiles** (User Accounts & Roles)

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('client', 'restaurant', 'team_member', 'super_admin')),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text,
  avatar_url text,
  
  -- Restaurant Owner Fields
  restaurant_id uuid REFERENCES restaurants(id),
  
  -- Client Fields
  loyalty_level text DEFAULT 'bronze' CHECK (loyalty_level IN ('bronze', 'silver', 'gold', 'platinum')),
  loyalty_points integer DEFAULT 0,
  default_address text,
  
  -- Status
  has_completed_onboarding boolean DEFAULT false,
  is_active boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  
  CONSTRAINT loyalty_only_for_clients CHECK (
    (role = 'client' AND loyalty_level IS NOT NULL) OR
    (role != 'client' AND loyalty_level IS NULL)
  )
);

-- Indexes
CREATE INDEX profiles_role_idx ON profiles(role);
CREATE INDEX profiles_restaurant_id_idx ON profiles(restaurant_id);
CREATE INDEX profiles_email_idx ON profiles(email);
```

**Row Level Security:**
```sql
-- Users can read their own profile
CREATE POLICY "read_own_profile" ON profiles
FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "update_own_profile" ON profiles
FOR UPDATE USING (auth.uid() = id);

-- Restaurant owners can read team members' profiles
CREATE POLICY "owner_read_team" ON profiles
FOR SELECT USING (
  role = 'team_member' AND
  restaurant_id = (SELECT restaurant_id FROM team_members WHERE id = auth.uid())
);
```

---

### 2. **restaurants** (Restaurant Information)

```sql
CREATE TABLE restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  address text NOT NULL,
  phone text NOT NULL,
  email text,
  
  -- Images
  logo_url text,
  cover_image_url text,
  
  -- Settings
  currency text DEFAULT 'XOF',
  timezone text DEFAULT 'Africa/Porto-Novo',
  delivery_fee integer DEFAULT 0,
  min_order_amount integer DEFAULT 0,
  max_delivery_distance_km integer,
  
  -- Status
  is_active boolean DEFAULT true,
  is_verified boolean DEFAULT false,
  
  -- Banking
  bank_account_name text,
  bank_account_number text,
  bank_code text,
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX restaurants_owner_id_idx ON restaurants(owner_id);
CREATE INDEX restaurants_is_active_idx ON restaurants(is_active);
```

**Row Level Security:**
```sql
-- Anyone can read active restaurants
CREATE POLICY "read_active_restaurants" ON restaurants
FOR SELECT USING (is_active = true);

-- Owners can read/update their own restaurant
CREATE POLICY "owner_manage_restaurant" ON restaurants
FOR ALL USING (owner_id = auth.uid());
```

---

### 3. **team_members** (Staff Accounts)

```sql
CREATE TABLE team_members (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  team_role text NOT NULL CHECK (team_role IN ('manager', 'chef', 'driver', 'staff')),
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Permissions
  can_edit_menu boolean DEFAULT false,
  can_manage_orders boolean DEFAULT true,
  can_view_analytics boolean DEFAULT false,
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX team_members_restaurant_id_idx ON team_members(restaurant_id);
CREATE INDEX team_members_team_role_idx ON team_members(team_role);
```

**Row Level Security:**
```sql
-- Team members can read their own record
CREATE POLICY "read_own_team" ON team_members
FOR SELECT USING (id = auth.uid());

-- Owners can manage their team
CREATE POLICY "owner_manage_team" ON team_members
FOR ALL USING (
  restaurant_id = (SELECT restaurant_id FROM profiles WHERE id = auth.uid() AND role = 'restaurant')
);
```

---

## Menu Tables

### 4. **categories** (Menu Categories)

```sql
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX categories_restaurant_id_idx ON categories(restaurant_id);
```

---

### 5. **items** (Menu Items)

```sql
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  
  name text NOT NULL,
  description text,
  image_url text,
  
  price numeric(10, 2) NOT NULL,
  compare_price numeric(10, 2),
  
  -- Availability
  is_available boolean DEFAULT true,
  prep_time_minutes integer DEFAULT 15,
  
  -- Inventory
  track_inventory boolean DEFAULT false,
  inventory_quantity integer,
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX items_restaurant_id_idx ON items(restaurant_id);
CREATE INDEX items_category_id_idx ON items(category_id);
CREATE INDEX items_is_available_idx ON items(is_available);
```

**Row Level Security:**
```sql
-- Clients can read available items
CREATE POLICY "read_available_items" ON items
FOR SELECT USING (is_available = true);

-- Owners/team can manage their items
CREATE POLICY "owner_manage_items" ON items
FOR ALL USING (
  restaurant_id = (
    SELECT restaurant_id FROM profiles WHERE id = auth.uid() AND role = 'restaurant'
  ) OR
  restaurant_id = (
    SELECT restaurant_id FROM team_members WHERE id = auth.uid()
  )
);
```

---

## Order Tables

### 6. **orders** (Order Records)

```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'
  )),
  
  -- Pricing
  subtotal numeric(10, 2) NOT NULL,
  delivery_fee numeric(10, 2) DEFAULT 0,
  tax numeric(10, 2) DEFAULT 0,
  total_amount numeric(10, 2) NOT NULL,
  
  -- Delivery
  delivery_address text,
  delivery_instructions text,
  estimated_delivery timestamp,
  delivered_at timestamp,
  
  -- Notes
  special_requests text,
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX orders_customer_id_idx ON orders(customer_id);
CREATE INDEX orders_restaurant_id_idx ON orders(restaurant_id);
CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX orders_created_at_idx ON orders(created_at);
```

**Row Level Security:**
```sql
-- Clients see their own orders
CREATE POLICY "read_own_orders" ON orders
FOR SELECT USING (customer_id = auth.uid());

-- Restaurant staff see their orders
CREATE POLICY "read_restaurant_orders" ON orders
FOR SELECT USING (
  restaurant_id = (SELECT restaurant_id FROM profiles WHERE id = auth.uid() AND role = 'restaurant')
  OR
  restaurant_id = (SELECT restaurant_id FROM team_members WHERE id = auth.uid())
);

-- Staff can update order status
CREATE POLICY "update_restaurant_orders" ON orders
FOR UPDATE USING (
  restaurant_id = (SELECT restaurant_id FROM profiles WHERE id = auth.uid() AND role = 'restaurant')
  OR
  restaurant_id = (SELECT restaurant_id FROM team_members WHERE id = auth.uid())
);
```

---

### 7. **order_items** (Line Items in Orders)

```sql
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id),
  
  item_name text NOT NULL,
  item_description text,
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric(10, 2) NOT NULL,
  
  special_instructions text,
  
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX order_items_order_id_idx ON order_items(order_id);
```

---

## Payment Tables

### 8. **payments** (Payment Records)

```sql
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  method text NOT NULL CHECK (method IN ('ussd', 'card', 'wallet', 'cash')),
  amount numeric(10, 2) NOT NULL,
  
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'completed', 'failed', 'refunded'
  )),
  
  -- Payment Gateway
  gateway text,
  transaction_id text UNIQUE,
  reference_number text,
  
  -- Metadata
  metadata jsonb,
  
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX payments_order_id_idx ON payments(order_id);
CREATE INDEX payments_status_idx ON payments(status);
```

---

## Loyalty Tables

### 9. **loyalty_transactions** (Point History)

```sql
CREATE TABLE loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  points integer NOT NULL,
  type text NOT NULL CHECK (type IN ('earn', 'spend', 'bonus', 'expire')),
  
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  description text,
  
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX loyalty_transactions_customer_id_idx ON loyalty_transactions(customer_id);
CREATE INDEX loyalty_transactions_type_idx ON loyalty_transactions(type);
```

---

## Event Tables

### 10. **events** (Marketplace Events)

```sql
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  name text NOT NULL,
  description text,
  image_url text,
  
  event_date timestamp NOT NULL,
  event_time time,
  location text,
  
  price numeric(10, 2) NOT NULL,
  capacity integer,
  
  is_active boolean DEFAULT true,
  
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX events_restaurant_id_idx ON events(restaurant_id);
CREATE INDEX events_event_date_idx ON events(event_date);
```

---

### 11. **event_tickets** (Purchased Tickets)

```sql
CREATE TABLE event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  quantity integer DEFAULT 1,
  total_price numeric(10, 2),
  
  ticket_code text UNIQUE,
  is_scanned boolean DEFAULT false,
  scanned_at timestamp,
  
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX event_tickets_event_id_idx ON event_tickets(event_id);
CREATE INDEX event_tickets_customer_id_idx ON event_tickets(customer_id);
```

---

## Notification Tables

### 12. **notifications** (User Notifications)

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  title text NOT NULL,
  message text NOT NULL,
  type text CHECK (type IN ('order', 'loyalty', 'promotion', 'system')),
  
  related_order_id uuid REFERENCES orders(id),
  is_read boolean DEFAULT false,
  
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX notifications_user_id_idx ON notifications(user_id);
CREATE INDEX notifications_is_read_idx ON notifications(is_read);
```

---

## Analytics Tables (Optional - Materialized Views)

### 13. **daily_sales** (Pre-calculated Analytics)

```sql
CREATE MATERIALIZED VIEW daily_sales AS
SELECT
  restaurant_id,
  DATE(created_at) as sale_date,
  COUNT(*) as total_orders,
  SUM(total_amount) as total_revenue,
  AVG(total_amount) as avg_order_value,
  COUNT(DISTINCT customer_id) as unique_customers
FROM orders
WHERE status IN ('delivered', 'completed')
GROUP BY restaurant_id, DATE(created_at)
ORDER BY restaurant_id, sale_date DESC;

CREATE INDEX daily_sales_restaurant_idx ON daily_sales(restaurant_id);
```

---

## Enum Types

```sql
-- If using PostgreSQL enums (recommended)
CREATE TYPE user_role AS ENUM ('client', 'restaurant', 'team_member', 'super_admin');
CREATE TYPE team_role AS ENUM ('manager', 'chef', 'driver', 'staff');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled');
CREATE TYPE loyalty_level AS ENUM ('bronze', 'silver', 'gold', 'platinum');
```

---

## RLS Policy Summary

| Table | Client Can | Owner Can | Team Can |
|-------|-----------|-----------|----------|
| profiles | Read own | Manage own | Read own |
| restaurants | Read active | Update own | Read own |
| team_members | - | Manage | Read own |
| items | Read available | CRUD | Read |
| categories | Read active | CRUD | Read |
| orders | Read own | Read/Update own | Read/Update own |
| order_items | Read own | Read own | Read own |
| payments | Read own | Read own | Read own |
| loyalty_transactions | Read own | - | - |
| events | Read active | CRUD | - |
| event_tickets | Read own | View all | - |

---

## Setup Checklist

- [ ] Create all tables in Supabase
- [ ] Enable RLS on each table
- [ ] Create all RLS policies
- [ ] Create indexes for performance
- [ ] Set up Realtime subscriptions
- [ ] Configure backups
- [ ] Test data insertion
- [ ] Verify queries in SQL editor
- [ ] Enable audit logs
- [ ] Set up foreign key constraints

---

## Connection in Code

```typescript
// Example: useRestaurants() hook
const { data } = await supabase
  .from('restaurants')
  .select('*')
  .eq('is_active', true)
  .order('name');

// Example: Real-time subscription
supabase
  .channel(`orders:restaurant_id=${restaurantId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders',
    filter: `restaurant_id=eq.${restaurantId}`
  }, (payload) => {
    // Handle order updates
  })
  .subscribe();
```

---

## Useful SQL Queries

```sql
-- Get restaurant with menu stats
SELECT
  r.id, r.name,
  COUNT(DISTINCT c.id) as category_count,
  COUNT(DISTINCT i.id) as item_count
FROM restaurants r
LEFT JOIN categories c ON r.id = c.restaurant_id
LEFT JOIN items i ON c.id = i.category_id
GROUP BY r.id, r.name;

-- Get today's sales
SELECT
  restaurant_id,
  COUNT(*) as orders,
  SUM(total_amount) as revenue
FROM orders
WHERE DATE(created_at) = TODAY()
GROUP BY restaurant_id;

-- Get customer loyalty ranking
SELECT
  id, full_name,
  loyalty_level, loyalty_points,
  ROW_NUMBER() OVER (ORDER BY loyalty_points DESC) as rank
FROM profiles
WHERE role = 'client'
LIMIT 100;
```
