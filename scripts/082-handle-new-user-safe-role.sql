-- ============================================================
-- RESTAFY 082 — handle_new_user : rôle enum sûr + téléphone unique
-- ============================================================
-- 1) Rôle : pas de ::user_role direct (évite échec si valeur hors enum).
-- 2) phone : colonne souvent UNIQUE — si le numéro existe déjà sur un autre
--    profil, l’INSERT échouait → Auth renvoie « Database error saving new user ».
--    On met NULL si déjà pris, ou on retente sans téléphone en unique_violation.
-- Ré-exécutez ce script sur Supabase (SQL Editor) même si 082 a déjà été appliqué une fois.

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
  raw_role TEXT;
  phone_val TEXT;
BEGIN
  raw_role := NEW.raw_user_meta_data->>'role';

  user_role_value := CASE raw_role
    WHEN 'super_admin' THEN 'super_admin'::user_role
    WHEN 'restaurant_owner' THEN 'restaurant_owner'::user_role
    WHEN 'manager' THEN 'manager'::user_role
    WHEN 'staff' THEN 'staff'::user_role
    WHEN 'livreur' THEN 'livreur'::user_role
    WHEN 'client' THEN 'client'::user_role
    WHEN 'restaurant' THEN 'restaurant_owner'::user_role
    ELSE 'client'::user_role
  END;

  phone_val := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  IF phone_val IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.phone = phone_val AND p.id IS DISTINCT FROM NEW.id
  ) THEN
    phone_val := NULL;
  END IF;

  BEGIN
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
      phone_val,
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
  EXCEPTION WHEN unique_violation THEN
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
      NULL,
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
  END;

  IF user_role_value = 'restaurant_owner' THEN
    restaurant_name_value := COALESCE(
      NEW.raw_user_meta_data->>'restaurant_name',
      'Restaurant de ' || COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );

    slug_value := lower(regexp_replace(
      unaccent(restaurant_name_value),
      '[^a-z0-9]+', '-', 'g'
    )) || '-' || substr(md5(random()::text), 1, 6);

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

    IF new_restaurant_id IS NOT NULL THEN
      UPDATE public.profiles
      SET restaurant_id = new_restaurant_id
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS '082: rôle CASE ; téléphone NULL si déjà pris ou unique_violation';
