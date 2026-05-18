-- Script 029: Ensure ticket_purchases has correct schema
-- This ensures customer_name and qr_code_data columns exist

ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT 'Client';
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS qr_code_data TEXT UNIQUE NOT NULL DEFAULT (gen_random_uuid()::text);
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Remove old incorrect columns if they exist
ALTER TABLE ticket_purchases DROP COLUMN IF EXISTS quantity CASCADE;
ALTER TABLE ticket_purchases DROP COLUMN IF EXISTS total_price CASCADE;
ALTER TABLE ticket_purchases DROP COLUMN IF EXISTS status CASCADE;

-- Update RLS policies to allow users to insert their own purchases
DROP POLICY IF EXISTS "Users can create ticket purchases" ON ticket_purchases;
CREATE POLICY "Users can create ticket purchases"
  ON ticket_purchases FOR INSERT
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their ticket purchases" ON ticket_purchases;
CREATE POLICY "Users can view their ticket purchases"
  ON ticket_purchases FOR SELECT
  USING (customer_id = auth.uid());

SELECT 'Script 029 completed - ticket_purchases schema ensured' AS status;
