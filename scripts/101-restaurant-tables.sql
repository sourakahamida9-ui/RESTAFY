-- Script SQL: Création de la table restaurant_tables avec QR codes
-- À exécuter dans Supabase SQL Editor

-- 1. Créer la table restaurant_tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number VARCHAR(20) NOT NULL,
  capacity INT DEFAULT 4,
  position_x INT,
  position_y INT,
  is_active BOOLEAN DEFAULT true,
  qr_code_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, table_number)
);

-- 2. Activer RLS
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Restaurateur peut voir/gérer ses tables
CREATE POLICY "Restaurants can manage their tables" ON restaurant_tables
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('restaurant_owner', 'manager')
    )
  );

-- 4. Ajouter la colonne table_number aux orders (si pas déjà présente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'table_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN table_number VARCHAR(20);
  END IF;
END $$;

-- 5. Index pour performance
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant ON restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_active ON restaurant_tables(restaurant_id, is_active) WHERE is_active = true;

-- 6. Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_restaurant_tables_updated_at ON restaurant_tables;
CREATE TRIGGER update_restaurant_tables_updated_at
  BEFORE UPDATE ON restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ✅ Terminé ! Les tables peuvent maintenant être gérées via /restaurant/dashboard/tables