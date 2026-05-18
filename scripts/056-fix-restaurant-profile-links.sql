-- Script pour reparer les liens manquants entre restaurants et profiles
-- Probleme: Restaurant cree avec owner_id mais profile.restaurant_id est NULL

-- 1. Mettre a jour tous les profils qui sont owner d'un restaurant mais n'ont pas le restaurant_id
UPDATE profiles p
SET restaurant_id = r.id
FROM restaurants r
WHERE r.owner_id = p.id
  AND p.restaurant_id IS NULL;

-- 2. S'assurer que tous les owners ont le role restaurant_owner
UPDATE profiles p
SET role = 'restaurant_owner'
FROM restaurants r
WHERE r.owner_id = p.id
  AND p.role != 'restaurant_owner';

-- 3. Voir les resultats
SELECT 
  p.id as profile_id,
  p.email,
  p.full_name,
  p.role,
  p.restaurant_id,
  r.id as restaurant_id_from_owner,
  r.name as restaurant_name
FROM profiles p
LEFT JOIN restaurants r ON r.owner_id = p.id
WHERE p.role = 'restaurant_owner' OR r.id IS NOT NULL;
