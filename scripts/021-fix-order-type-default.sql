-- Fix order_type column to accept valid values
-- Assurez-vous que order_type a une valeur par défaut et accepte les bonnes valeurs

-- 1. Ajouter une colonne CHECK si elle n'existe pas
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS check_order_type;

ALTER TABLE orders
ADD CONSTRAINT check_order_type 
CHECK (order_type IN ('delivery', 'dine_in', 'pickup', 'takeaway', 'sur_place'));

-- 2. S'assurer que les anciennes valeurs sont converties
UPDATE orders SET order_type = 'pickup' WHERE order_type = 'sur_place';
UPDATE orders SET order_type = 'delivery' WHERE order_type NOT IN ('delivery', 'dine_in', 'pickup', 'takeaway');

-- 3. Ajouter des colonnes manquantes si nécessaire
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS promo_code TEXT;

-- 4. Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status 
ON orders(restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_customer_created 
ON orders(customer_id, created_at DESC);
