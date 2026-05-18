-- =====================================================
-- 094 - Payment Reliability P0
-- =====================================================
-- Ajoute:
--   1. Table payment_attempts (idempotency serveur pour POST /api/payments/initiate)
--   2. Table webhook_events (dedup inbound GeniusPay)
--   3. RPC confirm_payment(...) — écriture atomique des 4 tables
--      (payments, orders, ticket_purchases, ticket_orders + notifications)
--      en une seule transaction. Remplace les 5 UPDATE séquentiels
--      non-atomiques du webhook (cf. api/webhooks/index.ts handlePaymentSuccess)
--      et du polling fallback (cf. api/payments/initiate.ts confirmPaymentInDatabase).
--   4. Valeur 'payment_failed' dans l'ENUM order_status
--      (remplace le workaround 'cancelled' pour les paiements échoués)
--
-- Cette migration est IDEMPOTENTE (IF NOT EXISTS partout).
-- =====================================================

-- =====================================================
-- 1. payment_attempts : idempotency côté serveur
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_attempts (
  idempotency_key UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ticket_purchase_id UUID REFERENCES ticket_purchases(id) ON DELETE SET NULL,
  request JSONB NOT NULL,
  response JSONB,
  status TEXT NOT NULL DEFAULT 'in_flight'
    CHECK (status IN ('in_flight','succeeded','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_user
  ON payment_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created
  ON payment_attempts(created_at);

-- RLS: service_role uniquement (bypass). Aucune policy publique
-- → lecture/écriture seulement via les serverless functions avec
-- la clé SUPABASE_SERVICE_ROLE_KEY.
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_payment_attempts" ON payment_attempts;
CREATE POLICY "service_role_only_payment_attempts" ON payment_attempts
  FOR ALL USING (false) WITH CHECK (false);

-- =====================================================
-- 2. webhook_events : dedup inbound
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'geniuspay',
  event_type TEXT NOT NULL,
  reference TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','processed','error'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_reference
  ON webhook_events(reference);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received
  ON webhook_events(received_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_webhook_events" ON webhook_events;
CREATE POLICY "service_role_only_webhook_events" ON webhook_events
  FOR ALL USING (false) WITH CHECK (false);

-- =====================================================
-- 3. ENUM order_status : ajouter 'payment_failed'
-- =====================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'payment_failed'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
  ) THEN
    ALTER TYPE order_status ADD VALUE 'payment_failed';
  END IF;
END $$;

-- =====================================================
-- 4. RPC confirm_payment : écriture atomique
-- =====================================================
-- Sémantique:
--   - UPSERT payments sur transaction_ref (idempotent sur rejeu webhook).
--   - UPDATE orders / ticket_purchases / ticket_orders uniquement si
--     la ligne cible n'est pas déjà dans un état final (guarded update).
--   - INSERT notifications uniquement quand la transition a réellement eu lieu
--     (évite les doublons sur race webhook↔polling).
--   - Retourne l'id des rows effectivement confirmées.
-- =====================================================
CREATE OR REPLACE FUNCTION public.confirm_payment(
  p_reference TEXT,
  p_amount NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'XOF',
  p_provider_response JSONB DEFAULT '{}'::JSONB,
  p_order_id UUID DEFAULT NULL,
  p_ticket_purchase_id UUID DEFAULT NULL,
  p_ticket_order_id UUID DEFAULT NULL,
  p_restaurant_id UUID DEFAULT NULL
)
RETURNS TABLE(
  confirmed_order_id UUID,
  confirmed_ticket_purchase_id UUID,
  confirmed_ticket_order_id UUID,
  payment_row_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID := NULL;
  v_ticket_id UUID := NULL;
  v_ticket_order_id UUID := NULL;
  v_payment_id UUID := NULL;
  v_ticket_event_id UUID := NULL;
  v_ticket_customer_id UUID := NULL;
  v_order_restaurant_id UUID := p_restaurant_id;
BEGIN
  IF p_reference IS NULL OR length(p_reference) = 0 THEN
    RAISE EXCEPTION 'confirm_payment: reference is required';
  END IF;

  -- 1) payments (UPSERT idempotent)
  INSERT INTO payments (
    transaction_ref, order_id, restaurant_id, ticket_purchase_id,
    amount, currency, method, provider, status, provider_response, confirmed_at
  )
  VALUES (
    p_reference, p_order_id, p_restaurant_id, p_ticket_purchase_id,
    COALESCE(p_amount, 0), COALESCE(p_currency, 'XOF'),
    'geniuspay', 'geniuspay', 'confirmed',
    COALESCE(p_provider_response, '{}'::JSONB), now()
  )
  ON CONFLICT (transaction_ref) DO UPDATE SET
    status            = 'confirmed',
    confirmed_at      = COALESCE(payments.confirmed_at, now()),
    provider_response = COALESCE(EXCLUDED.provider_response, payments.provider_response),
    -- ne pas écraser order_id / restaurant_id / ticket_purchase_id / amount / currency
    -- si déjà renseignés (évite d'effacer des valeurs correctes avec des NULL)
    order_id            = COALESCE(payments.order_id,            EXCLUDED.order_id),
    restaurant_id       = COALESCE(payments.restaurant_id,       EXCLUDED.restaurant_id),
    ticket_purchase_id  = COALESCE(payments.ticket_purchase_id,  EXCLUDED.ticket_purchase_id),
    amount              = CASE WHEN payments.amount = 0 THEN EXCLUDED.amount ELSE payments.amount END,
    updated_at          = now()
  RETURNING id INTO v_payment_id;

  -- 2) orders (guarded)
  IF p_order_id IS NOT NULL THEN
    UPDATE orders
       SET status      = 'confirmed'::order_status,
           payment_ref = p_reference,
           paid_at     = now(),
           updated_at  = now()
     WHERE id = p_order_id
       AND status <> 'confirmed'::order_status
    RETURNING id, restaurant_id INTO v_order_id, v_order_restaurant_id;

    IF v_order_id IS NOT NULL AND v_order_restaurant_id IS NOT NULL THEN
      INSERT INTO notifications (restaurant_id, type, title, message, data)
      VALUES (
        v_order_restaurant_id, 'new_order',
        'Nouvelle commande payée',
        'Commande confirmée #' || substr(v_order_id::TEXT, 1, 8),
        jsonb_build_object('order_id', v_order_id)
      );
    END IF;
  END IF;

  -- 3) ticket_purchases (guarded)
  IF p_ticket_purchase_id IS NOT NULL THEN
    UPDATE ticket_purchases
       SET status            = 'confirmed',
           confirmed_at      = now(),
           confirmation_sent = FALSE,
           payment_ref       = p_reference
     WHERE id = p_ticket_purchase_id
       AND status = 'pending'
    RETURNING id, event_id, customer_id
      INTO v_ticket_id, v_ticket_event_id, v_ticket_customer_id;

    IF v_ticket_id IS NOT NULL AND v_ticket_customer_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_ticket_customer_id, 'payment_success',
        'Paiement confirmé',
        'Votre billet a été confirmé automatiquement.',
        jsonb_build_object('ticket_id', v_ticket_id, 'event_id', v_ticket_event_id)
      );
    END IF;
  END IF;

  -- 4) ticket_orders (pas d'ENUM strict ici, cf. migration 091)
  IF p_ticket_order_id IS NOT NULL THEN
    UPDATE ticket_orders
       SET status     = 'paid',
           paid_at    = now(),
           updated_at = now()
     WHERE id = p_ticket_order_id
       AND status <> 'paid'
    RETURNING id INTO v_ticket_order_id;
  END IF;

  RETURN QUERY SELECT v_order_id, v_ticket_id, v_ticket_order_id, v_payment_id;
END;
$$;

-- Autorise le service_role (utilisé par les serverless functions) à exécuter.
-- Aucun client anon/authenticated ne doit pouvoir l'appeler directement.
REVOKE ALL ON FUNCTION public.confirm_payment(
  TEXT, NUMERIC, TEXT, JSONB, UUID, UUID, UUID, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_payment(
  TEXT, NUMERIC, TEXT, JSONB, UUID, UUID, UUID, UUID
) TO service_role;

-- =====================================================
-- 5. Purge automatique payment_attempts (> 14 jours)
-- =====================================================
-- Appelée depuis le cron cleanup existant (api/cron?job=cleanup).
-- Silencieuse si pas d'entrée à supprimer.
CREATE OR REPLACE FUNCTION public.cleanup_payment_attempts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  DELETE FROM payment_attempts
   WHERE created_at < now() - INTERVAL '14 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  DELETE FROM webhook_events
   WHERE received_at < now() - INTERVAL '30 days';

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_payment_attempts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_payment_attempts() TO service_role;

-- =====================================================
-- Fin migration 094
-- =====================================================
