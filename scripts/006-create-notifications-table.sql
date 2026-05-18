-- ÉTAPE 6 : Créer notifications

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT CHECK (type IN ('order', 'payment', 'loyalty', 'event', 'team', 'promo', 'system')),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  emoji      TEXT,
  action_url TEXT,
  is_read    BOOLEAN DEFAULT false,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_is_read ON notifications(is_read);
