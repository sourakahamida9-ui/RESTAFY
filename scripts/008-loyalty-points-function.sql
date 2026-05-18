-- Fonction pour incrémenter les points de fidélité de façon atomique
CREATE OR REPLACE FUNCTION increment_loyalty_points(p_user_id UUID, p_points INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    loyalty_points = COALESCE(loyalty_points, 0) + p_points,
    loyalty_level = CASE
      WHEN COALESCE(loyalty_points, 0) + p_points >= 5000 THEN 'platinum'::text
      WHEN COALESCE(loyalty_points, 0) + p_points >= 2000 THEN 'gold'::text
      WHEN COALESCE(loyalty_points, 0) + p_points >= 500  THEN 'silver'::text
      ELSE 'bronze'::text
    END
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table de transactions de fidélité pour l'historique
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem')),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_loyalty_transactions_user ON loyalty_transactions(user_id);
CREATE INDEX idx_loyalty_transactions_created ON loyalty_transactions(created_at DESC);

-- RLS pour loyalty_transactions
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY loyalty_transactions_select_own
  ON loyalty_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY loyalty_transactions_insert
  ON loyalty_transactions FOR INSERT
  WITH CHECK (true);
