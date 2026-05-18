-- 024-create-notifications-table.sql
-- Systeme de notifications pour Restafy

-- 1. Add restaurant_id column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 4. Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS notifications_select_own ON notifications;
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_insert_any ON notifications;
CREATE POLICY notifications_insert_any ON notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS notifications_update_own ON notifications;
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 6. Create function to notify on new orders (simplified)
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify restaurant owner via database trigger
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT 
    p.id,
    'new_order',
    'Nouvelle commande!',
    'Commande de ' || COALESCE(NEW.total_amount, 0) || ' FCFA',
    jsonb_build_object('order_id', NEW.id, 'total', NEW.total_amount)
  FROM profiles p
  WHERE p.restaurant_id = NEW.restaurant_id
    AND p.role IN ('restaurant_owner', 'manager');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create trigger for new orders
DROP TRIGGER IF EXISTS trigger_notify_new_order ON orders;
CREATE TRIGGER trigger_notify_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_order();

-- Done!
