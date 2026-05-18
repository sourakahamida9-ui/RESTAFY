-- ──────────────────────────────────────────
-- TICKET ORDERS TABLE
-- ──────────────────────────────────────────
-- Separate table for ticket orders to track status and link to purchases

CREATE TABLE IF NOT EXISTS ticket_orders (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  customer_id       UUID        REFERENCES profiles(id),
  customer_name     TEXT        NOT NULL,
  customer_email    TEXT,
  customer_phone    TEXT,
  ticket_type_id    UUID        NOT NULL REFERENCES event_tickets(id),
  quantity          INTEGER     NOT NULL CHECK (quantity > 0),
  unit_price        NUMERIC(12,2) NOT NULL,
  total_amount      NUMERIC(12,2) NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending',
  payment_reference TEXT        UNIQUE,
  payment_method    TEXT,
  payment_provider  TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_orders_event_id ON ticket_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_customer_id ON ticket_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_status ON ticket_orders(status);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_payment_ref ON ticket_orders(payment_reference);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_ticket_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_orders_updated_at
  BEFORE UPDATE ON ticket_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_orders_updated_at();

-- RLS Policies
ALTER TABLE ticket_orders ENABLE ROW LEVEL SECURITY;

-- Everyone can read ticket orders
CREATE POLICY "Public read access for ticket_orders"
  ON ticket_orders FOR SELECT
  USING (true);

-- Only authenticated users can create ticket orders
CREATE POLICY "Users can create ticket_orders"
  ON ticket_orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Users can update their own orders
CREATE POLICY "Users can update own ticket_orders"
  ON ticket_orders FOR UPDATE
  USING (auth.uid() = customer_id);

-- Service role can do anything
CREATE POLICY "Service role full access to ticket_orders"
  ON ticket_orders FOR ALL
  USING (auth.role() = 'service_role');
