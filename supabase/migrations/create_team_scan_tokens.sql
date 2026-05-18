-- Création de la table team_scan_tokens pour les accès scan des équipes
-- Permet aux membres de l'équipe de scanner via tokens et PIN

CREATE TABLE IF NOT EXISTS team_scan_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  member_role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  pin TEXT NOT NULL,
  qr_code TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_team_scan_tokens_restaurant_id ON team_scan_tokens(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_team_scan_tokens_token ON team_scan_tokens(token);
CREATE INDEX IF NOT EXISTS idx_team_scan_tokens_is_active ON team_scan_tokens(is_active);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_team_scan_tokens_updated_at
  BEFORE UPDATE ON team_scan_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE team_scan_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Les restaurants peuvent voir leurs propres tokens
CREATE POLICY "Restaurants can view own team scan tokens"
  ON team_scan_tokens
  FOR SELECT
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid()
      OR id IN (SELECT restaurant_id FROM restaurant_staff WHERE profile_id = auth.uid())
    )
  );

-- Policy: Les restaurants peuvent créer leurs propres tokens
CREATE POLICY "Restaurants can create own team scan tokens"
  ON team_scan_tokens
  FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid()
      OR id IN (SELECT restaurant_id FROM restaurant_staff WHERE profile_id = auth.uid() AND role IN ('manager', 'owner'))
    )
  );

-- Policy: Les restaurants peuvent mettre à jour leurs propres tokens
CREATE POLICY "Restaurants can update own team scan tokens"
  ON team_scan_tokens
  FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid()
      OR id IN (SELECT restaurant_id FROM restaurant_staff WHERE profile_id = auth.uid() AND role IN ('manager', 'owner'))
    )
  );

-- Policy: Les restaurants peuvent supprimer leurs propres tokens
CREATE POLICY "Restaurants can delete own team scan tokens"
  ON team_scan_tokens
  FOR DELETE
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid()
      OR id IN (SELECT restaurant_id FROM restaurant_staff WHERE profile_id = auth.uid() AND role IN ('manager', 'owner'))
    )
  );
