-- ════════════════════════════════════════════════════════════════
-- RESTAFY — Script 080 : RLS restaurants + onboarding (nouveaux comptes)
-- À exécuter dans Supabase SQL Editor (après 054 / 075 pour les helpers)
-- Corrige : INSERT bloqué (chicken-and-egg), SELECT is_active seul, liens profil
-- ════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies (noms historiques + scripts 007, 039, 041, 058, 042…)
DROP POLICY IF EXISTS "restaurants_read_public" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_public_read" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_public_select" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_select_all" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_owner_update" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_owner_all" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_owner_all_operations" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_owner_select" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_owner_insert" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_owner_delete" ON public.restaurants;
DROP POLICY IF EXISTS "restaurant_owner_insert" ON public.restaurants;
DROP POLICY IF EXISTS "allow_owner_insert" ON public.restaurants;
DROP POLICY IF EXISTS "Users can create restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "owner_insert_restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "authenticated_users_can_create_own_restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "owner_can_view_own_restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "owner_can_view" ON public.restaurants;
DROP POLICY IF EXISTS "owner_can_update_own_restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "owner_can_update" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurants are publicly viewable" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurants publicly viewable" ON public.restaurants;

-- Ne pas supprimer restaurants_superadmin_all (script 054) — garde le super admin

-- Clients / anon : restaurants actifs uniquement
CREATE POLICY "restaurants_public_read" ON public.restaurants
  FOR SELECT
  USING (is_active = true);

-- Proprio / équipe : voir SON restaurant même si is_active = false
CREATE POLICY "restaurants_owner_select" ON public.restaurants
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR get_my_restaurant_id() = id
  );

-- INSERT : uniquement WITH CHECK (pas de chicken-and-egg sur restaurant_id profil)
CREATE POLICY "restaurants_owner_insert" ON public.restaurants
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND get_my_role() IN ('restaurant_owner', 'restaurant')
  );

CREATE POLICY "restaurants_owner_update" ON public.restaurants
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR (
      get_my_restaurant_id() = id
      AND get_my_role() IN ('restaurant_owner', 'manager', 'restaurant')
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR (
      get_my_restaurant_id() = id
      AND get_my_role() IN ('restaurant_owner', 'manager', 'restaurant')
    )
  );

CREATE POLICY "restaurants_owner_delete" ON public.restaurants
  FOR DELETE
  USING (owner_id = auth.uid());

-- Données déjà incohérentes en base
UPDATE public.restaurants r
SET
  is_active = true,
  owner_id = COALESCE(r.owner_id, p.id),
  updated_at = NOW()
FROM public.profiles p
WHERE p.restaurant_id = r.id
  AND p.role IN ('restaurant_owner', 'restaurant')
  AND (r.is_active IS DISTINCT FROM TRUE OR r.owner_id IS NULL);

UPDATE public.profiles p
SET
  restaurant_id = r.id,
  updated_at = NOW()
FROM public.restaurants r
WHERE r.owner_id = p.id
  AND p.restaurant_id IS NULL
  AND p.role IN ('restaurant_owner', 'restaurant');

COMMIT;

SELECT
  r.id,
  r.name,
  r.is_active,
  r.owner_id,
  p.id AS profile_id,
  p.restaurant_id,
  p.role
FROM public.restaurants r
LEFT JOIN public.profiles p ON p.id = r.owner_id
ORDER BY r.created_at DESC
LIMIT 20;

SELECT 'Script 080 OK — RLS restaurants onboarding' AS status;
