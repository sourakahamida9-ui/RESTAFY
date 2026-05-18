-- Table pour stocker les contacts email pour les campagnes
CREATE TABLE IF NOT EXISTS email_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  source VARCHAR(50) DEFAULT 'manual', -- manual, csv_import, signup, order
  tags TEXT[] DEFAULT '{}',
  is_subscribed BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour stocker les campagnes email
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  html_content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft', -- draft, sending, sent, failed
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour tracker les envois individuels
CREATE TABLE IF NOT EXISTS email_campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES email_contacts(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, opened, clicked
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_email_contacts_email ON email_contacts(email);
CREATE INDEX IF NOT EXISTS idx_email_contacts_subscribed ON email_contacts(is_subscribed);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaign_sends_campaign ON email_campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_sends_contact ON email_campaign_sends(contact_id);

-- RLS Policies
ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_sends ENABLE ROW LEVEL SECURITY;

-- Superadmin peut tout faire
CREATE POLICY email_contacts_superadmin_all ON email_contacts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY email_campaigns_superadmin_all ON email_campaigns FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY email_campaign_sends_superadmin_all ON email_campaign_sends FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
