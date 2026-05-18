-- ============================================================================
-- RESTAFY 084 — restaurant_staff.role en TEXT (postes métier)
-- ============================================================================
-- Problème : si restaurant_staff.role est typé user_role (schéma 01-create-schema),
-- l’app ne peut pas enregistrer chef / cashier / waiter → erreur PostgreSQL :
--   invalid input value for enum user_role: "chef"
--
-- Solution : passer la colonne en TEXT avec un CHECK aligné sur scripts/005 et
-- src/lib/teamRoles.ts (postes équipe, distincts de profiles.role / enum compte).
--
-- IMPORTANT : toute politique RLS qui référence restaurant_staff.role bloque l’ALTER.
-- Scripts concernés : 054 (delivery_drivers, orders), 065 (table_reservations).
-- Sans DROP avant conversion, PostgreSQL renvoie :
--   cannot alter type of a column used in a policy definition
--
-- Idempotent : si role est déjà text/varchar, aucune modification.
-- À exécuter une fois dans Supabase → SQL Editor.
--
-- Alternative : scripts/086-user-role-team-postes-if-not-exists.sql (PG 15+), ou
-- scripts/076-user-role-team-postes.sql (ajoute chef, cashier, waiter à l’enum user_role)
-- si vous préférez garder le type enum sur cette colonne.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurant_staff'
      AND column_name = 'role'
      AND data_type = 'USER-DEFINED'
      AND udt_name = 'user_role'
  ) THEN
    -- Politiques qui dépendent de restaurant_staff.role (script 054)
    IF to_regclass('public.delivery_drivers') IS NOT NULL THEN
      DROP POLICY IF EXISTS "restaurant_view_own_drivers" ON public.delivery_drivers;
      DROP POLICY IF EXISTS "restaurant_insert_drivers" ON public.delivery_drivers;
      DROP POLICY IF EXISTS "restaurant_update_drivers" ON public.delivery_drivers;
      DROP POLICY IF EXISTS "restaurant_delete_drivers" ON public.delivery_drivers;
    END IF;

    IF to_regclass('public.orders') IS NOT NULL THEN
      DROP POLICY IF EXISTS "restaurant_assign_driver" ON public.orders;
    END IF;

    IF to_regclass('public.table_reservations') IS NOT NULL THEN
      DROP POLICY IF EXISTS "reservations_restaurant_all" ON public.table_reservations;
    END IF;

    ALTER TABLE public.restaurant_staff ALTER COLUMN role DROP DEFAULT;

    ALTER TABLE public.restaurant_staff
      ALTER COLUMN role TYPE TEXT USING role::text;

    ALTER TABLE public.restaurant_staff
      ALTER COLUMN role SET DEFAULT 'staff';

    ALTER TABLE public.restaurant_staff
      ALTER COLUMN role SET NOT NULL;

    ALTER TABLE public.restaurant_staff
      DROP CONSTRAINT IF EXISTS restaurant_staff_role_check;

    ALTER TABLE public.restaurant_staff
      ADD CONSTRAINT restaurant_staff_role_check
      CHECK (
        role IN ('manager', 'chef', 'cashier', 'waiter', 'staff', 'livreur')
      );

    -- Recréer les politiques (role::text reste valide une fois la colonne en TEXT)
    IF to_regclass('public.delivery_drivers') IS NOT NULL THEN
      CREATE POLICY "restaurant_view_own_drivers" ON public.delivery_drivers
        FOR SELECT
        USING (
          restaurant_id IN (
            SELECT id FROM public.restaurants
            WHERE owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = delivery_drivers.restaurant_id
              AND rs.profile_id = auth.uid()
              AND rs.role::text IN ('manager', 'staff')
          )
        );

      CREATE POLICY "restaurant_insert_drivers" ON public.delivery_drivers
        FOR INSERT
        WITH CHECK (
          restaurant_id IN (
            SELECT id FROM public.restaurants
            WHERE owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = delivery_drivers.restaurant_id
              AND rs.profile_id = auth.uid()
              AND rs.role::text IN ('manager')
          )
        );

      CREATE POLICY "restaurant_update_drivers" ON public.delivery_drivers
        FOR UPDATE
        USING (
          restaurant_id IN (
            SELECT id FROM public.restaurants
            WHERE owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = delivery_drivers.restaurant_id
              AND rs.profile_id = auth.uid()
              AND rs.role::text IN ('manager', 'staff')
          )
        );

      CREATE POLICY "restaurant_delete_drivers" ON public.delivery_drivers
        FOR DELETE
        USING (
          restaurant_id IN (
            SELECT id FROM public.restaurants
            WHERE owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = delivery_drivers.restaurant_id
              AND rs.profile_id = auth.uid()
              AND rs.role::text = 'manager'
          )
        );
    END IF;

    IF to_regclass('public.orders') IS NOT NULL THEN
      CREATE POLICY "restaurant_assign_driver" ON public.orders
        FOR UPDATE
        USING (
          restaurant_id IN (
            SELECT id FROM public.restaurants
            WHERE owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = orders.restaurant_id
              AND rs.profile_id = auth.uid()
              AND rs.role::text IN ('manager', 'staff')
          )
        )
        WITH CHECK (
          restaurant_id IN (
            SELECT id FROM public.restaurants
            WHERE owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = orders.restaurant_id
              AND rs.profile_id = auth.uid()
              AND rs.role::text IN ('manager', 'staff')
          )
        );
    END IF;

    IF to_regclass('public.table_reservations') IS NOT NULL THEN
      CREATE POLICY "reservations_restaurant_all" ON public.table_reservations
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = table_reservations.restaurant_id
              AND r.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = table_reservations.restaurant_id
              AND rs.profile_id = auth.uid()
              AND rs.role::text IN ('manager', 'staff')
          )
        );
    END IF;
  END IF;
END $$;

COMMENT ON COLUMN public.restaurant_staff.role IS
  'Poste équipe (TEXT). Valeurs : manager, chef, cashier, waiter, staff, livreur. Distinct de profiles.role (rôle compte Auth).';
