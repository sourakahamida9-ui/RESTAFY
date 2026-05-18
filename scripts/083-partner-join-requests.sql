-- ═══════════════════════════════════════════════════════════════════════════
-- RESTAFY 083 — Demandes « rejoindre Restafy » (landing → super admin)
-- ═══════════════════════════════════════════════════════════════════════════
-- Insertion : uniquement via API Vercel (service_role), pas depuis le client anon.
-- Lecture / mise à jour statut : super_admin (RLS).
--
-- Après exécution : Supabase → API → Reload schema si besoin.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.partner_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  restaurant_name TEXT NOT NULL,
  city TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'archived')),
  source_host TEXT
);

CREATE INDEX IF NOT EXISTS idx_partner_join_requests_created_at ON public.partner_join_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_join_requests_status ON public.partner_join_requests(status);

ALTER TABLE public.partner_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_select_partner_join" ON public.partner_join_requests;
CREATE POLICY "super_admin_select_partner_join" ON public.partner_join_requests
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'super_admin'
  )
);

DROP POLICY IF EXISTS "super_admin_update_partner_join" ON public.partner_join_requests;
CREATE POLICY "super_admin_update_partner_join" ON public.partner_join_requests
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'super_admin'
  )
);

REVOKE ALL ON public.partner_join_requests FROM PUBLIC;
REVOKE ALL ON public.partner_join_requests FROM anon;
REVOKE ALL ON public.partner_join_requests FROM authenticated;
GRANT SELECT, UPDATE ON public.partner_join_requests TO authenticated;

-- PostgREST avec la clé JWT service_role (API Vercel) doit pouvoir insérer.
GRANT INSERT ON public.partner_join_requests TO service_role;

-- Fin 083
