-- Migration: Amélioration du système de tokens d'invitation restaurants
-- Ajoute: métadonnées, notes, date d'expiration, historique complet

-- 1. Ajouter nouvelles colonnes à restaurant_invites
ALTER TABLE restaurant_invites
ADD COLUMN IF NOT EXISTS invite_name TEXT,  -- Nom personnalisé du lien
ADD COLUMN IF NOT EXISTS description TEXT,   -- Notes du SuperAdmin
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,  -- Date d'expiration
ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE,  -- Quand utilisé
ADD COLUMN IF NOT EXISTS used_by_email TEXT,  -- Email du restaurant qui a utilisé
ADD COLUMN IF NOT EXISTS used_by_restaurant_name TEXT,  -- Nom du restaurant créé
ADD COLUMN IF NOT EXISTS max_uses INT DEFAULT 1,  -- Nombre d'utilisations max (1 = une seule fois)
ADD COLUMN IF NOT EXISTS created_by_email TEXT;  -- Email du SuperAdmin qui a créé

-- 2. Créer index pour performance
CREATE INDEX IF NOT EXISTS idx_restaurant_invites_token ON restaurant_invites(token);
CREATE INDEX IF NOT EXISTS idx_restaurant_invites_is_used ON restaurant_invites(is_used);
CREATE INDEX IF NOT EXISTS idx_restaurant_invites_expires_at ON restaurant_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_restaurant_invites_created_at ON restaurant_invites(created_at DESC);

-- 3. RLS Policies (si nécessaire, remplacer par les vôtres)
-- Permettre aux super_admin de voir tous les invites
-- C'est déjà géré dans les policies existantes

-- 4. Fonction pour générer des statistiques sur les tokens
CREATE OR REPLACE FUNCTION get_invite_stats()
RETURNS TABLE (
  total_invites INT,
  used_invites INT,
  active_invites INT,
  expired_invites INT,
  expiring_soon INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT as total_invites,
    COUNT(CASE WHEN is_used THEN 1 END)::INT as used_invites,
    COUNT(CASE WHEN NOT is_used AND (expires_at IS NULL OR expires_at > NOW()) THEN 1 END)::INT as active_invites,
    COUNT(CASE WHEN NOT is_used AND expires_at IS NOT NULL AND expires_at < NOW() THEN 1 END)::INT as expired_invites,
    COUNT(CASE WHEN NOT is_used AND expires_at IS NOT NULL AND expires_at > NOW() AND expires_at < NOW() + INTERVAL '3 days' THEN 1 END)::INT as expiring_soon
  FROM restaurant_invites;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger pour mettre à jour automatically le used_at
CREATE OR REPLACE FUNCTION update_invite_used_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_used = TRUE AND OLD.is_used = FALSE THEN
    NEW.used_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invite_used_at ON restaurant_invites;
CREATE TRIGGER trigger_update_invite_used_at
BEFORE UPDATE ON restaurant_invites
FOR EACH ROW
EXECUTE FUNCTION update_invite_used_at();

-- 6. Fonction pour valider un token (avec expiration)
CREATE OR REPLACE FUNCTION validate_invite_token(p_token TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (is_used = FALSE AND (expires_at IS NULL OR expires_at > NOW()))::BOOLEAN as is_valid,
    CASE
      WHEN is_used THEN 'Token déjà utilisé'
      WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'Token expiré'
      WHEN is_used = FALSE AND (expires_at IS NULL OR expires_at > NOW()) THEN 'Token valide'
      ELSE 'Erreur inconnue'
    END as reason
  FROM restaurant_invites
  WHERE token = p_token;
END;
$$ LANGUAGE plpgsql;
