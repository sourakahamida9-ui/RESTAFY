-- =====================================================
-- 090 - Logs reminder email commandes en attente
-- =====================================================

CREATE TABLE IF NOT EXISTS public.order_confirmation_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  reminded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_confirmation_reminder_logs_restaurant
  ON public.order_confirmation_reminder_logs(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_order_confirmation_reminder_logs_reminded_at
  ON public.order_confirmation_reminder_logs(reminded_at DESC);

ALTER TABLE public.order_confirmation_reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_read_order_confirmation_reminders" ON public.order_confirmation_reminder_logs;
CREATE POLICY "super_admin_read_order_confirmation_reminders"
ON public.order_confirmation_reminder_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
  )
);

REVOKE ALL ON public.order_confirmation_reminder_logs FROM PUBLIC;
REVOKE ALL ON public.order_confirmation_reminder_logs FROM anon;
REVOKE ALL ON public.order_confirmation_reminder_logs FROM authenticated;
GRANT SELECT ON public.order_confirmation_reminder_logs TO authenticated;
GRANT INSERT ON public.order_confirmation_reminder_logs TO service_role;
