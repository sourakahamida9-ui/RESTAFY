-- Ajouter les colonnes pour les actions rapides du restaurant
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_busy BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER DEFAULT 30;

-- Index pour les requetes
CREATE INDEX IF NOT EXISTS idx_restaurants_is_open ON restaurants(is_open) WHERE is_open = true;
CREATE INDEX IF NOT EXISTS idx_restaurants_is_busy ON restaurants(is_busy) WHERE is_busy = true;
