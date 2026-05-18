-- ÉTAPE 2 : Corriger la table profiles (colonnes manquantes)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email                     TEXT,
  ADD COLUMN IF NOT EXISTS city                      TEXT DEFAULT 'Cotonou',
  ADD COLUMN IF NOT EXISTS address                   TEXT,
  ADD COLUMN IF NOT EXISTS is_active                 BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS avg_order_value           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_orders              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_level             TEXT DEFAULT 'bronze' CHECK (loyalty_level IN ('bronze', 'silver', 'gold', 'platinum')),
  ADD COLUMN IF NOT EXISTS loyalty_points            INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_completed_onboarding  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_cuisines        TEXT[],
  ADD COLUMN IF NOT EXISTS updated_at                TIMESTAMPTZ DEFAULT now();

-- Supprimer la contrainte de rôle si elle existe (elle bloque les rôles du code)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS loyalty_only_for_clients;

-- Mettre à jour les rôles autorisés pour correspondre au code
-- (le code utilise 'restaurant_owner', 'manager', 'staff', 'livreur' — pas 'restaurant')
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'restaurant_owner', 'manager', 'staff', 'livreur', 'client'));
