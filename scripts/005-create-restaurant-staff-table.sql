-- ÉTAPE 5 : Créer restaurant_staff
-- (le code utilise ce nom, pas team_members)

CREATE TABLE IF NOT EXISTS restaurant_staff (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('manager', 'chef', 'cashier', 'waiter', 'staff', 'livreur')),
  is_active    BOOLEAN DEFAULT true,
  shift_start  TEXT,
  shift_end    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_restaurant ON restaurant_staff(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_profile    ON restaurant_staff(profile_id);
