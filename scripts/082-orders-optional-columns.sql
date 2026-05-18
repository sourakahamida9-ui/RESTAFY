-- ============================================================================
-- RESTAFY 082 — Colonnes optionnelles sur public.orders (évite erreurs PostgREST)
-- ============================================================================
-- Si l’app affiche : column orders.prep_time_min does not exist (ou driver_id, etc.),
-- exécutez ce script une fois dans l’éditeur SQL Supabase.
-- Les ADD COLUMN IF NOT EXISTS sont idempotents.
-- ============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS prep_time_min INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id UUID;
-- Livreur legacy (script 037) — conservé si vous utilisez livreur_id au lieu de driver_id
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS livreur_id UUID;

-- ✅ Colonnes client (pour commandes sans compte ou sans jointure profiles)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;

SELECT 'Script 082 OK — colonnes orders optionnelles présentes' AS status;
