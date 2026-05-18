# Restafy User Roles & Authentication

## Three User Types in the System

### 1. **CLIENT** (`role: 'client'`)
Customers who order food and use the loyalty program.

**Supabase Profile:**
```typescript
{
  id: "user_uuid",
  role: "client",
  email: "client@example.com",
  full_name: "Customer Name",
  phone: "+229...",
  avatar_url?: "...",
  has_completed_onboarding: true,
  loyalty_level: "bronze" | "silver" | "gold" | "platinum",
  loyalty_points: 1500,
  default_address?: "Address",
  created_at: "2024-01-15T10:00:00Z"
}
```

**Accessible Pages:**
- `/` - Home (restaurant discovery)
- `/restaurant/:id` - Restaurant detail & menu browsing
- `/cart` - Shopping cart
- `/track/:id` - Order tracking (real-time)
- `/orders` - Order history (all orders with Supabase real-time updates)
- `/loyalty` - Loyalty dashboard with points, tier, achievements
- `/rewards` - Rewards catalogue
- `/leaderboard` - Gamification leaderboard
- `/referral` - Referral program
- `/events` - Event marketplace
- `/my-tickets` - Event tickets purchased

**Data Sources (Supabase):**
- `profiles` table - User profile with loyalty data
- `orders` table - User's order history
- `order_items` table - Items in each order
- `restaurants` table - Available restaurants
- `categories` & `items` - Menu data
- `loyalty_transactions` - Point transactions
- `events` & `event_tickets` - Event data
- Real-time subscriptions on `orders` for live status updates

---

### 2. **RESTAURANT_OWNER** (`role: 'restaurant'`)
Restaurant owners/managers who own the restaurant account.

**Supabase Profile:**
```typescript
{
  id: "owner_uuid",
  role: "restaurant",
  email: "owner@restaurant.bj",
  full_name: "Owner Name",
  restaurant_id: "restaurant_uuid",  // Links to their restaurant
  created_at: "2024-01-01T00:00:00Z"
}
```

**Accessible Pages:**
- `/admin` - Main dashboard (live orders kanban board)
- `/admin/menu` - Menu management (add/edit/delete items with Supabase)
- `/admin/team` - Team management (invite staff, assign roles)
- `/admin/analytics` - Sales analytics & AI insights
- `/admin/settings` - Restaurant settings & payment configuration
- `/admin/events` - Event management (create, edit events)

**Admin Dashboard Features (All Supabase-driven):**
- **Live Order Management:** Real-time order kanban (pending → preparing → ready → delivering → delivered)
- **Menu Editor:** Full CRUD for items, categories, pricing, availability
- **Team Management:** Invite team members by email, assign roles (manager, chef, driver, staff)
- **Payments:** Track USSD & cash payments, settlement reconciliation
- **Analytics:** Daily/weekly/monthly revenue, popular items, peak hours

**Data Sources (Supabase):**
- `restaurants` table - Restaurant info, settings, bank details
- `orders` (filtered by restaurant_id) - Orders for their restaurant
- `items` & `categories` - Their menu
- `team_members` - Staff assigned to restaurant
- `payments` - Payment records
- `analytics_views` (optional materialized view) - Pre-calculated metrics
- Real-time subscriptions on `orders`, `items` for live updates

---

### 3. **TEAM_MEMBER** (`role: 'team_member'`, with `team_role`)
Staff members invited to manage the restaurant (managers, chefs, drivers).

**Supabase Profile:**
```typescript
{
  id: "staff_uuid",
  role: "team_member",
  email: "chef@restaurant.bj",
  full_name: "Chef Name",
  restaurant_id: "restaurant_uuid",  // Which restaurant they work for
  team_role: "manager" | "chef" | "driver" | "staff",
  is_active: true,
  created_at: "2024-01-10T00:00:00Z"
}
```

**Team Members Table (track_members):**
```sql
CREATE TABLE team_members (
  id uuid PRIMARY KEY,
  restaurant_id uuid REFERENCES restaurants(id),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  role text CHECK (role IN ('manager', 'chef', 'driver', 'staff')),
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);
```

**Accessible Pages (Based on `team_role`):**
- **Manager:** Same as Restaurant Owner (full access to `/admin/*`)
- **Chef:** `/admin` (read-only), real-time order updates, kitchen display
- **Driver:** `/admin` (read-only), order tracking, delivery routes
- **Staff:** `/admin` (read-only), basic order status

**Data Sources (Supabase):**
- `team_members` table - Their role and permissions
- `orders` (read-only based on role) - Orders they can see
- `restaurants` (read-only) - Their assigned restaurant
- Row Level Security (RLS) restricts data access by `restaurant_id`

---

## Architecture Overview

### Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Sign In / Sign Up                      │
└─────────────────────────────────────────────────────────┘
                          ↓
            ┌─────────────────────────────┐
            │  Supabase Auth (Email/PWD) │
            └─────────────────────────────┘
                          ↓
      ┌─────────────────────────────────────────────┐
      │  Create Profile with Role Selection         │
      ├─────────────────────────────────────────────┤
      │ - Client: Set loyalty_level to 'bronze'    │
      │ - Restaurant: Create restaurant record      │
      │ - Team: Invited by restaurant owner         │
      └─────────────────────────────────────────────┘
                          ↓
      ┌─────────────────────────────────────────────┐
      │  useAuth Hook Returns:                       │
      │  - user: Supabase auth session             │
      │  - profile: Profile row with role          │
      │  - permissions: Role-based access         │
      └─────────────────────────────────────────────┘
```

### Role-Based Routing

```typescript
// In App.tsx
if (!user) -> <Navigate to="/auth" />
if (!hasOnboarded) -> <Navigate to="/onboarding" />

if (profile.role === 'client') -> Show Client App
if (profile.role === 'restaurant') -> Show Admin Dashboard
if (profile.role === 'team_member') -> Show Team Dashboard
```

### Row Level Security (RLS)

All tables have RLS policies to prevent unauthorized access:

```sql
-- Only clients can view their own orders
CREATE POLICY "clients_view_own_orders" ON orders
FOR SELECT USING (auth.uid() = customer_id);

-- Only restaurant staff can view their restaurant's orders
CREATE POLICY "restaurants_view_own_orders" ON orders
FOR SELECT USING (
  restaurant_id = (
    SELECT restaurant_id FROM restaurants WHERE owner_id = auth.uid()
  )
  OR restaurant_id = (
    SELECT restaurant_id FROM team_members WHERE id = auth.uid()
  )
);
```

---

## Data Flow Examples

### Example 1: Client Places an Order

```
Client Opens App
  ↓
useAuth() fetches profile (role: 'client')
  ↓
Home Page loads restaurants from 'restaurants' table (Supabase)
  ↓
Client selects restaurant → /restaurant/:id
  ↓
useRestaurantMenu() fetches items + categories (Supabase)
  ↓
Client adds items to cart (useOrderCart hook - Zustand)
  ↓
Clicks "Pay Now" → USSD Payment Modal
  ↓
useOrderManager.createOrder() → Inserts to 'orders' table
  ↓
Real-time subscription triggered:
  - Restaurant owner sees order in kanban
  - Client sees order in tracking
  ↓
Order status updated (Supabase) → All subscribers notified
```

### Example 2: Restaurant Owner Manages Team

```
Restaurant Owner logs in
  ↓
useAuth() fetches profile (role: 'restaurant')
  ↓
Navigates to /admin/team
  ↓
TeamManagement.tsx fetches 'team_members' table filtered by restaurant_id
  ↓
Owner clicks "Add Member"
  ↓
Form submitted → Insert into 'team_members' (email, role, restaurant_id)
  ↓
Team member gets email invite
  ↓
Team member signs up with same email
  ↓
Profile created with role: 'team_member' + team_role: 'chef'
  ↓
Team member redirects to /admin (with limited access based on team_role)
```

---

## Key Implementation Files

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client initialization |
| `src/hooks/useAuth.ts` | Authentication state & profile fetching |
| `src/store/useUserStore.ts` | Client-side user preferences (Zustand) |
| `src/pages/Auth.tsx` | Sign up/sign in with role selection |
| `src/App.tsx` | Role-based routing logic |
| `src/pages/admin/Dashboard.tsx` | Restaurant order management (real-time) |
| `src/hooks/useRestaurantAdmin.ts` | Admin data fetching (orders, analytics) |
| `src/pages/Orders.tsx` | Client order history (with real-time updates) |

---

## Supabase Database Schema

**Key Tables:**
- `profiles` - User roles and metadata
- `restaurants` - Restaurant info (owner_id, name, address, etc)
- `team_members` - Staff accounts (restaurant_id, team_role)
- `orders` - Order records (customer_id, restaurant_id, status, total_amount)
- `order_items` - Line items in orders
- `items` - Menu items (restaurant_id, category_id, name, price)
- `categories` - Menu categories (restaurant_id)
- `payments` - Payment records (order_id, method, amount, status)
- `loyalty_transactions` - Point earn/spend history
- `events` - Marketplace events
- `event_tickets` - Purchased event tickets

**RLS Enabled:** All tables have role-based security policies

---

## No Mock Data

All data is sourced from Supabase:
- ✅ Restaurants loaded from `restaurants` table
- ✅ Menu items from `items` + `categories`
- ✅ Orders from `orders` + `order_items` (with real-time subscriptions)
- ✅ Team members from `team_members`
- ✅ Loyalty points from `loyalty_transactions`
- ✅ Real-time updates via PostgreSQL subscriptions

No hardcoded MOCK_DATA arrays in components.
