-- ÉTAPE 1 : Corriger la table restaurants (colonnes manquantes)

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS description        TEXT,
  ADD COLUMN IF NOT EXISTS banner_url         TEXT,
  ADD COLUMN IF NOT EXISTS is_open            BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS cuisine_type       TEXT,
  ADD COLUMN IF NOT EXISTS avg_rating         NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_time_min  INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS delivery_time_max  INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS delivery_fee       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_order          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ussd_mtn           TEXT,
  ADD COLUMN IF NOT EXISTS ussd_moov          TEXT,
  ADD COLUMN IF NOT EXISTS ussd_celtiis       TEXT,
  ADD COLUMN IF NOT EXISTS owner_name         TEXT,
  ADD COLUMN IF NOT EXISTS lat                NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS lng                NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT now();
