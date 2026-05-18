-- Script 022: Fix events RLS policies for restaurant owners
-- This script ensures restaurant owners can create, read, update, and delete events

-- Drop existing policies if any
DROP POLICY IF EXISTS events_public_read ON events;
DROP POLICY IF EXISTS events_restaurant_owner ON events;
DROP POLICY IF EXISTS events_owner_insert ON events;
DROP POLICY IF EXISTS events_owner_update ON events;
DROP POLICY IF EXISTS events_owner_delete ON events;

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 1. Public can read published events
CREATE POLICY events_public_read ON events
  FOR SELECT
  USING (is_published = true);

-- 2. Restaurant owners can do everything on their events
CREATE POLICY events_owner_all ON events
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 3. Super admins can do everything
CREATE POLICY events_admin_all ON events
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
