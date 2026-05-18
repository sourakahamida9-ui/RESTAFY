-- ═══════════════════════════════════════════════════════════════════════════════
-- RESTAFY 110 — Fix: make trigger_log_order_event resilient to missing table
--
-- PROBLÈME : si la table order_events n'existe pas encore (migration 077 non
-- appliquée), le trigger AFTER UPDATE sur orders crashe avec :
--   "relation 'public.order_events' does not exist"
-- Ce qui bloque toute mise à jour de statut de commande (RPC ou UPDATE direct).
--
-- CORRECTIF : wrap l'INSERT dans un BEGIN/EXCEPTION block qui catch
-- undefined_table et silently skip.
--
-- À EXÉCUTER dans Supabase SQL Editor → idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Réécrire la fonction trigger pour être résiliente
CREATE OR REPLACE FUNCTION public.trigger_log_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prev_event       TIMESTAMP;
  duration_seconds INT;
  v_staff_id       UUID;
  v_device         TEXT;
  v_triggered_by   TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Skip silently if order_events table does not exist yet
    IF to_regclass('public.order_events') IS NULL THEN
      RETURN NEW;
    END IF;

    -- Lire les session vars (positionnées par change_order_status RPC)
    BEGIN
      v_staff_id := NULLIF(current_setting('restafy.staff_id', TRUE), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_staff_id := NULL;
    END;

    v_device := NULLIF(current_setting('restafy.device_type', TRUE), '');
    IF v_device IS NULL OR v_device NOT IN ('mobile', 'desktop', 'pos') THEN
      v_device := NULL;
    END IF;

    v_triggered_by := COALESCE(
      NULLIF(current_setting('restafy.triggered_by', TRUE), ''),
      CASE WHEN v_staff_id IS NOT NULL THEN 'staff' ELSE 'auto' END
    );
    IF v_triggered_by NOT IN ('customer', 'staff', 'auto') THEN
      v_triggered_by := 'auto';
    END IF;

    BEGIN
      SELECT created_at INTO prev_event
      FROM public.order_events
      WHERE order_id = NEW.id
      ORDER BY created_at DESC
      LIMIT 1;
    EXCEPTION WHEN undefined_table THEN
      RETURN NEW;
    END;

    IF prev_event IS NOT NULL THEN
      duration_seconds := EXTRACT(EPOCH FROM (NOW() - prev_event))::INT;
    END IF;

    BEGIN
      INSERT INTO public.order_events (
        order_id, restaurant_id, event_type, triggered_by,
        duration_since_previous_event_seconds, staff_id, device_type, created_at
      ) VALUES (
        NEW.id, NEW.restaurant_id, NEW.status::TEXT, v_triggered_by,
        duration_seconds, v_staff_id, v_device, NOW()
      );
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Optionnel : créer la table order_events si elle n'existe pas
-- (copie simplifiée de 077-order-events-minimal.sql)
CREATE TABLE IF NOT EXISTS public.order_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  event_type  TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'auto',
  staff_id    UUID,
  device_type TEXT,
  duration_since_previous_event_seconds INT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON public.order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_restaurant_id ON public.order_events(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_events_created_at ON public.order_events(created_at);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

-- RLS policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_events' AND policyname = 'restaurant_owner_can_read_order_events'
  ) THEN
    CREATE POLICY "restaurant_owner_can_read_order_events" ON public.order_events
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.orders o
          JOIN public.restaurants r ON r.id = o.restaurant_id
          WHERE o.id = order_events.order_id
            AND r.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_events' AND policyname = 'superadmin_read_all_order_events'
  ) THEN
    CREATE POLICY "superadmin_read_all_order_events" ON public.order_events
      FOR SELECT USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
      );
  END IF;
END $$;

RAISE NOTICE 'Script 110 terminé — trigger résilient + table order_events OK.';
