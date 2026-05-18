-- ============================================================================
-- RESTAFY 073 — Accès kiosk équipe : autoriser le rôle profil `restaurant`
-- (alias legacy souvent utilisé à la place de `restaurant_owner`).
-- À exécuter sur Supabase après 072 (bases déjà migrées sans le rôle `restaurant`).
-- Le 072 à jour dans le dépôt contient déjà cette logique en CREATE OR REPLACE initial.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.kiosk_restaurant_can_manage_invites(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND get_my_restaurant_id() = p_restaurant_id
    AND (
      get_my_role() IN ('restaurant_owner', 'manager', 'restaurant')
      OR EXISTS (
        SELECT 1
        FROM public.restaurant_staff rs
        WHERE rs.restaurant_id = p_restaurant_id
          AND rs.profile_id = auth.uid()
          AND rs.is_active = TRUE
          AND rs.role::TEXT IN ('chef', 'manager')
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_restaurant_can_manage_invites(UUID) TO authenticated;
