-- Script 028: Fix events and event_tickets public access
-- Date: 2026-03-11
-- Fix: Allow public read access to events and event_tickets for customers

-- 1. Drop old policies on events (keep owners policies)
DROP POLICY IF EXISTS "events_public_read" ON events;
DROP POLICY IF EXISTS "Public can view published events" ON events;

-- 2. Create clean public read policy for events
CREATE POLICY "events_public_read"
ON events FOR SELECT
USING (is_published = true);

-- 3. Drop old policies on event_tickets
DROP POLICY IF EXISTS "event_tickets_public_read" ON event_tickets;
DROP POLICY IF EXISTS "Public can view tickets" ON event_tickets;

-- 4. Create clean public read policy for event_tickets
CREATE POLICY "event_tickets_public_read"
ON event_tickets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_tickets.event_id
    AND e.is_published = true
  )
);

-- 5. Fix ticket_purchases policies for customers
DROP POLICY IF EXISTS "ticket_purchases_insert" ON ticket_purchases;
DROP POLICY IF EXISTS "ticket_purchases_read" ON ticket_purchases;

CREATE POLICY "ticket_purchases_insert"
ON ticket_purchases FOR INSERT
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "ticket_purchases_read"
ON ticket_purchases FOR SELECT
USING (auth.uid() = customer_id);

-- 6. Update event_tickets quantity_sold after purchase
CREATE OR REPLACE FUNCTION update_ticket_quantity_sold()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    UPDATE event_tickets
    SET quantity_sold = quantity_sold + NEW.quantity
    WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ticket_sold_trigger ON ticket_purchases;
CREATE TRIGGER update_ticket_sold_trigger
AFTER INSERT OR UPDATE ON ticket_purchases
FOR EACH ROW
EXECUTE FUNCTION update_ticket_quantity_sold();

SELECT 'Script 028 completed - Events public access fixed' AS status;
