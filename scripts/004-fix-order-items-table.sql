-- ÉTAPE 4 : Ajouter item_name dans order_items

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS item_name TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
