-- ============================================================
-- TRIGGER: Auto-creation de profil ET restaurant pour les nouveaux utilisateurs
-- ============================================================

-- Fonction qui cree automatiquement le profil quand un utilisateur s'inscrit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role_value user_role;
  restaurant_name_value TEXT;
  new_restaurant_id UUID;
  slug_value TEXT;
BEGIN
  -- Extraire le role depuis les metadonnees (defaut: client)
  user_role_value := COALESCE(
    (NEW.raw_user_meta_data->>'role')::user_role,
    'client'::user_role
  );
  
  -- Creer le profil
  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    role,
    city,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    user_role_value,
    'Cotonou',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    role = COALESCE(EXCLUDED.role, profiles.role),
    updated_at = NOW();

  -- Si c'est un restaurant_owner, creer automatiquement le restaurant
  IF user_role_value = 'restaurant_owner' THEN
    restaurant_name_value := COALESCE(
      NEW.raw_user_meta_data->>'restaurant_name',
      'Restaurant de ' || COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    
    -- Generer un slug unique
    slug_value := lower(regexp_replace(
      unaccent(restaurant_name_value),
      '[^a-z0-9]+', '-', 'g'
    )) || '-' || substr(md5(random()::text), 1, 6);
    
    -- Creer le restaurant
    INSERT INTO public.restaurants (
      name,
      slug,
      owner_id,
      is_active,
      is_open,
      city,
      created_at,
      updated_at
    ) VALUES (
      restaurant_name_value,
      slug_value,
      NEW.id,
      true,
      false,
      'Cotonou',
      NOW(),
      NOW()
    )
    RETURNING id INTO new_restaurant_id;
    
    -- Lier le restaurant au profil
    IF new_restaurant_id IS NOT NULL THEN
      UPDATE public.profiles
      SET restaurant_id = new_restaurant_id
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Creer le trigger sur auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Ajouter owner_id a la table restaurants si manquant
-- ============================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
  END IF;
END $$;

-- ============================================================
-- Extension unaccent pour les slugs
-- ============================================================
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- Verification
-- ============================================================
SELECT 'Trigger on_auth_user_created cree avec succes' AS status;
