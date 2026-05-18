-- Script SQL : créer la table public.order_events si absente + policy INSERT.
--
-- Contexte : la RPC `change_order_status` (script 102-oms-state-machine.sql)
-- écrit dans `order_events` via un trigger. Si la table n'a jamais été créée
-- (script 077 ou 038 jamais exécuté), chaque changement de statut déclenche
-- l'erreur "relation \"public.order_events\" does not exist" — visible en
-- toast rouge sur /restaurant/dashboard/orders dès qu'un restaurateur clique
-- Accepter/Prêt/Livrée.
--
-- Ce script est idempotent (CREATE TABLE IF NOT EXISTS, policies DROP+CREATE).
-- Il reprend le schéma minimal du script 077 + rajoute une policy INSERT
-- pour les authenticated (le trigger côté DB écrit en SECURITY DEFINER donc
-- passe outre RLS, mais certains paths frontend inserent directement via
-- useDataCollection → il faut l'INSERT policy pour éviter les erreurs 42501).

CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (
    event_type IN (
      'created', 'confirmed', 'preparing', 'ready',
      'delivering', 'delivered', 'cancelled'
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

-- SELECT : restaurateur voit les events de son resto
DROP POLICY IF EXISTS "restaurant_owner_can_read_order_events" ON public.order_events;
CREATE POLICY "restaurant_owner_can_read_order_events" ON public.order_events
  FOR SELECT TO authenticated
  USING (
    restaurant_id IN (
      SELECT p.restaurant_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.restaurant_id IS NOT NULL
    )
  );

-- SELECT : super_admin voit tout
DROP POLICY IF EXISTS "superadmin_read_all_order_events" ON public.order_events;
CREATE POLICY "superadmin_read_all_order_events" ON public.order_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- INSERT : tout authenticated peut inserer (restreint par les FK + role check
-- côté app). Les vrais inserts viennent du trigger SQL SECURITY DEFINER ou de
-- useDataCollection.ts côté client.
DROP POLICY IF EXISTS "order_events_insert_auth" ON public.order_events;
CREATE POLICY "order_events_insert_auth" ON public.order_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.order_events TO authenticated;

-- Demander à PostgREST de recharger le cache de schéma pour que l'API voie
-- immédiatement la nouvelle table sans attendre l'auto-reload (~1 min).
NOTIFY pgrst, 'reload schema';

-- Fin 111 — order_events disponible, plus d'erreur toast rouge sur Commandes.
