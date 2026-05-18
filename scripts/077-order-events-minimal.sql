-- ═══════════════════════════════════════════════════════════════════════════════
-- RESTAFY 077 — Table order_events seule (Data Center superadmin)
--
-- Erreur typique sans ce script :
--   "Could not find the table 'public.order_events' in the schema cache"
--
-- Après exécution : Dashboard → Settings → API → « Reload schema » si besoin,
-- ou attendre ~1 min (cache PostgREST).
--
-- Optionnel ensuite : scripts/071-superadmin-data-collection-rls.sql
-- (déjà couvert si les politiques ci-dessous suffisent).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (
    event_type IN (
      'created',
      'confirmed',
      'preparing',
      'ready',
      'delivering',
      'delivered',
      'cancelled'
    )
  ),
  triggered_by VARCHAR(30) NOT NULL CHECK (triggered_by IN ('customer', 'staff', 'auto')),
  duration_since_previous_event_seconds INT,
  staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  device_type VARCHAR(20) CHECK (device_type IN ('mobile', 'desktop', 'pos')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON public.order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_restaurant_id ON public.order_events(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_events_created_at ON public.order_events(created_at);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_owner_can_read_order_events" ON public.order_events;
CREATE POLICY "restaurant_owner_can_read_order_events" ON public.order_events
FOR SELECT TO authenticated
USING (
  restaurant_id IN (
    SELECT p.restaurant_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.restaurant_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "superadmin_read_all_order_events" ON public.order_events;
CREATE POLICY "superadmin_read_all_order_events" ON public.order_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      -- ENUM user_role : utiliser uniquement la valeur définie en base (souvent super_admin, pas superadmin)
      AND p.role = 'super_admin'
  )
);

GRANT SELECT, INSERT ON public.order_events TO authenticated;

-- Fin 077 — order_events prête pour le Data Center
