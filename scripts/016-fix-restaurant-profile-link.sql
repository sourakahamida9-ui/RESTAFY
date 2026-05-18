-- 016-fix-restaurant-profile-link.sql
-- Assurer que les restaurants et profils sont correctement lies

-- 1. Mettre a jour les profils des restaurant_owners pour avoir leur restaurant_id
UPDATE profiles p
SET restaurant_id = r.id
FROM restaurants r
WHERE r.owner_id = p.id
AND p.role IN ('restaurant_owner', 'restaurant')
AND p.restaurant_id IS NULL;

-- 2. Mettre a jour les restaurants pour avoir owner_id depuis les profils
UPDATE restaurants r
SET owner_id = p.id
FROM profiles p
WHERE p.restaurant_id = r.id
AND p.role IN ('restaurant_owner', 'restaurant')
AND r.owner_id IS NULL;

-- 3. Creer une fonction pour lier automatiquement
CREATE OR REPLACE FUNCTION link_restaurant_to_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand un restaurant est cree, mettre a jour le profil du owner
  IF NEW.owner_id IS NOT NULL THEN
    UPDATE profiles SET restaurant_id = NEW.id WHERE id = NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger pour lier automatiquement
DROP TRIGGER IF EXISTS trigger_link_restaurant ON restaurants;
CREATE TRIGGER trigger_link_restaurant
  AFTER INSERT ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION link_restaurant_to_owner();

-- 5. Verifier les profils restaurant_owner sans restaurant_id
-- (juste pour debug, ne fait rien si tout est OK)
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM profiles
  WHERE role IN ('restaurant_owner', 'restaurant')
  AND restaurant_id IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Attention: % profils restaurant sans restaurant_id', orphan_count;
  ELSE
    RAISE NOTICE 'OK: Tous les profils restaurant ont un restaurant_id';
  END IF;
END $$;
