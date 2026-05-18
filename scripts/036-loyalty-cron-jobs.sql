-- ============================================================================
-- CRON JOBS FOR LOYALTY SYSTEM
-- ============================================================================
-- This file contains PostgreSQL cron functions to be run via pg_cron extension
-- Install via: CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- FUNCTION: Handle points expiry (runs weekly)
-- ============================================================================
-- Points expire 90 days after being earned
-- They start losing 10% per week after 90 days
CREATE OR REPLACE FUNCTION expire_old_points_job()
RETURNS void AS $$
DECLARE
  v_affected_count INTEGER;
BEGIN
  -- Find customers with points older than 90 days
  WITH points_to_expire AS (
    SELECT 
      customer_id,
      (loyalty_points * 0.1)::INTEGER as amount_to_expire
    FROM profiles
    WHERE loyalty_points > 0
      AND points_expiry_at IS NOT NULL
      AND points_expiry_at < NOW()
  )
  UPDATE profiles 
  SET loyalty_points = loyalty_points - points_to_expire.amount_to_expire
  FROM points_to_expire
  WHERE profiles.id = points_to_expire.customer_id;
  
  GET DIAGNOSTICS v_affected_count = ROW_COUNT;
  
  -- Log the action
  INSERT INTO ai_data_logs (user_id, event_type, outcome, event_data, created_at)
  SELECT 
    NULL,
    'points_expiry',
    'success',
    jsonb_build_object('affected_customers', v_affected_count, 'timestamp', NOW()),
    NOW();
  
  RAISE NOTICE 'Points expiry job completed. Affected: % customers', v_affected_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Send expiry warnings (runs 3x per week)
-- ============================================================================
-- Alert customers 14 days before their points expire
CREATE OR REPLACE FUNCTION send_points_expiry_alerts_job()
RETURNS void AS $$
DECLARE
  v_alert_count INTEGER;
BEGIN
  WITH expiring_soon AS (
    SELECT 
      id as customer_id,
      loyalty_points,
      points_expiry_at
    FROM profiles
    WHERE loyalty_points > 0
      AND points_expiry_at IS NOT NULL
      AND points_expiry_at BETWEEN NOW() AND NOW() + INTERVAL '14 days'
      AND points_expiry_at > NOW()
  )
  INSERT INTO points_expiry_alerts (customer_id, points_amount, expiry_date, created_at)
  SELECT 
    customer_id,
    loyalty_points,
    points_expiry_at,
    NOW()
  FROM expiring_soon
  ON CONFLICT (customer_id, expiry_date) DO NOTHING;
  
  GET DIAGNOSTICS v_alert_count = ROW_COUNT;
  
  -- Send notifications for new alerts
  INSERT INTO notifications (user_id, type, title, message, emoji, data)
  SELECT 
    pea.customer_id,
    'points_expiring',
    '⚠️ Points en danger!',
    'Vous avez ' || pea.points_amount || ' points qui expirent dans 14 jours. Commandez maintenant!',
    '⚠️',
    jsonb_build_object('points_expiring', pea.points_amount, 'expiry_date', pea.expiry_date)
  FROM points_expiry_alerts pea
  WHERE pea.alert_sent_at IS NULL
    AND pea.created_at > NOW() - INTERVAL '1 hour';
  
  RAISE NOTICE 'Expiry alert job completed. Alerts sent: % customers', v_alert_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Generate weekly challenges (runs every Monday)
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_weekly_challenges_job()
RETURNS void AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_challenge_id UUID;
BEGIN
  -- Calculate week boundaries
  v_week_start := DATE_TRUNC('week', NOW())::DATE;
  v_week_end := v_week_start + INTERVAL '6 days'::INTERVAL;
  
  -- Check if challenges already exist for this week
  IF EXISTS(
    SELECT 1 FROM weekly_challenges 
    WHERE week_start = v_week_start
  ) THEN
    RAISE NOTICE 'Challenges already exist for this week. Skipping generation.';
    RETURN;
  END IF;
  
  -- Challenge 1: Order multiple times
  INSERT INTO weekly_challenges (
    week_start, week_end, challenge_type, description, 
    target_value, points_reward, emoji, is_active
  ) VALUES (
    v_week_start, v_week_end, 'order_count',
    'Commander 3 fois cette semaine', 3, 150, '🛒', true
  ) RETURNING id INTO v_challenge_id;
  
  -- Challenge 2: Try new restaurant
  INSERT INTO weekly_challenges (
    week_start, week_end, challenge_type, description,
    target_value, points_reward, emoji, is_active
  ) VALUES (
    v_week_start, v_week_end, 'new_restaurant',
    'Essayer un nouveau restaurant', 1, 100, '🍽️', true
  ) RETURNING id INTO v_challenge_id;
  
  -- Challenge 3: Order before noon
  INSERT INTO weekly_challenges (
    week_start, week_end, challenge_type, description,
    target_value, points_reward, emoji, is_active
  ) VALUES (
    v_week_start, v_week_end, 'early_order',
    'Commander avant 12h du matin', 2, 50, '⏰', true
  ) RETURNING id INTO v_challenge_id;
  
  -- Challenge 4: Share event
  INSERT INTO weekly_challenges (
    week_start, week_end, challenge_type, description,
    target_value, points_reward, emoji, is_active
  ) VALUES (
    v_week_start, v_week_end, 'share_event',
    'Partager un événement', 1, 75, '🎉', true
  ) RETURNING id INTO v_challenge_id;
  
  RAISE NOTICE 'Weekly challenges generated for week of %', v_week_start;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Reset monthly leaderboard and award rewards (runs 1st of month)
-- ============================================================================
CREATE OR REPLACE FUNCTION reset_monthly_leaderboard_job()
RETURNS void AS $$
DECLARE
  v_restaurant_id UUID;
  v_winner_id UUID;
  v_discount_amount NUMERIC;
BEGIN
  -- For each restaurant
  FOR v_restaurant_id IN SELECT DISTINCT restaurant_id FROM restaurant_leaderboard LOOP
    -- Get the #1 ranked customer
    SELECT customer_id INTO v_winner_id
    FROM restaurant_leaderboard
    WHERE restaurant_id = v_restaurant_id
    ORDER BY rank ASC
    LIMIT 1;
    
    IF v_winner_id IS NOT NULL THEN
      -- Award 1000 bonus points
      UPDATE profiles 
      SET loyalty_points = loyalty_points + 1000
      WHERE id = v_winner_id;
      
      -- Mark as VIP
      UPDATE profiles 
      SET is_vip = true
      WHERE id = v_winner_id;
      
      -- Send notification
      INSERT INTO notifications (user_id, type, title, message, emoji, data)
      VALUES (
        v_winner_id,
        'leaderboard_winner',
        '🏆 Vous êtes le champion!',
        'Vous êtes le client le plus fidèle ce mois-ci! +1000 points bonus',
        '🏆',
        jsonb_build_object('restaurant_id', v_restaurant_id, 'bonus_points', 1000)
      );
    END IF;
  END LOOP;
  
  -- Reset leaderboard for next month
  DELETE FROM restaurant_leaderboard
  WHERE last_updated < NOW() - INTERVAL '30 days';
  
  RAISE NOTICE 'Monthly leaderboard reset completed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CRON SCHEDULE (uncomment to enable)
-- ============================================================================
-- Run every Sunday at 23:00 UTC (points expiry check)
-- SELECT cron.schedule('expire-old-points', '0 23 * * 0', 'SELECT expire_old_points_job()');

-- Run every Monday, Wednesday, Friday at 09:00 UTC (expiry warnings)
-- SELECT cron.schedule('send-expiry-alerts', '0 9 * * 1,3,5', 'SELECT send_points_expiry_alerts_job()');

-- Run every Monday at 00:01 UTC (generate weekly challenges)
-- SELECT cron.schedule('generate-weekly-challenges', '1 0 * * 1', 'SELECT generate_weekly_challenges_job()');

-- Run 1st of every month at 01:00 UTC (leaderboard reset)
-- SELECT cron.schedule('reset-monthly-leaderboard', '0 1 1 * *', 'SELECT reset_monthly_leaderboard_job()');

-- ============================================================================
-- NOTES:
-- To set up cron jobs:
-- 1. Enable pg_cron extension: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 2. Uncomment the cron.schedule calls above
-- 3. Execute this file in your Supabase SQL editor
-- 4. Verify with: SELECT * FROM cron.job;
-- 5. View logs: SELECT * FROM cron.job_run_details ORDER BY start_time DESC;
-- ============================================================================
