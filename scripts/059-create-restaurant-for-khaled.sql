-- Creer un restaurant pour l'utilisateur Khaled qui n'en a pas
-- D'abord, trouver son user_id
DO $$
DECLARE
  user_id UUID;
  new_restaurant_id UUID;
BEGIN
  -- Trouver l'utilisateur Khaled par email
  SELECT id INTO user_id FROM profiles WHERE email = 'khaledabraham1@gmail.com';
  
  IF user_id IS NULL THEN
    -- Essayer avec auth.users
    SELECT id INTO user_id FROM auth.users WHERE email = 'khaledabraham1@gmail.com';
  END IF;
  
  IF user_id IS NULL THEN
    RAISE NOTICE 'Utilisateur non trouve';
    RETURN;
  END IF;
  
  RAISE NOTICE 'User ID trouve: %', user_id;
  
  -- Verifier si un restaurant existe deja pour cet owner
  SELECT id INTO new_restaurant_id FROM restaurants WHERE owner_id = user_id;
  
  IF new_restaurant_id IS NOT NULL THEN
    RAISE NOTICE 'Restaurant existe deja: %', new_restaurant_id;
    -- Mettre a jour le profil avec ce restaurant_id
    UPDATE profiles SET restaurant_id = new_restaurant_id WHERE id = user_id;
    RETURN;
  END IF;
  
  -- Creer le restaurant
  INSERT INTO restaurants (name, slug, owner_id, is_active, is_open, created_at, updated_at)
  VALUES (
    'Restaurant de Khaled',
    'restaurant-khaled-' || EXTRACT(EPOCH FROM NOW())::TEXT,
    user_id,
    true,
    false,
    NOW(),
    NOW()
  )
  RETURNING id INTO new_restaurant_id;
  
  RAISE NOTICE 'Restaurant cree: %', new_restaurant_id;
  
  -- Lier au profil
  UPDATE profiles 
  SET restaurant_id = new_restaurant_id, role = 'restaurant_owner'
  WHERE id = user_id;
  
  RAISE NOTICE 'Profil mis a jour avec restaurant_id';
END $$;

-- Verifier le resultat
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  p.role,
  p.restaurant_id,
  r.name as restaurant_name
FROM profiles p
LEFT JOIN restaurants r ON p.restaurant_id = r.id
WHERE p.email = 'khaledabraham1@gmail.com'
   OR p.full_name ILIKE '%khaled%';
