-- Répare les restaurants bloqués « en attente » : is_active false et/ou owner_id NULL
-- alors que le profil propriétaire pointe déjà vers ce restaurant.
-- À exécuter une fois dans l’éditeur SQL Supabase si l’activation depuis l’app échoue (RLS).

UPDATE public.restaurants r
SET
  is_active = true,
  owner_id = COALESCE(r.owner_id, p.id),
  updated_at = NOW()
FROM public.profiles p
WHERE
  p.restaurant_id = r.id
  AND p.role = 'restaurant_owner'
  AND (
    r.is_active IS DISTINCT FROM TRUE
    OR r.owner_id IS NULL
  );

-- Vérification rapide
-- SELECT r.id, r.name, r.is_active, r.owner_id, p.id AS profile_id
-- FROM restaurants r
-- JOIN profiles p ON p.restaurant_id = r.id AND p.role = 'restaurant_owner';
