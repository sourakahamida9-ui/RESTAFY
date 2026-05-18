-- =====================================================
-- 100 - confirm_payment: fallback lookup by payment_ref
-- =====================================================
-- When GeniusPay webhooks don't echo metadata, the RPC receives
-- p_ticket_purchase_id = NULL and silently skips the ticket update.
-- This migration adds a fallback: if the explicit ID is NULL, try to
-- find the ticket_purchase (or order) by matching payment_ref = p_reference.
--
-- This is IDEMPOTENT (CREATE OR REPLACE).
-- =====================================================

CREATE OR REPLACE FUNCTION public.confirm_payment(
  p_reference TEXT,
  p_amount NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'XOF',
  p_provider_response JSONB DEFAULT '{}'::JSONB,
  p_order_id UUID DEFAULT NULL,
  p_ticket_purchase_id UUID DEFAULT NULL,
  p_ticket_order_id UUID DEFAULT NULL,
  p_restaurant_id UUID DEFAULT NULL,
  p_skip_payments_upsert BOOLEAN DEFAULT FALSE
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
  v_resolved_ticket_purchase_id UUID := p_ticket_purchase_id;
  v_resolved_order_id UUID := p_order_id;
BEGIN
  IF p_reference IS NULL OR length(p_reference) = 0 THEN
    RAISE EXCEPTION 'confirm_payment: reference is required';
  END IF;

  -- Fallback: resolve ticket_purchase_id by payment_ref if not provided
  IF v_resolved_ticket_purchase_id IS NULL THEN
    SELECT id INTO v_resolved_ticket_purchase_id
      FROM ticket_purchases
     WHERE payment_ref = p_reference AND status = 'pending'
     LIMIT 1;
  END IF;

  -- Fallback: resolve order_id by payment_ref if not provided
  IF v_resolved_order_id IS NULL THEN
    SELECT id, restaurant_id INTO v_resolved_order_id, v_order_restaurant_id
      FROM orders
     WHERE payment_ref = p_reference AND status <> 'confirmed'
     LIMIT 1;
  END IF;

  -- 1) payments (UPSERT idempotent)
  IF NOT p_skip_payments_upsert THEN
    INSERT INTO payments (
      transaction_ref, order_id, restaurant_id, ticket_purchase_id,
      amount, currency, method, provider, status, provider_response, confirmed_at
    )
    VALUES (
      p_reference, v_resolved_order_id, COALESCE(v_order_restaurant_id, p_restaurant_id), v_resolved_ticket_purchase_id,
      COALESCE(p_amount, 0), COALESCE(p_currency, 'XOF'),
      'geniuspay', 'geniuspay', 'confirmed',
      COALESCE(p_provider_response, '{}'::JSONB), now()
    )
    ON CONFLICT (transaction_ref) DO UPDATE SET
      status            = 'confirmed',
      confirmed_at      = COALESCE(payments.confirmed_at, now()),
      provider_response = COALESCE(EXCLUDED.provider_response, payments.provider_response),
      order_id            = COALESCE(payments.order_id,            EXCLUDED.order_id),
      restaurant_id       = COALESCE(payments.restaurant_id,       EXCLUDED.restaurant_id),
      ticket_purchase_id  = COALESCE(payments.ticket_purchase_id,  EXCLUDED.ticket_purchase_id),
      amount              = CASE WHEN payments.amount = 0 THEN EXCLUDED.amount ELSE payments.amount END,
      updated_at          = now()
    RETURNING id INTO v_payment_id;
  ELSE
    SELECT id INTO v_payment_id FROM payments WHERE transaction_ref = p_reference LIMIT 1;
  END IF;

  -- 2) orders (guarded)
  IF v_resolved_order_id IS NOT NULL THEN
    UPDATE orders
       SET status      = 'confirmed'::order_status,
           payment_ref = p_reference,
           paid_at     = now(),
           updated_at  = now()
     WHERE id = v_resolved_order_id
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
  IF v_resolved_ticket_purchase_id IS NOT NULL THEN
    UPDATE ticket_purchases
       SET status            = 'confirmed',
           confirmed_at      = now(),
           confirmation_sent = FALSE,
           payment_ref       = p_reference
     WHERE id = v_resolved_ticket_purchase_id
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

  -- 4) ticket_orders (guarded)
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
