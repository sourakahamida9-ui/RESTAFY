-- Script pour créer/promouvoir un compte superadmin
-- Exécute dans Supabase SQL Editor

-- 1. D'abord crée l'utilisateur via l'interface Auth (Supabase → Authentication → Users)
-- Email: admin@restafy.com
-- Mot de passe: à définir

-- 2. Ensuite, copie le UUID de cet utilisateur et remplace 'YOUR_UUID_HERE' ci-dessous:

UPDATE public.profiles
SET 
  role = 'super_admin',
  updated_at = NOW()
WHERE id = 'YOUR_UUID_HERE';

-- Vérifier que c'est bien un super_admin:
SELECT id, email, full_name, role FROM public.profiles WHERE role = 'super_admin' LIMIT 5;
