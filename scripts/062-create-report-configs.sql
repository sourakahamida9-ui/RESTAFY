-- Table pour les configurations de rapports automatiques
CREATE TABLE IF NOT EXISTS report_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Rapport',
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
  channels JSONB DEFAULT '["email"]'::jsonb,
  recipients JSONB DEFAULT '[]'::jsonb,
  send_time TEXT DEFAULT '08:00',
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
  enabled BOOLEAN DEFAULT true,
  include_metrics JSONB DEFAULT '["revenue", "orders", "avg_ticket"]'::jsonb,
  last_sent TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requetes
CREATE INDEX IF NOT EXISTS idx_report_configs_restaurant ON report_configs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_report_configs_enabled ON report_configs(enabled) WHERE enabled = true;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_report_configs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_report_configs_timestamp ON report_configs;
CREATE TRIGGER update_report_configs_timestamp
  BEFORE UPDATE ON report_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_report_configs_timestamp();

-- RLS
ALTER TABLE report_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owners can manage their report configs"
ON report_configs FOR ALL
USING (
  restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  )
);
