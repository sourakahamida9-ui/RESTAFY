-- Créer la table restaurant_invites pour les liens d'invitation
CREATE TABLE IF NOT EXISTS restaurant_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  used_by UUID,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP
);

-- Index pour les requêtes rapides
CREATE INDEX IF NOT EXISTS idx_restaurant_invites_token ON restaurant_invites(token);
CREATE INDEX IF NOT EXISTS idx_restaurant_invites_is_used ON restaurant_invites(is_used);

-- RLS Policies
ALTER TABLE restaurant_invites ENABLE ROW LEVEL SECURITY;

-- Public read (pour vérifier les tokens - validation anonyme)
CREATE POLICY "Public can check invite tokens" 
  ON restaurant_invites FOR SELECT 
  USING (true);

-- Admin write
CREATE POLICY "Only admins can create invites"
  ON restaurant_invites FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@restafy.com');

-- Admin update
CREATE POLICY "Only admins can update invites"
  ON restaurant_invites FOR UPDATE
  USING (auth.jwt() ->> 'email' = 'admin@restafy.com');

-- Admin delete
CREATE POLICY "Only admins can delete invites"
  ON restaurant_invites FOR DELETE
  USING (auth.jwt() ->> 'email' = 'admin@restafy.com');
