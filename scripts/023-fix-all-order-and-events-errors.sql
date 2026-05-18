-- ============================================================================
-- FIX ALL ORDER AND EVENTS ERRORS - COMPREHENSIVE FIX
-- ============================================================================

-- 1. ENSURE order_items.item_name HAS DEFAULT
ALTER TABLE order_items 
ALTER COLUMN item_name SET DEFAULT 'Unknown Item';

-- 2. ENSURE order_items.item_name CAN ACCEPT NULL OR HAS PROPER CONSTRAINT
ALTER TABLE order_items 
ADD CONSTRAINT item_name_not_null CHECK (item_name IS NOT NULL OR item_id IS NOT NULL);

-- 3. ENSURE events TABLE HAS PROPER TIMESTAMPS
ALTER TABLE events 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- 4. ENSURE events.title IS NOT NULL
ALTER TABLE events
ADD CONSTRAINT events_title_not_null CHECK (title IS NOT NULL);

-- 5. DROP BROKEN RLS POLICIES IF EXIST
DROP POLICY IF EXISTS "events_restaurant_insert" ON events;
DROP POLICY IF EXISTS "events_restaurant_update" ON events;
DROP POLICY IF EXISTS "events_restaurant_delete" ON events;
DROP POLICY IF EXISTS "events_restaurant_select" ON events;

-- 6. ENSURE RLS IS ENABLED ON events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 7. CREATE PROPER RLS POLICIES FOR EVENTS
CREATE POLICY "events_restaurant_owner_crud"
  ON events
  FOR ALL
  USING (
    restaurant_id = (SELECT restaurant_id FROM profiles WHERE auth.uid() = id LIMIT 1)
  );

-- 8. ENSURE order_items HAS PROPER CONSTRAINTS
ALTER TABLE order_items
ALTER COLUMN quantity SET NOT NULL,
ALTER COLUMN unit_price SET NOT NULL;

-- 9. ADD CHECK CONSTRAINT FOR POSITIVE QUANTITIES
ALTER TABLE order_items
ADD CONSTRAINT quantity_positive CHECK (quantity > 0);

-- 10. ENSURE orders.subtotal IS NOT NULL WITH DEFAULT
ALTER TABLE orders
ALTER COLUMN subtotal SET NOT NULL,
ALTER COLUMN subtotal SET DEFAULT 0;

-- 11. ENSURE orders.delivery_fee HAS DEFAULT
ALTER TABLE orders
ALTER COLUMN delivery_fee SET DEFAULT 0;

-- 12. ENSURE orders.discount HAS DEFAULT
ALTER TABLE orders
ALTER COLUMN discount SET DEFAULT 0;
