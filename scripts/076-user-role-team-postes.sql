-- ============================================================================
-- RESTAFY 076 — Postes équipe dans le type user_role (si restaurant_staff.role = user_role)
-- ============================================================================
-- Si l’insertion d’un membre avec rôle chef / cashier / waiter échoue avec une erreur
-- de cast enum, exécutez ce script une fois sur Supabase.
-- Si votre colonne restaurant_staff.role est en TEXT avec CHECK (script 005), ignorez ce fichier.
-- Sur PostgreSQL 15+ (Supabase récent), préférez scripts/086-user-role-team-postes-if-not-exists.sql.
--
-- Alternative recommandée : scripts/084-restaurant-staff-role-text.sql (passe role en TEXT
-- pour coller à l’app et aux scripts kiosk — sans gonfler l’enum user_role).
-- ============================================================================

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE 'chef';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE 'cashier';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE 'waiter';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
