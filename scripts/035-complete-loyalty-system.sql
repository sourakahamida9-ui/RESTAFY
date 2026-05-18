-- ============================================================================
-- LOYALTY & REFERRAL SYSTEM - Complete Implementation
-- ============================================================================

-- Add missing columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points_expiry_at TIMESTAMP;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, first_order_completed, active
  referred_first_order_at TIMESTAMP,
  referrer_bonus_awarded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(referrer_id, referred_id)
);

-- Create challenges table
CREATE TABLE IF NOT EXISTS weekly_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  challenge_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  points_reward INTEGER NOT NULL,
  emoji VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(week_start, challenge_type)
);

-- Create challenge progress tracking
CREATE TABLE IF NOT EXISTS challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES weekly_challenges(id) ON DELETE CASCADE,
  progress_value INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, challenge_id)
);

-- Create leaderboard table (for performance)
CREATE TABLE IF NOT EXISTS restaurant_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  total_spent NUMERIC NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(restaurant_id, customer_id)
);

-- Create points expiry alerts
CREATE TABLE IF NOT EXISTS points_expiry_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points_amount INTEGER NOT NULL,
  expiry_date TIMESTAMP NOT NULL,
  alert_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, expiry_date)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_customer ON challenge_progress(customer_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_challenge ON challenge_progress(challenge_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_restaurant ON restaurant_leaderboard(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON restaurant_leaderboard(restaurant_id, rank);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);

-- ============================================================================
-- LOYALTY LEVELS CONFIGURATION (stored in system_settings)
-- ============================================================================
INSERT INTO system_settings (key, category, value, description, is_public) VALUES
('loyalty_levels', 'loyalty', '{
  "bronze": {"min_points": 0, "max_points": 499, "benefits": ["access_standard"]},
  "silver": {"min_points": 500, "max_points": 1499, "benefits": ["free_delivery_once_weekly"]},
  "gold": {"min_points": 1500, "max_points": 3999, "benefits": ["discount_10_percent"]},
  "platinum": {"min_points": 4000, "max_points": 9999, "benefits": ["priority_new_restaurants", "discount_15_percent"]},
  "diamond": {"min_points": 10000, "benefits": ["dedicated_concierge", "discount_20_percent", "vip_events"]}
}'::jsonb, 'Loyalty level definitions and benefits', true)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- TRIGGER: Update loyalty level when points change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_loyalty_level()
RETURNS TRIGGER AS $$
DECLARE
  v_level VARCHAR(20);
BEGIN
  CASE 
    WHEN NEW.loyalty_points >= 10000 THEN v_level := 'diamond';
    WHEN NEW.loyalty_points >= 4000 THEN v_level := 'platinum';
    WHEN NEW.loyalty_points >= 1500 THEN v_level := 'gold';
    WHEN NEW.loyalty_points >= 500 THEN v_level := 'silver';
    ELSE v_level := 'bronze';
  END CASE;
  
  -- If level changed, insert notification
  IF v_level != COALESCE(NEW.loyalty_level, 'bronze') THEN
    INSERT INTO notifications (user_id, type, title, message, emoji, data)
    VALUES (
      NEW.id,
      'loyalty_level_up',
      'Niveau atteint!',
      'Félicitations! Vous êtes passé au niveau ' || v_level,
      CASE v_level
        WHEN 'diamond' THEN '💎'
        WHEN 'platinum' THEN '🏆'
        WHEN 'gold' THEN '🥇'
        WHEN 'silver' THEN '🥈'
        ELSE '🎯'
      END,
      jsonb_build_object('new_level', v_level, 'points', NEW.loyalty_points)
    );
  END IF;
  
  NEW.loyalty_level := v_level;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_loyalty_level_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
WHEN (OLD.loyalty_points IS DISTINCT FROM NEW.loyalty_points)
EXECUTE FUNCTION update_loyalty_level();

-- ============================================================================
-- TRIGGER: Award referrer points when referee completes first order
-- ============================================================================
CREATE OR REPLACE FUNCTION award_referral_bonus()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  -- Find the referrer for this customer
  SELECT referrer_id INTO v_referrer_id
  FROM referrals
  WHERE referred_id = NEW.customer_id AND status = 'pending'
  LIMIT 1;
  
  IF v_referrer_id IS NOT NULL THEN
    -- Award 200 points to referrer
    UPDATE profiles SET loyalty_points = loyalty_points + 200
    WHERE id = v_referrer_id;
    
    -- Update referral status
    UPDATE referrals 
    SET status = 'active', referred_first_order_at = NOW()
    WHERE referrer_id = v_referrer_id AND referred_id = NEW.customer_id;
    
    -- Send notification to referrer
    INSERT INTO notifications (user_id, type, title, message, emoji)
    VALUES (
      v_referrer_id,
      'referral_bonus',
      'Bonus parrainage!',
      'Votre ami a fait sa première commande! +200 points 🎉',
      '💰'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER award_referral_bonus_trigger
AFTER INSERT ON orders
FOR EACH ROW
WHEN (NEW.status = 'delivered')
EXECUTE FUNCTION award_referral_bonus();

-- ============================================================================
-- TRIGGER: Update leaderboard when order completes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' THEN
    -- Insert or update customer in leaderboard
    INSERT INTO restaurant_leaderboard (restaurant_id, customer_id, rank, total_points, total_spent)
    SELECT 
      NEW.restaurant_id,
      NEW.customer_id,
      1,
      COALESCE((SELECT SUM(points_earned) FROM loyalty_transactions WHERE account_id IN (
        SELECT id FROM loyalty_accounts WHERE customer_id = NEW.customer_id AND restaurant_id = NEW.restaurant_id
      )), 0),
      NEW.total_amount
    ON CONFLICT (restaurant_id, customer_id) DO UPDATE SET
      total_spent = restaurant_leaderboard.total_spent + EXCLUDED.total_spent,
      last_updated = NOW();
    
    -- Recalculate ranks for restaurant
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY total_points DESC, total_spent DESC) as new_rank
      FROM restaurant_leaderboard
      WHERE restaurant_id = NEW.restaurant_id
    )
    UPDATE restaurant_leaderboard SET rank = ranked.new_rank
    FROM ranked WHERE restaurant_leaderboard.id = ranked.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_leaderboard_trigger
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_leaderboard();

-- ============================================================================
-- FUNCTION: Generate referral code
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_referral_code(user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  v_code VARCHAR(20);
  v_base_name VARCHAR(20);
  v_counter INTEGER := 0;
BEGIN
  SELECT UPPER(LEFT(full_name, 4)) INTO v_base_name FROM profiles WHERE id = user_id;
  v_code := v_base_name || LPAD(CAST((RANDOM() * 100)::INT AS VARCHAR), 2, '0');
  
  -- Ensure uniqueness
  WHILE EXISTS(SELECT 1 FROM profiles WHERE referral_code = v_code) LOOP
    v_code := v_base_name || LPAD(CAST((RANDOM() * 1000)::INT AS VARCHAR), 3, '0');
    v_counter := v_counter + 1;
    IF v_counter > 10 THEN
      v_code := v_base_name || MD5(CAST(NOW() AS VARCHAR))::VARCHAR(8);
    END IF;
  END LOOP;
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Check and expire points
-- ============================================================================
CREATE OR REPLACE FUNCTION expire_old_points()
RETURNS TABLE(customer_id UUID, points_expired INTEGER) AS $$
BEGIN
  RETURN QUERY
  WITH points_to_expire AS (
    SELECT customer_id, 
           (loyalty_points * 0.1)::INTEGER as amount,
           loyalty_points
    FROM profiles
    WHERE loyalty_points > 0
      AND points_expiry_at IS NOT NULL
      AND points_expiry_at < NOW()
  )
  UPDATE profiles SET loyalty_points = loyalty_points - points_to_expire.amount
  FROM points_to_expire
  WHERE profiles.id = points_to_expire.customer_id
  RETURNING profiles.id, points_to_expire.amount::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_own_view" ON referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

ALTER TABLE weekly_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges_public_read" ON weekly_challenges FOR SELECT
  USING (is_active = true);

ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_own_view" ON challenge_progress FOR SELECT
  USING (auth.uid() = customer_id);

ALTER TABLE restaurant_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaderboard_public_read" ON restaurant_leaderboard FOR SELECT
  USING (true);
