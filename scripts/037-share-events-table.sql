-- ============================================
-- TABLE: share_events
-- Tracking des partages pour analytics viral
-- ============================================

-- Table share_events
CREATE TABLE IF NOT EXISTS share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('event', 'restaurant', 'menu')),
  entity_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'facebook', 'twitter', 'copy_link', 'download_poster', 'native')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index pour analytics
CREATE INDEX IF NOT EXISTS idx_share_events_entity ON share_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_share_events_platform ON share_events(platform);
CREATE INDEX IF NOT EXISTS idx_share_events_created ON share_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_events_user ON share_events(user_id) WHERE user_id IS NOT NULL;

-- RLS Policies
ALTER TABLE share_events ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut inserer (meme anonyme)
DROP POLICY IF EXISTS "share_events_insert_all" ON share_events;
CREATE POLICY "share_events_insert_all"
  ON share_events FOR INSERT
  WITH CHECK (true);

-- Seuls les admins peuvent lire
DROP POLICY IF EXISTS "share_events_select_admin" ON share_events;
CREATE POLICY "share_events_select_admin"
  ON share_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'restaurant_owner')
    )
  );

-- Vue agregee pour les compteurs publics
CREATE OR REPLACE VIEW share_counts AS
SELECT 
  entity_type,
  entity_id,
  COUNT(*) as total_shares,
  COUNT(DISTINCT user_id) as unique_sharers,
  COUNT(*) FILTER (WHERE platform = 'whatsapp') as whatsapp_shares,
  COUNT(*) FILTER (WHERE platform = 'facebook') as facebook_shares,
  COUNT(*) FILTER (WHERE platform = 'copy_link') as link_copies,
  COUNT(*) FILTER (WHERE platform = 'download_poster') as poster_downloads
FROM share_events
GROUP BY entity_type, entity_id;

-- Fonction pour obtenir le compteur de partages d'un evenement
CREATE OR REPLACE FUNCTION get_share_count(p_entity_type TEXT, p_entity_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM share_events
  WHERE entity_type = p_entity_type AND entity_id = p_entity_id;
$$;

-- Ajouter colonne slug aux events si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'slug'
  ) THEN
    ALTER TABLE events ADD COLUMN slug TEXT UNIQUE;
  END IF;
END $$;

-- Fonction pour generer un slug unique
CREATE OR REPLACE FUNCTION generate_event_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generer slug base sur le titre
  base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  
  -- Verifier unicite
  WHILE EXISTS (SELECT 1 FROM events WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour generer slug automatiquement
DROP TRIGGER IF EXISTS trigger_generate_event_slug ON events;
CREATE TRIGGER trigger_generate_event_slug
  BEFORE INSERT OR UPDATE OF title ON events
  FOR EACH ROW
  WHEN (NEW.slug IS NULL OR NEW.slug = '')
  EXECUTE FUNCTION generate_event_slug();

-- Mettre a jour les events existants sans slug
UPDATE events 
SET slug = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Ajouter colonne slug aux restaurants si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'slug'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN slug TEXT UNIQUE;
  END IF;
END $$;

-- Trigger pour generer slug restaurant
CREATE OR REPLACE FUNCTION generate_restaurant_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  
  WHILE EXISTS (SELECT 1 FROM restaurants WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_restaurant_slug ON restaurants;
CREATE TRIGGER trigger_generate_restaurant_slug
  BEFORE INSERT OR UPDATE OF name ON restaurants
  FOR EACH ROW
  WHEN (NEW.slug IS NULL OR NEW.slug = '')
  EXECUTE FUNCTION generate_restaurant_slug();

-- Mettre a jour les restaurants existants sans slug
UPDATE restaurants 
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Grant permissions
GRANT SELECT ON share_counts TO authenticated;
GRANT EXECUTE ON FUNCTION get_share_count TO authenticated, anon;
