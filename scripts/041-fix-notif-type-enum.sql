-- 041-fix-notif-type-enum.sql
-- Fix: Add missing values to notif_type enum

-- Check if enum exists and add missing values
DO $$
BEGIN
  -- Add 'new_order' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'new_order' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notif_type')) THEN
    ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'new_order';
  END IF;

  -- Add 'order_status' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'order_status' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notif_type')) THEN
    ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'order_status';
  END IF;

  -- Add 'order' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'order' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notif_type')) THEN
    ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'order';
  END IF;

  -- Add 'payment' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'payment' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notif_type')) THEN
    ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'payment';
  END IF;

  -- Add 'event' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'event' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notif_type')) THEN
    ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'event';
  END IF;

  -- Add 'promo' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'promo' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notif_type')) THEN
    ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'promo';
  END IF;

  -- Add 'system' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'system' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notif_type')) THEN
    ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'system';
  END IF;

  -- Add 'loyalty' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'loyalty' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notif_type')) THEN
    ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'loyalty';
  END IF;

  -- Add 'review' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'review' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notif_type')) THEN
    ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'review';
  END IF;

EXCEPTION WHEN others THEN
  RAISE NOTICE 'Error adding enum values: %', SQLERRM;
END $$;

-- Alternative approach: If the above doesn't work, convert the column to TEXT
-- Uncomment if needed:
-- ALTER TABLE notifications ALTER COLUMN type TYPE TEXT USING type::TEXT;
