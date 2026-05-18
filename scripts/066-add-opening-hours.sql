-- Ajouter les colonnes manquantes à la table restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{
  "Lun": {"open": "08:00", "close": "22:00", "closed": false},
  "Mar": {"open": "08:00", "close": "22:00", "closed": false},
  "Mer": {"open": "08:00", "close": "22:00", "closed": false},
  "Jeu": {"open": "08:00", "close": "22:00", "closed": false},
  "Ven": {"open": "08:00", "close": "23:00", "closed": false},
  "Sam": {"open": "10:00", "close": "23:00", "closed": false},
  "Dim": {"open": "11:00", "close": "21:00", "closed": false}
}';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS cuisine_type TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_time_min INTEGER DEFAULT 20;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_time_max INTEGER DEFAULT 40;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS min_order INTEGER DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
