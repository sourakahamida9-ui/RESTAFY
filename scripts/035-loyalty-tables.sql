-- ============================================================================
-- TABLES MANQUANTES POUR LE SYSTÈME DE FIDÉLITÉ COMPLET
-- ============================================================================

-- TABLE: referrals (codes de parrainage)
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id),
  referee_id uuid REFERENCES profiles(id),
  referral_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- pending, active, inactive
  points_earned integer DEFAULT 0,
  discount_applied boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  first_order_at timestamp with time zone,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'inactive'))
);

-- TABLE: weekly_challenges
CREATE TABLE IF NOT EXISTS public.weekly_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  challenge_type text NOT NULL,
  description text NOT NULL,
  target_value integer NOT NULL,
  points_reward integer NOT NULL,
  emoji text DEFAULT '⭐',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- TABLE: challenge_progress (suivi de la progression des challenges par client)
CREATE TABLE IF NOT EXISTS public.challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id),
  challenge_id uuid NOT NULL REFERENCES weekly_challenges(id),
  progress_value integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  points_claimed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(customer_id, challenge_id)
);

-- TABLE: loyalty_leaderboard (top clients par restaurant + global)
CREATE TABLE IF NOT EXISTS public.loyalty_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id),
  restaurant_id uuid REFERENCES restaurants(id),
  rank_position integer,
  total_points integer DEFAULT 0,
  total_orders integer DEFAULT 0,
  avg_order_value numeric DEFAULT 0,
  badge_type text, -- vip, platinum, etc
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(customer_id, restaurant_id, period_start)
);

-- TABLE: points_expiry_log (suivi des points expirés)
CREATE TABLE IF NOT EXISTS public.points_expiry_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id),
  transaction_id uuid REFERENCES loyalty_transactions(id),
  points_expired integer,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- INDEXES POUR LA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_customer ON challenge_progress(customer_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_challenge ON challenge_progress(challenge_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_restaurant ON loyalty_leaderboard(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON loyalty_leaderboard(period_start, period_end);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_expiry_log ENABLE ROW LEVEL SECURITY;

-- Referrals: clients voient leurs propres referrals
CREATE POLICY referrals_customers_view ON referrals FOR SELECT
  USING (referrer_id = auth.uid() OR referee_id = auth.uid());

CREATE POLICY referrals_create ON referrals FOR INSERT
  WITH CHECK (referrer_id = auth.uid());

-- Weekly challenges: tous peuvent les voir
CREATE POLICY challenges_read_all ON weekly_challenges FOR SELECT
  USING (true);

-- Challenge progress: clients voient leur propre progression
CREATE POLICY challenge_progress_view ON challenge_progress FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY challenge_progress_update ON challenge_progress FOR UPDATE
  USING (customer_id = auth.uid());

-- Leaderboard: public
CREATE POLICY leaderboard_read_all ON loyalty_leaderboard FOR SELECT
  USING (true);

-- Points expiry log: clients voient leurs propres expirations
CREATE POLICY points_expiry_view ON points_expiry_log FOR SELECT
  USING (customer_id = auth.uid());

-- ============================================================================
-- FONCTION: Génération automatique des challenges hebdomadaires
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_weekly_challenges()
RETURNS void AS $$
DECLARE
  v_week_start date;
  v_week_end date;
BEGIN
  v_week_start := date_trunc('week', CURRENT_DATE)::date;
  v_week_end := v_week_start + INTERVAL '6 days';

  -- Vérifier si des challenges existent déjà cette semaine
  IF EXISTS (SELECT 1 FROM weekly_challenges WHERE week_start = v_week_start) THEN
    RETURN;
  END IF;

  -- Challenges fixes pour chaque semaine
  INSERT INTO weekly_challenges (week_start, challenge_type, description, target_value, points_reward, emoji) VALUES
    (v_week_start, 'orders', 'Commander 3x cette semaine', 3, 150, '🛍️'),
    (v_week_start, 'new_restaurant', 'Essayer un nouveau restaurant', 1, 100, '✨'),
    (v_week_start, 'early_order', 'Commander avant 12h (3x)', 3, 50, '⏰'),
    (v_week_start, 'share', 'Partager un événement', 1, 75, '📢');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FONCTION: Expiration des points (90 jours)
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_old_points()
RETURNS TABLE(expired_count bigint, total_points_expired integer) AS $$
DECLARE
  v_expiry_date timestamp;
  v_expired_count bigint := 0;
  v_total_points integer := 0;
BEGIN
  v_expiry_date := NOW() - INTERVAL '90 days';

  -- Récupérer les transactions de points non utilisés qui expirent
  WITH expiring_transactions AS (
    SELECT 
      lt.id,
      lt.customer_id,
      lt.points,
      lt.account_id
    FROM loyalty_transactions lt
    WHERE lt.type = 'earned'
      AND lt.created_at < v_expiry_date
      AND lt.points > 0
      AND NOT EXISTS (
        SELECT 1 FROM points_expiry_log pel 
        WHERE pel.transaction_id = lt.id
      )
  ),
  expire_points AS (
    INSERT INTO points_expiry_log (customer_id, transaction_id, points_expired, expires_at)
    SELECT customer_id, id, points, NOW()
    FROM expiring_transactions
    RETURNING points_expired
  )
  SELECT 
    COUNT(*),
    COALESCE(SUM(points_expired), 0)::integer
  INTO v_expired_count, v_total_points
  FROM expire_points;

  -- Décrémenter les points des comptes loyauté
  UPDATE loyalty_accounts
  SET points = GREATEST(0, points - v_total_points)
  WHERE id IN (
    SELECT account_id FROM expiring_transactions
  );

  RETURN QUERY SELECT v_expired_count, v_total_points;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FONCTION: Créer code de parrainage unique
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_referral_code(p_customer_id uuid)
RETURNS text AS $$
DECLARE
  v_code text;
  v_base_name text;
  v_suffix integer := 0;
  v_max_attempts integer := 100;
BEGIN
  -- Récupérer le prénom du client
  SELECT LOWER(SPLIT_PART(full_name, ' ', 1)) 
  INTO v_base_name
  FROM profiles WHERE id = p_customer_id;

  v_base_name := COALESCE(v_base_name, 'user');

  -- Générer un code unique
  WHILE v_suffix < v_max_attempts LOOP
    v_code := v_base_name || v_suffix;
    
    IF NOT EXISTS (SELECT 1 FROM referrals WHERE referral_code = v_code) THEN
      RETURN v_code;
    END IF;
    
    v_suffix := v_suffix + 1;
  END LOOP;

  -- Si impossible, générer un code aléatoire
  RETURN 'ref' || RIGHT(MD5(RANDOM()::text), 6);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FONCTION: Traiter le parrainage (applique la réduction au filleul)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_referral_order(
  p_referee_id uuid,
  p_referral_code text,
  p_order_id uuid
)
RETURNS json AS $$
DECLARE
  v_referrer_id uuid;
  v_referral_id uuid;
  v_discount numeric := 500; -- 500 FCFA de réduction
BEGIN
  -- Trouver le referrer via le code
  SELECT referrer_id, id INTO v_referrer_id, v_referral_id
  FROM referrals
  WHERE referral_code = p_referral_code
  AND status = 'pending'
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Code de parrainage invalide');
  END IF;

  -- Mettre à jour le referral à 'active'
  UPDATE referrals
  SET status = 'active',
      referee_id = p_referee_id,
      first_order_at = NOW(),
      discount_applied = true,
      points_earned = 500  -- Points gagnés par le referrer
  WHERE id = v_referral_id;

  -- Ajouter 200 points au referrer
  INSERT INTO loyalty_transactions (
    customer_id,
    points,
    type,
    description,
    order_id
  ) VALUES (
    v_referrer_id,
    200,
    'earned',
    'Bonus parrainage - Votre ami a commandé!',
    p_order_id
  );

  -- Mettre à jour les points du referrer
  UPDATE profiles
  SET loyalty_points = loyalty_points + 200
  WHERE id = v_referrer_id;

  RETURN json_build_object(
    'success', true,
    'discount', v_discount,
    'referrer_id', v_referrer_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Auto-générer code de parrainage au premier login
-- ============================================================================

CREATE OR REPLACE FUNCTION create_referral_code_on_profile_create()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ajouter colonne referral_code à profiles si elle n'existe pas
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- Trigger
DROP TRIGGER IF EXISTS trigger_create_referral_code ON profiles;
CREATE TRIGGER trigger_create_referral_code
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION create_referral_code_on_profile_create();

-- ============================================================================
-- TRIGGER: Notifier quand un utilisateur monte de niveau
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_level_up()
RETURNS TRIGGER AS $$
DECLARE
  v_old_level text;
  v_new_level text;
BEGIN
  v_old_level := CASE
    WHEN OLD.loyalty_points < 500 THEN 'bronze'
    WHEN OLD.loyalty_points < 1500 THEN 'silver'
    WHEN OLD.loyalty_points < 4000 THEN 'gold'
    WHEN OLD.loyalty_points < 10000 THEN 'platinum'
    ELSE 'diamond'
  END;

  v_new_level := CASE
    WHEN NEW.loyalty_points < 500 THEN 'bronze'
    WHEN NEW.loyalty_points < 1500 THEN 'silver'
    WHEN NEW.loyalty_points < 4000 THEN 'gold'
    WHEN NEW.loyalty_points < 10000 THEN 'platinum'
    ELSE 'diamond'
  END;

  IF v_old_level != v_new_level THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      emoji,
      data
    ) VALUES (
      NEW.id,
      'loyalty_level_up',
      'Nouveau niveau!',
      'Félicitations! Vous êtes passé ' || v_new_level || '!',
      '🎉',
      json_build_object('new_level', v_new_level, 'new_points', NEW.loyalty_points)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_level_up ON profiles;
CREATE TRIGGER trigger_notify_level_up
AFTER UPDATE OF loyalty_points ON profiles
FOR EACH ROW
WHEN (OLD.loyalty_points IS DISTINCT FROM NEW.loyalty_points)
EXECUTE FUNCTION notify_level_up();
