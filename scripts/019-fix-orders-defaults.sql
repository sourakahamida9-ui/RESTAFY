-- 019-fix-orders-defaults.sql
-- Ajoute des valeurs par defaut aux colonnes critiques de la table orders

-- 1. Ajouter des valeurs par defaut pour eviter les erreurs NOT NULL
ALTER TABLE orders 
  ALTER COLUMN subtotal SET DEFAULT 0,
  ALTER COLUMN delivery_fee SET DEFAULT 0,
  ALTER COLUMN discount SET DEFAULT 0;

-- 2. Mettre a jour les commandes existantes avec subtotal NULL
UPDATE orders 
SET subtotal = total_amount 
WHERE subtotal IS NULL;

UPDATE orders 
SET delivery_fee = 0 
WHERE delivery_fee IS NULL;

UPDATE orders 
SET discount = 0 
WHERE discount IS NULL;

-- 3. Verifier que les colonnes sont maintenant NOT NULL avec defaults
-- (Ne pas executer si deja fait)
-- ALTER TABLE orders ALTER COLUMN subtotal SET NOT NULL;
-- ALTER TABLE orders ALTER COLUMN delivery_fee SET NOT NULL;
-- ALTER TABLE orders ALTER COLUMN discount SET NOT NULL;
