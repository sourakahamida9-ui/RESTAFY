-- ============================================================
-- 099 — Indexes manquants pour analytics_events
-- ============================================================
-- analytics_events est créée dans scripts/01-create-schema.sql sans
-- aucun index. Avec quelques milliers d'événements ça reste OK ; à
-- partir de ~50k lignes l'export "Statistiques" du dashboard
-- (src/pages/admin/Settings.tsx:545) fait un seq scan complet à
-- chaque clic + le filtre RLS `restaurant_id = X` est full-table-scan
-- au lieu d'index-scan.
--
-- Hot queries observées :
--   1. Export CSV : filter restaurant_id + order created_at desc + limit 5000
--   2. RLS read_own_analytics : filter sur user_id ou restaurant_id
--   3. Insertions très fréquentes côté client (vues, clics, conversions)
-- ============================================================

-- 1) Composite pour l'export CSV (Settings.tsx:545)
--    .eq('restaurant_id', X).order('created_at', desc).limit(5000)
--    Sans cet index : seq scan + sort. Avec : index-only forward scan.
CREATE INDEX IF NOT EXISTS idx_analytics_events_restaurant_created
  ON analytics_events(restaurant_id, created_at DESC);

-- 2) RLS user-scoped reads (read_own_analytics policy from 070-rls-fixes.sql)
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id
  ON analytics_events(user_id)
  WHERE user_id IS NOT NULL;

-- 3) Couvre les analyses côté admin où on filtre par event_name (ex.
--    "combien de checkout_clicked sur les 7 derniers jours")
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name_created
  ON analytics_events(event_name, created_at DESC);

-- ANALYZE pour rafraîchir les stats du planner après ajout d'index
ANALYZE analytics_events;

-- ============================================================
-- Notes :
-- - Aucun DROP / aucune modification de structure : ces commandes
--   sont 100% additives et IF NOT EXISTS, donc rejouables sans risque.
-- - L'ANALYZE final aide PostgreSQL à choisir les nouveaux index sans
--   attendre l'autovacuum.
-- ============================================================
