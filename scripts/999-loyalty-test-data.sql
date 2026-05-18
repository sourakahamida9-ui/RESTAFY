-- ============================================================================
-- LOYALTY SYSTEM - TEST DATA GENERATOR
-- ============================================================================
-- Use this script to populate test data for the loyalty system
-- WARNING: This will create fake users and transactions - use in dev/staging ONLY
-- Run this AFTER 035-loyalty-tables.sql

-- ============================================================================
-- TEST DATA: Create test users
-- ============================================================================

-- Test User 1: ALICE (parrain)
-- Note: You need to create auth users first via Supabase UI or API
-- For this SQL, we assume UUIDs are pre-created. Replace UUIDs with real ones.

-- Example UUIDs (replace with real ones from auth.users):
-- alice_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
-- bob_id = 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy'
-- charlie_id = 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz'

-- ============================================================================
-- INSERT TEST PROFILES
-- ============================================================================

-- Insert test profile 1 (ALICE - parrain)
INSERT INTO profiles (id, email, full_name, phone, address, city, loyalty_points, loyalty_level, created_at)
VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'alice@test.com',
  'Alice Martin',
  '22560123456',
  '123 Rue Test, Cotonou',
  'Cotonou',
  750,  -- Silver level
  'silver',
  NOW() - INTERVAL '30 days'
)
ON CONFLICT (id) DO UPDATE SET loyalty_points = 750, loyalty_level = 'silver';

-- Insert test profile 2 (BOB - filleul)
INSERT INTO profiles (id, email, full_name, phone, address, city, loyalty_points, loyalty_level, created_at)
VALUES (
  'e47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid,
  'bob@test.com',
  'Bob Traore',
  '22560789012',
  '456 Rue Test, Cotonou',
  'Cotonou',
  100,  -- Bronze level
  'bronze',
  NOW() - INTERVAL '20 days'
)
ON CONFLICT (id) DO UPDATE SET loyalty_points = 100, loyalty_level = 'bronze';

-- Insert test profile 3 (CHARLIE - platine)
INSERT INTO profiles (id, email, full_name, phone, address, city, loyalty_points, loyalty_level, created_at)
VALUES (
  'd47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid,
  'charlie@test.com',
  'Charlie Kane',
  '22560345678',
  '789 Rue Test, Cotonou',
  'Cotonou',
  5000,  -- Platinum level
  'platinum',
  NOW() - INTERVAL '60 days'
)
ON CONFLICT (id) DO UPDATE SET loyalty_points = 5000, loyalty_level = 'platinum';

-- Insert test profile 4 (DIANA - diamond)
INSERT INTO profiles (id, email, full_name, phone, address, city, loyalty_points, loyalty_level, created_at)
VALUES (
  'c47ac10b-58cc-4372-a567-0e02b2c3d482'::uuid,
  'diana@test.com',
  'Diana Diallo',
  '22560901234',
  '321 Rue Test, Cotonou',
  'Cotonou',
  12000,  -- Diamond level
  'diamond',
  NOW() - INTERVAL '90 days'
)
ON CONFLICT (id) DO UPDATE SET loyalty_points = 12000, loyalty_level = 'diamond';

-- ============================================================================
-- INSERT TEST REFERRALS
-- ============================================================================

-- Alice referred Bob
INSERT INTO referrals (id, referrer_id, referee_id, referral_code, status, first_order_at, created_at)
VALUES (
  'a47ac10b-58cc-4372-a567-0e02b2c3d483'::uuid,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'e47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid,
  'alice1',
  'active',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '20 days'
)
ON CONFLICT DO NOTHING;

-- Charlie referred Diana (old referral)
INSERT INTO referrals (id, referrer_id, referee_id, referral_code, status, points_earned, first_order_at, created_at)
VALUES (
  'b47ac10b-58cc-4372-a567-0e02b2c3d484'::uuid,
  'd47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid,
  'c47ac10b-58cc-4372-a567-0e02b2c3d482'::uuid,
  'charlie2',
  'active',
  400,  -- 2 referrals completed
  NOW() - INTERVAL '85 days',
  NOW() - INTERVAL '90 days'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT TEST WEEKLY CHALLENGES
-- ============================================================================

-- Get this week's start date
-- (If Monday is day 1, set to nearest Monday)
WITH week_info AS (
  SELECT date_trunc('week', CURRENT_DATE)::date as week_start
)
INSERT INTO weekly_challenges (week_start, challenge_type, description, target_value, points_reward, emoji, is_active, created_at)
SELECT 
  week_info.week_start,
  challenge_type,
  description,
  target_value,
  points_reward,
  emoji,
  true,
  NOW()
FROM (
  VALUES
    ('orders', 'Commander 3x cette semaine', 3, 150, '🛍️'),
    ('new_restaurant', 'Essayer un nouveau restaurant', 1, 100, '✨'),
    ('early_order', 'Commander avant 12h (3x)', 3, 50, '⏰'),
    ('share', 'Partager un événement', 1, 75, '📢')
) AS challenges(challenge_type, description, target_value, points_reward, emoji),
week_info
ON CONFLICT (week_start, challenge_type) DO NOTHING;

-- ============================================================================
-- INSERT TEST CHALLENGE PROGRESS
-- ============================================================================

-- Alice's challenge progress (in progress)
INSERT INTO challenge_progress (customer_id, challenge_id, progress_value, is_completed, created_at)
SELECT 
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  wc.id,
  CASE WHEN wc.challenge_type = 'orders' THEN 2
       WHEN wc.challenge_type = 'new_restaurant' THEN 1
       WHEN wc.challenge_type = 'early_order' THEN 1
       WHEN wc.challenge_type = 'share' THEN 0
  END,
  CASE WHEN wc.challenge_type = 'new_restaurant' THEN true ELSE false END,
  NOW()
FROM weekly_challenges wc
WHERE week_start = date_trunc('week', CURRENT_DATE)::date
ON CONFLICT (customer_id, challenge_id) DO NOTHING;

-- Bob's challenge progress (started)
INSERT INTO challenge_progress (customer_id, challenge_id, progress_value, is_completed, created_at)
SELECT 
  'e47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid,
  wc.id,
  CASE WHEN wc.challenge_type = 'orders' THEN 1
       ELSE 0
  END,
  false,
  NOW()
FROM weekly_challenges wc
WHERE week_start = date_trunc('week', CURRENT_DATE)::date
ON CONFLICT (customer_id, challenge_id) DO NOTHING;

-- ============================================================================
-- INSERT TEST LOYALTY TRANSACTIONS
-- ============================================================================

-- Alice's earned points (various sources)
INSERT INTO loyalty_transactions (id, customer_id, points, type, description, order_id, created_at)
VALUES 
  ('a57ac10b-58cc-4372-a567-0e02b2c3d490'::uuid, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 500, 'earned', 'Welcome bonus', NULL, NOW() - INTERVAL '30 days'),
  ('a57ac10b-58cc-4372-a567-0e02b2c3d491'::uuid, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 200, 'earned', 'Referral bonus - Bob', NULL, NOW() - INTERVAL '10 days'),
  ('a57ac10b-58cc-4372-a567-0e02b2c3d492'::uuid, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 50, 'earned', 'Order on 2024-01-15', '12345678-1234-1234-1234-123456789012'::uuid, NOW() - INTERVAL '15 days')
ON CONFLICT DO NOTHING;

-- Bob's earned points
INSERT INTO loyalty_transactions (id, customer_id, points, type, description, created_at)
VALUES 
  ('b57ac10b-58cc-4372-a567-0e02b2c3d493'::uuid, 'e47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid, 100, 'earned', 'Welcome bonus', NOW() - INTERVAL '20 days')
ON CONFLICT DO NOTHING;

-- Old points for Alice (will expire in 14 days - good for testing alerts)
INSERT INTO loyalty_transactions (id, customer_id, points, type, description, created_at)
VALUES 
  ('c57ac10b-58cc-4372-a567-0e02b2c3d494'::uuid, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 340, 'earned', 'Points expiring soon', NOW() - INTERVAL '76 days')
ON CONFLICT DO NOTHING;

-- Very old points for Diana (already expired)
INSERT INTO loyalty_transactions (id, customer_id, points, type, description, created_at)
VALUES 
  ('d57ac10b-58cc-4372-a567-0e02b2c3d495'::uuid, 'c47ac10b-58cc-4372-a567-0e02b2c3d482'::uuid, 500, 'earned', 'Points expired', NOW() - INTERVAL '100 days')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT TEST LEADERBOARD ENTRIES
-- ============================================================================

-- Assuming a test restaurant exists with ID '12345678-1234-1234-1234-123456789000'
-- Replace with actual restaurant ID from your database

INSERT INTO loyalty_leaderboard (id, customer_id, restaurant_id, rank_position, total_points, total_orders, avg_order_value, badge_type, period_start, period_end, created_at)
VALUES 
  ('a67ac10b-58cc-4372-a567-0e02b2c3d500'::uuid, 'c47ac10b-58cc-4372-a567-0e02b2c3d482'::uuid, '12345678-1234-1234-1234-123456789000'::uuid, 1, 12000, 45, 15000, 'vip', (NOW() - INTERVAL '30 days')::date, NOW()::date, NOW()),
  ('a67ac10b-58cc-4372-a567-0e02b2c3d501'::uuid, 'd47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid, '12345678-1234-1234-1234-123456789000'::uuid, 2, 5000, 25, 12000, NULL, (NOW() - INTERVAL '30 days')::date, NOW()::date, NOW()),
  ('a67ac10b-58cc-4372-a567-0e02b2c3d502'::uuid, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, '12345678-1234-1234-1234-123456789000'::uuid, 3, 750, 8, 8000, NULL, (NOW() - INTERVAL '30 days')::date, NOW()::date, NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these to verify test data was inserted correctly:
/*

-- Check profiles
SELECT id, full_name, loyalty_points, loyalty_level FROM profiles 
WHERE id IN ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'e47ac10b-58cc-4372-a567-0e02b2c3d480', 'd47ac10b-58cc-4372-a567-0e02b2c3d481', 'c47ac10b-58cc-4372-a567-0e02b2c3d482');

-- Check referrals
SELECT referrer_id, referee_id, referral_code, status FROM referrals 
WHERE referrer_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

-- Check weekly challenges
SELECT challenge_type, description, target_value, points_reward FROM weekly_challenges 
WHERE week_start = date_trunc('week', CURRENT_DATE)::date;

-- Check challenge progress
SELECT cp.customer_id, wc.description, cp.progress_value, cp.is_completed 
FROM challenge_progress cp
JOIN weekly_challenges wc ON cp.challenge_id = wc.id
WHERE cp.customer_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

-- Check transactions
SELECT customer_id, points, type, description, created_at FROM loyalty_transactions 
WHERE customer_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
ORDER BY created_at DESC;

-- Check leaderboard
SELECT rank_position, customer_id, total_points, total_orders FROM loyalty_leaderboard 
WHERE restaurant_id = '12345678-1234-1234-1234-123456789000'
ORDER BY rank_position;

*/

-- ============================================================================
-- CLEANUP (if needed)
-- ============================================================================

-- To remove test data, uncomment and run:
/*

DELETE FROM challenge_progress 
WHERE customer_id IN ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'e47ac10b-58cc-4372-a567-0e02b2c3d480', 'd47ac10b-58cc-4372-a567-0e02b2c3d481', 'c47ac10b-58cc-4372-a567-0e02b2c3d482');

DELETE FROM loyalty_transactions 
WHERE customer_id IN ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'e47ac10b-58cc-4372-a567-0e02b2c3d480', 'd47ac10b-58cc-4372-a567-0e02b2c3d481', 'c47ac10b-58cc-4372-a567-0e02b2c3d482');

DELETE FROM referrals 
WHERE referrer_id IN ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'd47ac10b-58cc-4372-a567-0e02b2c3d481');

DELETE FROM loyalty_leaderboard 
WHERE customer_id IN ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'e47ac10b-58cc-4372-a567-0e02b2c3d480', 'd47ac10b-58cc-4372-a567-0e02b2c3d481', 'c47ac10b-58cc-4372-a567-0e02b2c3d482');

DELETE FROM profiles 
WHERE id IN ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'e47ac10b-58cc-4372-a567-0e02b2c3d480', 'd47ac10b-58cc-4372-a567-0e02b2c3d481', 'c47ac10b-58cc-4372-a567-0e02b2c3d482');

*/

-- ============================================================================
-- TEST DATA GENERATION COMPLETE
-- ============================================================================
-- You now have:
-- • 4 test profiles at different loyalty levels (Bronze, Silver, Platinum, Diamond)
-- • 2 test referrals (1 active, 1 old)
-- • 4 weekly challenges (generated for this week)
-- • Challenge progress for 2 users
-- • 5 loyalty transactions (including old points for expiry testing)
-- • 3 leaderboard entries
--
-- Ready to test:
-- ✅ Loyalty levels display
-- ✅ Progress bars
-- ✅ Referral codes
-- ✅ Challenges tracking
-- ✅ Points expiration alerts (Alice has points expiring in 14 days)
-- ✅ Leaderboard display with VIP badge
