# Testing Guide - Restafy Multi-User System

## Quick Start: Test All 3 User Types

### Setup

1. **Supabase Project Setup**
   - Create a Supabase project or use existing
   - Enable Row Level Security (RLS) on all tables
   - Add required tables (see schema below)

2. **Environment Variables**
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Database Seed** (Run in Supabase SQL Editor)
   ```sql
   -- Insert test restaurant
   INSERT INTO restaurants (owner_id, name, address, phone, is_active)
   VALUES ('owner-uuid-here', 'Chez Maman', 'Cotonou, Haie Vive', '+229XXXXXXXX', true);

   -- Insert test categories
   INSERT INTO categories (restaurant_id, name, sort_order, is_active)
   VALUES 
     ('restaurant-uuid', 'Plats Locaux', 1, true),
     ('restaurant-uuid', 'Boissons', 2, true);

   -- Insert test items
   INSERT INTO items (restaurant_id, category_id, name, description, price, is_available)
   VALUES 
     ('restaurant-uuid', 'category-uuid-1', 'Atassi Complet', 'Riz, haricots, poisson frit', '2500', true),
     ('restaurant-uuid', 'category-uuid-1', 'Pâte Rouge', 'Pâte béninoise traditionnelle', '2000', true),
     ('restaurant-uuid', 'category-uuid-2', 'Jus Bissap', 'Jus frais', '1000', true);
   ```

---

## Test Case 1: CLIENT User Journey

### Scenario: Customer browses restaurants and places an order

**Test Steps:**

1. **Sign Up as Client**
   - Click "Sign Up"
   - Choose "I'm a Customer"
   - Enter email: `client@test.com`
   - Password: `TestPassword123!`
   - Name: `John Doe`
   - Phone: `+22966666666`
   - ✅ Check: Profile created with `role: 'client'`, `loyalty_level: 'bronze'`, `loyalty_points: 0`

2. **Onboarding**
   - Select location: "Cotonou, Haie Vive"
   - Complete onboarding
   - ✅ Check: `has_completed_onboarding: true` in profiles table

3. **Browse Restaurants**
   - Go to Home (`/`)
   - ✅ Check: See "Chez Maman" restaurant
   - Click on restaurant
   - ✅ Check: See menu items from database (Atassi, Pâte Rouge, Jus Bissap)

4. **Place Order**
   - Add items to cart
   - Go to `/cart`
   - Complete checkout with test payment
   - ✅ Check: New order created in `orders` table with status: `pending`
   - ✅ Check: Order items in `order_items` table

5. **View Orders**
   - Go to `/orders`
   - ✅ Check: See placed order in "Active Orders" tab
   - ✅ Check: Shows restaurant name, items, total price
   - ✅ REAL-TIME TEST: Go to admin and update order status → Order status updates on client page without refresh

6. **Track Order**
   - Click order to view details
   - ✅ Check: See real-time status, ETA, items

---

## Test Case 2: RESTAURANT OWNER Journey

### Scenario: Restaurant owner manages menu and orders

**Test Steps:**

1. **Sign Up as Restaurant Owner**
   - Click "Sign Up"
   - Choose "I own a Restaurant"
   - Enter email: `owner@restaurant.bj`
   - Password: `OwnerPass123!`
   - Name: `Proprietaire Maman`
   - Phone: `+22955555555`
   - Restaurant name: `Chez Maman`
   - Address: `Cotonou, Haie Vive`
   - ✅ Check: Profile created with `role: 'restaurant'`, `restaurant_id` populated

2. **Dashboard Access**
   - ✅ Check: Redirected to `/admin`
   - ✅ Check: Can see kanban board (if orders exist)

3. **Menu Management** → `/admin/menu`
   - ✅ Check: See all items from database (no MOCK_MENU)
   - ✅ Check: Can toggle availability on/off
   - ✅ Check: Items saved to database (not in component state)
   - **Add Item:**
     - Click "Add Item"
     - Name: "Bobor"
     - Category: "Plats Locaux"
     - Price: "3000"
     - Submit
     - ✅ Check: New item appears in list AND in database
   - **Delete Item:**
     - Click trash icon on item
     - ✅ Check: Item removed from list AND database

4. **Order Management** → `/admin` (Dashboard)
   - ✅ Check: See orders in kanban columns (pending, preparing, ready, delivering, delivered, cancelled)
   - **Real-Time Update Test:**
     - Have client place new order
     - ✅ Check: New order appears in kanban WITHOUT page refresh
     - Drag order to "Preparing"
     - ✅ Check: Client sees status update on their `/orders` page instantly
     - Continue updating: ready → delivering → delivered
     - ✅ Check: All updates reflected on both sides in real-time

5. **Team Management** → `/admin/team`
   - Click "Add Team Member"
   - Email: `chef@restaurant.bj`
   - Role: "Chef"
   - Submit
   - ✅ Check: Team member created in `team_members` table

---

## Test Case 3: TEAM MEMBER Journey

### Scenario: Chef is invited and manages orders

**Test Steps:**

1. **Receive Invite Email** (Simulated)
   - Owner invited `chef@restaurant.bj` as "Chef"
   - ✅ Check: `team_members` table has entry for `chef@restaurant.bj`

2. **Sign Up as Team Member**
   - Email: `chef@restaurant.bj` (same as invitation)
   - Create password: `ChefPass123!`
   - Full name: `Chef Jean`
   - Phone: `+22944444444`
   - ✅ Check: Profile created with `role: 'team_member'`
   - ✅ Check: `team_members` record links chef to restaurant

3. **Access Restrictions**
   - ✅ Check: Can access `/admin` (limited views)
   - ✅ Check: CANNOT access `/admin/menu` (permissions page or error)
   - ✅ Check: CANNOT access `/admin/team`
   - ✅ Check: CAN see live orders

4. **Order Management** (Chef View)
   - Go to `/admin`
   - ✅ Check: See orders assigned to restaurant
   - ✅ Check: Can update order status (pending → preparing → ready)
   - ✅ Check: Cannot delete orders or access settings
   - ✅ REAL-TIME: When order status changes, client sees it instantly

---

## Test Case 4: Real-Time Subscriptions

### Scenario: Multiple users interact simultaneously

**Test Steps:**

1. **Setup**
   - Open 3 browser windows:
     - Window 1: Client (`client@test.com`)
     - Window 2: Owner (`owner@restaurant.bj`)
     - Window 3: Chef (`chef@restaurant.bj`)

2. **Real-Time Order Update**
   - Window 1 (Client): Go to `/orders`
   - Window 2 (Owner): Go to `/admin`
   - Window 3 (Chef): Go to `/admin`
   - Window 1: Place new order
   - ✅ Check: Order appears in Window 2 AND Window 3 kanban instantly
   - ✅ Check: No page refresh needed
   - Window 2: Drag order to "Preparing"
   - ✅ Check: Window 1 sees status "Préparation" instantly
   - ✅ Check: Window 3 also sees update

3. **Menu Update Reflection**
   - Window 2: Go to `/admin/menu`
   - Window 1: Go to `/restaurant/[id]` (same restaurant)
   - Window 2: Toggle item "Jus Bissap" to unavailable
   - ✅ Check: Window 1 sees item disappear from menu instantly (if subscribed)

---

## Test Case 5: Row Level Security (RLS)

### Scenario: Verify users can only see their own data

**Test Steps:**

1. **Client Privacy**
   - Client A orders from restaurant
   - Client B cannot see Client A's order data
   - ✅ Test: In SQL, run:
     ```sql
     SELECT * FROM orders WHERE customer_id != 'client-a-uuid'
     -- Should be empty if RLS policy works
     ```

2. **Restaurant Privacy**
   - Owner A manages Restaurant 1
   - Owner B manages Restaurant 2
   - Owner A cannot see Restaurant 2's menu/orders
   - ✅ Check: `/admin` only shows orders for their restaurant
   - ✅ Check: `/admin/menu` only shows their items

3. **Team Privacy**
   - Team Member from Restaurant A cannot access Restaurant B data
   - ✅ Check: Team member redirected or denied access

---

## Debugging Checklist

### If Real-Time Updates Don't Work

```bash
# Check 1: Supabase Connection
- In browser console: Check supabase client initialized
- Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct

# Check 2: RLS Policies
- Go to Supabase dashboard → Authentication → Policies
- Ensure policies are ENABLED (toggle on)
- Test policy manually

# Check 3: Subscriptions
- Add console.log in subscription callbacks
- Check browser network tab for WebSocket connections
- Verify realtime extension is enabled

# Check 4: Database
- Confirm tables exist and have correct schema
- Verify records are being inserted
```

### If Menu Items Not Loading

```bash
# Check 1: Restaurant Data
- Verify restaurant_id in profile matches restaurant record
- Confirm items have correct restaurant_id

# Check 2: Query
- Test query in Supabase SQL editor:
  SELECT * FROM items WHERE restaurant_id = 'xxx';

# Check 3: RLS
- Verify items table doesn't have overly restrictive RLS policy
```

### If Orders Not Appearing

```bash
# Check 1: Order Status
- Verify order status is valid: 'pending', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'

# Check 2: Permissions
- Confirm customer_id matches user.id
- Confirm restaurant_id matches restaurant record

# Check 3: Query
- Test in SQL editor:
  SELECT * FROM orders WHERE customer_id = 'xxx';
```

---

## Database Query Tests

Run these in Supabase SQL Editor to verify setup:

```sql
-- Check profiles exist
SELECT id, role, email FROM profiles LIMIT 5;

-- Check restaurants
SELECT id, owner_id, name FROM restaurants;

-- Check menu items
SELECT id, restaurant_id, name, price FROM items;

-- Check orders
SELECT id, customer_id, restaurant_id, status FROM orders;

-- Check team members
SELECT id, restaurant_id, email, role FROM team_members;

-- Check order items
SELECT id, order_id, item_name, quantity FROM order_items;
```

---

## Expected Test Results

| Test | Pass Criteria |
|------|---|
| Client Sign Up | Profile created with `role: 'client'` |
| Restaurant Sign Up | Profile created with `role: 'restaurant'` and `restaurant_id` |
| Team Member Creation | Team member created with `restaurant_id` and `team_role` |
| Menu Loads | No MOCK_MENU, items from database |
| Order Created | Order inserted to database with correct IDs |
| Real-Time Update | Order status change visible instantly (no refresh) |
| RLS Works | Client can't see others' orders |
| Admin Isolation | Only restaurant owner/team can access `/admin` |

---

## Performance Tips

- 🚀 **Optimize queries:** Use `.select('specific_columns')` not `*`
- 🚀 **Pagination:** Add `.range(0, 50)` for large result sets
- 🚀 **Caching:** Use SWR hook for frequent queries
- 🚀 **RLS:** Index `restaurant_id` and `customer_id` for faster filtering

---

## Next: Production Checklist

- [ ] Enable RLS on all tables
- [ ] Set up email verification
- [ ] Configure CORS for mobile app
- [ ] Add payment integration (USSD/Stripe)
- [ ] Set up database backups
- [ ] Enable audit logs
- [ ] Configure email notifications
- [ ] Load test with simulated orders
- [ ] Monitor real-time subscription limits
- [ ] Set up alerting for errors
