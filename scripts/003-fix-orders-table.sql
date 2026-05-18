-- ÉTAPE 3 : Corriger la table orders (colonnes manquantes)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_number       TEXT,
  ADD COLUMN IF NOT EXISTS subtotal           NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS delivery_fee       NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_name      TEXT;

-- Générer automatiquement le numéro de commande
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9999 + 1)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_order_number ON orders;
CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_order_number();
