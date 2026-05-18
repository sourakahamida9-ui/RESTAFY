-- =====================================================
-- 089 - Hardening SQL (payments + invites + webhook logs)
-- =====================================================
-- Objectif:
-- - Renforcer la robustesse des migrations 088 et antérieures
-- - Garder le script idempotent (ré-exécutable sans risque)
-- =====================================================

BEGIN;

-- Assurer gen_random_uuid() disponible
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1) restaurant_invites : colonnes utiles si absentes
-- =====================================================
ALTER TABLE public.restaurant_invites
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_uses INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS used_count INT NOT NULL DEFAULT 0;

-- Normaliser max_uses / used_count
UPDATE public.restaurant_invites
SET max_uses = 1
WHERE max_uses IS NULL OR max_uses < 1;

UPDATE public.restaurant_invites
SET used_count = 0
WHERE used_count IS NULL OR used_count < 0;

-- =====================================================
-- 2) Fonction sûre de validation d'invitation
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_restaurant_invite(invite_token TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  invite_id UUID,
  is_used BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (
      ri.token IS NOT NULL
      AND COALESCE(ri.is_used, false) = false
      AND (ri.expires_at IS NULL OR ri.expires_at > NOW())
      AND COALESCE(ri.used_count, 0) < GREATEST(COALESCE(ri.max_uses, 1), 1)
    ) AS valid,
    ri.id AS invite_id,
    COALESCE(ri.is_used, false) AS is_used,
    CASE
      WHEN ri.token IS NULL THEN 'Token introuvable'
      WHEN COALESCE(ri.is_used, false) THEN 'Token deja utilise'
      WHEN ri.expires_at IS NOT NULL AND ri.expires_at <= NOW() THEN 'Token expire'
      WHEN COALESCE(ri.used_count, 0) >= GREATEST(COALESCE(ri.max_uses, 1), 1) THEN 'Nombre d utilisations depasse'
      ELSE 'Token valide'
    END AS reason
  FROM (
    SELECT *
    FROM public.restaurant_invites
    WHERE token = invite_token
    LIMIT 1
  ) ri;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, NULL::UUID, NULL::BOOLEAN, 'Token introuvable';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_restaurant_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_restaurant_invite(TEXT) TO anon, authenticated, service_role;

-- =====================================================
-- 3) payments : compléter la structure si table déjà existante
-- =====================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS transaction_ref TEXT,
  ADD COLUMN IF NOT EXISTS order_id UUID,
  ADD COLUMN IF NOT EXISTS restaurant_id UUID,
  ADD COLUMN IF NOT EXISTS ticket_purchase_id UUID,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'geniuspay',
  ADD COLUMN IF NOT EXISTS provider_response JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Statuts de paiement alignés avec webhooks courants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_status_check_v2'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_status_check_v2
      CHECK (
        status::text IN (
          'pending',
          'processing',
          'confirmed',
          'failed',
          'cancelled',
          'expired',
          'refunded',
          'completed'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_payments_ticket_purchase_id ON public.payments(ticket_purchase_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- updated_at automatique sur UPDATE
CREATE OR REPLACE FUNCTION public.set_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_payments_updated_at ON public.payments;
CREATE TRIGGER trg_set_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.set_payments_updated_at();

-- =====================================================
-- 4) webhook_logs : index de déduplication optionnel
-- =====================================================
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'geniuspay',
  event_type TEXT,
  payload JSONB,
  signature_ok BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permet de réduire les doublons exacts (provider + event_type + payload hash)
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS payload_hash TEXT;

UPDATE public.webhook_logs
SET payload_hash = md5(COALESCE(payload::text, ''))
WHERE payload_hash IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_payload_hash ON public.webhook_logs(payload_hash);

COMMIT;

-- =====================================================
-- TERMINE
-- =====================================================
