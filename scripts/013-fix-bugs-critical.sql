-- 013-fix-bugs-critical.sql
-- Corrections des bugs critiques identifiés dans l'audit

-- 1. Ajouter la colonne created_by à restaurant_invites
ALTER TABLE restaurant_invites ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. Créer la table email_logs
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  type TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Index pour les logs d'email
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_success ON email_logs(success);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

-- 4. RLS pour email_logs (lecture-seule pour super_admin)
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs_super_admin_view" ON email_logs;
CREATE POLICY "email_logs_super_admin_view" ON email_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ));

-- 5. Vérifier que les tables events et ticket_purchases existent avec les bonne colonnes
ALTER TABLE events ADD COLUMN IF NOT EXISTS sold_tickets INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Soirée';
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id);
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS confirmation_sent BOOLEAN DEFAULT false;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(20) UNIQUE;

-- 6. Fonction pour générer un numéro de billet court
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.ticket_number := 'TKT-' || UPPER(SUBSTRING(encode(gen_random_bytes(3), 'hex') FROM 1 FOR 5));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_ticket_number ON ticket_purchases;
CREATE TRIGGER set_ticket_number BEFORE INSERT ON ticket_purchases FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL)
  EXECUTE FUNCTION generate_ticket_number();

COMMIT;
