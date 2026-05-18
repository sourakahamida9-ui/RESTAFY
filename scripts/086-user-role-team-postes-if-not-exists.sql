-- RESTAFY 086: add team post enum values (PostgreSQL 15+ IF NOT EXISTS)
-- Run once in Supabase SQL Editor when: invalid input value for enum user_role: 'chef' (or cashier/waiter)
-- On older PostgreSQL use scripts/076-user-role-team-postes.sql instead.
-- Recommended long-term: scripts/084-restaurant-staff-role-text.sql (TEXT column + CHECK)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'chef';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'waiter';
