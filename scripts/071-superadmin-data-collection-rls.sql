-- ============================================================
-- RESTAFY — Super admin : lecture globale des tables « data / IA »
--
-- PRÉREQUIS (obligatoire si tu as l’erreur « relation does not exist ») :
--   1. Tables data / IA : au minimum scripts/077-order-events-minimal.sql (order_events seule),
--      ou le lot complet scripts/038-data-collection-infrastructure.sql
--      (order_events, menu_views, daily_restaurant_stats, stock_alerts — attention dépend menu_items)
--   2. Avoir get_my_role() (ex. scripts/054-fix-all-rls-final.sql partie 1)
--
-- Ce script est idempotent : les tables absentes sont ignorées (NOTICE dans les logs).
-- ============================================================

DO $body$
BEGIN
  -- order_events
  IF to_regclass('public.order_events') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "superadmin_read_all_order_events" ON public.order_events';
    EXECUTE $pol$
      CREATE POLICY "superadmin_read_all_order_events" ON public.order_events
      FOR SELECT TO authenticated
      USING (get_my_role() IN ('super_admin', 'superadmin'))
    $pol$;
    RAISE NOTICE 'Politique superadmin OK sur order_events';
  ELSE
    RAISE NOTICE 'Ignoré : public.order_events n''existe pas — exécuter 038-data-collection-infrastructure.sql';
  END IF;

  -- daily_restaurant_stats
  IF to_regclass('public.daily_restaurant_stats') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "superadmin_read_all_daily_restaurant_stats" ON public.daily_restaurant_stats';
    EXECUTE $pol$
      CREATE POLICY "superadmin_read_all_daily_restaurant_stats" ON public.daily_restaurant_stats
      FOR SELECT TO authenticated
      USING (get_my_role() IN ('super_admin', 'superadmin'))
    $pol$;
    RAISE NOTICE 'Politique superadmin OK sur daily_restaurant_stats';
  ELSE
    RAISE NOTICE 'Ignoré : public.daily_restaurant_stats n''existe pas — exécuter 038-data-collection-infrastructure.sql';
  END IF;

  -- menu_views
  IF to_regclass('public.menu_views') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "superadmin_read_all_menu_views" ON public.menu_views';
    EXECUTE $pol$
      CREATE POLICY "superadmin_read_all_menu_views" ON public.menu_views
      FOR SELECT TO authenticated
      USING (get_my_role() IN ('super_admin', 'superadmin'))
    $pol$;
    RAISE NOTICE 'Politique superadmin OK sur menu_views';
  ELSE
    RAISE NOTICE 'Ignoré : public.menu_views n''existe pas — exécuter 038-data-collection-infrastructure.sql';
  END IF;

  -- stock_alerts
  IF to_regclass('public.stock_alerts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "superadmin_read_all_stock_alerts" ON public.stock_alerts';
    EXECUTE $pol$
      CREATE POLICY "superadmin_read_all_stock_alerts" ON public.stock_alerts
      FOR SELECT TO authenticated
      USING (get_my_role() IN ('super_admin', 'superadmin'))
    $pol$;
    RAISE NOTICE 'Politique superadmin OK sur stock_alerts';
  ELSE
    RAISE NOTICE 'Ignoré : public.stock_alerts n''existe pas — exécuter 038-data-collection-infrastructure.sql';
  END IF;
END
$body$;
