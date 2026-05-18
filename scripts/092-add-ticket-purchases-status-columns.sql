-- ──────────────────────────────────────────
-- ADD STATUS COLUMNS TO TICKET_PURCHASES TABLE
-- ──────────────────────────────────────────
-- This migration adds the missing columns needed by the webhook
-- to track ticket purchase status and payment confirmation

-- Add status column
ALTER TABLE ticket_purchases 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add confirmed_at column
ALTER TABLE ticket_purchases 
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Add payment_id column
ALTER TABLE ticket_purchases 
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id);

-- Create index on status for performance
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_status ON ticket_purchases(status);

-- Create index on customer_id for performance
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_customer_id ON ticket_purchases(customer_id);

-- Update existing records to have 'pending' status
UPDATE ticket_purchases 
SET status = 'pending' 
WHERE status IS NULL;

-- Update existing records: if is_used is true, set status to 'used'
UPDATE ticket_purchases 
SET status = 'used' 
WHERE is_used = true AND status = 'pending';

-- Update existing records: if qr_scanned_at is not null, set status to 'used'
UPDATE ticket_purchases 
SET status = 'used' 
WHERE qr_scanned_at IS NOT NULL AND status = 'pending';
