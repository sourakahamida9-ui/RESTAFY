/**
 * Webhooks consolidés - Vercel Serverless
 *
 * Routing :
 *   - Kkiapay  : POST /api/webhooks (header `x-kkiapay-secret`)
 *                → dispatché vers handleKkiapaySuccess / handleKkiapayFailed
 *   - GeniusPay (legacy) : POST /api/webhooks?type=payment|payout (header
 *                `x-webhook-signature` + HMAC SHA-256). Plus utilisé en prod
 *                depuis la migration 100% Kkiapay — conservé pour absorber
 *                les rejeux éventuels d'un ancien webhook GP en flight.
 *                Renvoie 410 Gone si `GENIUSPAY_WEBHOOK_SECRET` est absent.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin';

// Secret utilisé uniquement pour la vérification HMAC des webhooks GeniusPay
// legacy. Les webhooks Kkiapay utilisent KKIAPAY_SECRET_KEY directement via
// verifyKkiapayWebhook() — ne PAS factoriser ici.
const WEBHOOK_SECRET = process.env.GENIUSPAY_WEBHOOK_SECRET || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export const config = { api: { bodyParser: false } };

// Hard cap on webhook payloads. GeniusPay envoie typiquement < 4 KB. On
// accepte 256 KB largement pour absorber des évolutions et des replays
// avec metadata étendue, et on rejette tout ce qui dépasse pour empêcher
// un attaquant de forcer la mémoire sandbox à exploser ou de pomper le
// budget execution time.
const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

class WebhookBodyTooLarge extends Error {
  constructor(public received: number) {
    super(`Webhook payload too large (${received} > ${MAX_WEBHOOK_BODY_BYTES} bytes)`);
    this.name = 'WebhookBodyTooLarge';
  }
}

// ─── UTILS ─────────────────────────────────────────────────────────────────
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > MAX_WEBHOOK_BODY_BYTES) {
        // Stopper la lecture le plus tôt possible et libérer la mémoire.
        req.destroy();
        reject(new WebhookBodyTooLarge(total));
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(rawBody: Buffer, signature: string, timestamp: string): boolean {
  const webhookTime = parseInt(timestamp, 10) * 1000;
  const delta = Date.now() - webhookTime;
  if (isNaN(delta) || Math.abs(delta) > REPLAY_WINDOW_MS) return false;

  const expectedSignature = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  const receivedSignature = String(signature || '').replace(/^sha256=/i, '').trim().toLowerCase();

  try {
    if (!receivedSignature || receivedSignature.length !== expectedSignature.length) return false;
    return timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

async function logWebhook(supabase: any, provider: string, event: string, payload: any, success: boolean, status: string) {
  try {
    await supabase.from('webhook_logs').insert({ provider, event_type: event, payload, processed: success, status });
  } catch (err) {
    console.error('[Webhook] Log error:', err);
  }
}

// Dédup des webhooks inbound via la table webhook_events (migration 094).
// Si GeniusPay fournit un id (header X-Webhook-Id / X-Webhook-Event-Id), on
// l'utilise ; sinon on retombe sur un SHA-256 du payload brut. Dans tous les
// cas, on marque la ligne 'received' sur le premier passage et 'processed'
// après traitement réussi — les rejeux (webhook retry GeniusPay côté
// upstream) voient 'processed' et short-circuitent.
async function checkAndRecordWebhookEvent(
  supabase: any,
  opts: { id: string; eventType: string; reference: string | null },
): Promise<{ alreadyProcessed: boolean }> {
  try {
    const { data: existing } = await supabase
      .from('webhook_events')
      .select('status')
      .eq('id', opts.id)
      .maybeSingle();

    if (existing && existing.status === 'processed') {
      return { alreadyProcessed: true };
    }

    if (!existing) {
      await supabase.from('webhook_events').insert({
        id: opts.id,
        provider: 'geniuspay',
        event_type: opts.eventType,
        reference: opts.reference,
        status: 'received',
      });
    }

    return { alreadyProcessed: false };
  } catch (err) {
    console.error('[Webhook] dedup check failed:', err);
    // En cas d'erreur sur la table dedup on continue quand même — le reste
    // de la chaîne (guarded UPDATE, UPSERT payments) protège contre les
    // doublons au niveau métier. Mieux vaut un double traitement inoffensif
    // que de rater un webhook de confirmation.
    return { alreadyProcessed: false };
  }
}

async function markWebhookEventProcessed(supabase: any, id: string, status: 'processed' | 'error' = 'processed') {
  try {
    await supabase
      .from('webhook_events')
      .update({ status, processed_at: new Date().toISOString() })
      .eq('id', id);
  } catch (err) {
    console.error('[Webhook] mark processed failed:', err);
  }
}

// ─── PAYOUT HANDLERS ───────────────────────────────────────────────────────
async function handlePayoutCompleted(supabase: any, data: any) {
  const reference = data.reference;
  const geniusPayPayoutId = data.id;

  // Lookup par geniuspay_payout_id avec deux .eq() séquentiels.
  // Avant: .or(`geniuspay_payout_id.eq.${id},geniuspay_payout_id.eq.${ref}`)
  // interpolait des valeurs externes (même venant d'un webhook signé) dans un
  // filtre PostgREST où la virgule sépare les conditions — défense en
  // profondeur, on évite l'interpolation chaîne.
  let { data: payout } = await supabase
    .from('restaurant_payouts')
    .select('*, restaurants!inner(id, pending_payout_amount)')
    .eq('geniuspay_payout_id', geniusPayPayoutId)
    .maybeSingle();
  if (!payout && reference) {
    const second = await supabase
      .from('restaurant_payouts')
      .select('*, restaurants!inner(id, pending_payout_amount)')
      .eq('geniuspay_payout_id', reference)
      .maybeSingle();
    payout = second.data;
  }

  if (!payout) return { error: 'Payout not found' };

  await supabase.from('restaurant_payouts').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    provider_response: data,
    updated_at: new Date().toISOString(),
  }).eq('id', payout.id);

  const currentPending = payout.restaurants?.pending_payout_amount || 0;
  await supabase.from('restaurants').update({
    pending_payout_amount: Math.max(0, currentPending - payout.amount),
    last_payout_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', payout.restaurant_id);

  // Email "retrait confirmé" au propriétaire — best-effort.
  try {
    await sendPayoutCompletedEmailToOwner(supabase, {
      restaurantId: payout.restaurant_id,
      reference: reference || payout.reference || payout.geniuspay_payout_id || '',
      amount: Number(payout.amount || 0),
      recipientPhone: payout.recipient_phone || data?.recipient?.phone || '',
      recipientName: payout.recipient_name || data?.recipient?.name || null,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Webhook] sendPayoutCompletedEmailToOwner failed:', err);
  }

  return { success: true };
}

async function handlePayoutFailed(supabase: any, data: any) {
  const reference = data.reference;
  const failureReason = data.failure_reason || data.error || 'Unknown error';

  // Même stratégie de lookup que dans handlePayoutCompleted (cf. commentaire là-bas).
  let { data: payout } = await supabase
    .from('restaurant_payouts')
    .select('*, restaurants!inner(id, available_balance, pending_payout_amount)')
    .eq('geniuspay_payout_id', data.id)
    .maybeSingle();
  if (!payout && reference) {
    const second = await supabase
      .from('restaurant_payouts')
      .select('*, restaurants!inner(id, available_balance, pending_payout_amount)')
      .eq('geniuspay_payout_id', reference)
      .maybeSingle();
    payout = second.data;
  }

  if (!payout) return { error: 'Payout not found' };

  await supabase.from('restaurant_payouts').update({
    status: 'failed',
    failure_reason: failureReason,
    provider_response: data,
    updated_at: new Date().toISOString(),
  }).eq('id', payout.id);

  const currentAvailable = payout.restaurants?.available_balance || 0;
  const currentPending = payout.restaurants?.pending_payout_amount || 0;

  await supabase.from('restaurants').update({
    available_balance: currentAvailable + payout.amount,
    pending_payout_amount: Math.max(0, currentPending - payout.amount),
    updated_at: new Date().toISOString(),
  }).eq('id', payout.restaurant_id);

  return { success: true };
}

// ─── PAYMENT HANDLER ────────────────────────────────────────────────────────
// Appelle la RPC Postgres atomique `confirm_payment` (migration 094). La RPC
// fait en une seule transaction:
//   - UPSERT payments (idempotent sur transaction_ref)
//   - UPDATE guarded de orders / ticket_purchases / ticket_orders
//   - INSERT notifications (uniquement si la transition a eu lieu)
// Si la transaction échoue côté DB, on remonte l'erreur au handler principal
// qui renverra 500 → GeniusPay retentera. Plus de dérive silencieuse due à
// des awaits séquentiels non-atomiques.
// ─── Credit restaurant balance after payment ──────────────────────────────
// The DB trigger `credit_restaurant_after_payment` (script 093) only fires on
// AFTER UPDATE, but the confirm_payment RPC does an UPSERT which may INSERT
// (not UPDATE) for new payments — the trigger never fires. This function
// explicitly credits the restaurant balance, idempotent via reference check.
async function creditRestaurantBalance(
  supabase: any,
  restaurantId: string,
  grossAmount: number,
  reference: string,
  currency: string = 'XOF',
): Promise<void> {
  if (!restaurantId || !grossAmount || grossAmount <= 0) return;

  // Idempotency: check if a transaction already exists for this reference
  const { data: existing } = await supabase
    .from('restaurant_transactions')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('reference', reference)
    .maybeSingle();
  if (existing) {
    console.log('[Webhook] Balance already credited for reference:', reference);
    return;
  }

  // Calculate net amount (same formula as DB trigger: 1% + 100 + 150)
  const fees = (grossAmount * 0.01) + 100 + 150;
  const netAmount = grossAmount - fees;
  if (netAmount <= 0) return;

  // Credit the restaurant
  const { error: updateErr } = await supabase.rpc('credit_restaurant_balance_safe', {
    p_restaurant_id: restaurantId,
    p_net_amount: netAmount,
    p_gross_amount: grossAmount,
    p_fees: fees,
    p_reference: reference,
    p_currency: currency,
  });

  // If the RPC doesn't exist, fall back to direct updates
  if (updateErr) {
    console.warn('[Webhook] credit_restaurant_balance_safe RPC not available, using direct update:', updateErr.message);

    // Direct update: credit balance
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('available_balance, total_earnings')
      .eq('id', restaurantId)
      .maybeSingle();

    if (restaurant) {
      await supabase.from('restaurants').update({
        available_balance: (restaurant.available_balance || 0) + netAmount,
        total_earnings: (restaurant.total_earnings || 0) + netAmount,
        updated_at: new Date().toISOString(),
      }).eq('id', restaurantId);

      // Record the transaction for audit trail
      await supabase.from('restaurant_transactions').insert({
        restaurant_id: restaurantId,
        type: 'payment_received',
        amount: netAmount,
        currency,
        reference,
        description: `Paiement reçu (webhook) — brut: ${grossAmount}, frais: ${Math.round(fees)}`,
        metadata: { gross_amount: grossAmount, fees, source: 'webhook_credit' },
      });

      console.log(`[Webhook] Restaurant ${restaurantId} credited: +${netAmount} ${currency} (gross: ${grossAmount}, fees: ${Math.round(fees)})`);
    }
  }
}

async function handlePaymentSuccess(supabase: any, data: any, payload: any) {
  const reference = data?.reference || payload?.reference || '';
  if (!reference) {
    throw new Error('handlePaymentSuccess: missing reference in payload');
  }

  const metaOrderId = data?.metadata?.order_id || payload?.metadata?.order_id || null;
  let ticketPurchaseId = data?.metadata?.ticket_purchase_id || payload?.metadata?.ticket_purchase_id || null;
  const ticketOrderId = data?.metadata?.ticket_order_id || payload?.metadata?.ticket_order_id || null;
  let restaurantId = data?.metadata?.restaurant_id || payload?.metadata?.restaurant_id || null;

  // Fallback: if metadata doesn't include ticket_purchase_id (GeniusPay may
  // not echo metadata in webhooks), look it up by payment_ref which was set
  // during /api/payments/initiate (Step 8bis).
  if (!ticketPurchaseId && reference) {
    const { data: ticketRow } = await supabase
      .from('ticket_purchases')
      .select('id')
      .eq('payment_ref', reference)
      .eq('status', 'pending')
      .maybeSingle();
    if (ticketRow) {
      ticketPurchaseId = ticketRow.id;
      console.log('[Webhook] Resolved ticket_purchase_id via payment_ref fallback:', ticketPurchaseId);
    }
  }

  // Fallback: resolve restaurant_id from ticket_purchase → event → restaurant
  if (!restaurantId && ticketPurchaseId) {
    try {
      const { data: tp } = await supabase
        .from('ticket_purchases')
        .select('event_id, events!inner(restaurant_id)')
        .eq('id', ticketPurchaseId)
        .maybeSingle();
      if (tp?.events?.restaurant_id) {
        restaurantId = tp.events.restaurant_id;
        console.log('[Webhook] Resolved restaurant_id from ticket_purchase→event:', restaurantId);
      }
    } catch (err) {
      console.warn('[Webhook] Could not resolve restaurant_id from ticket_purchase:', err);
    }
  }

  // Same fallback for orders
  let resolvedOrderId = metaOrderId;
  if (!resolvedOrderId && reference) {
    const { data: orderRow } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_ref', reference)
      .neq('status', 'confirmed')
      .maybeSingle();
    if (orderRow) {
      resolvedOrderId = orderRow.id;
      console.log('[Webhook] Resolved order_id via payment_ref fallback:', resolvedOrderId);
    }
  }

  // Fallback: resolve restaurant_id from order
  if (!restaurantId && resolvedOrderId) {
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('restaurant_id')
        .eq('id', resolvedOrderId)
        .maybeSingle();
      if (order?.restaurant_id) {
        restaurantId = order.restaurant_id;
        console.log('[Webhook] Resolved restaurant_id from order:', restaurantId);
      }
    } catch (err) {
      console.warn('[Webhook] Could not resolve restaurant_id from order:', err);
    }
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('confirm_payment', {
    p_reference: reference,
    p_amount: Number(data?.amount ?? 0),
    p_currency: String(data?.currency ?? 'XOF'),
    p_provider_response: payload ?? {},
    p_order_id: resolvedOrderId,
    p_ticket_purchase_id: ticketPurchaseId,
    p_ticket_order_id: ticketOrderId,
    p_restaurant_id: restaurantId,
  });

  if (rpcError) {
    console.error('[Webhook] confirm_payment RPC failed, using direct update fallback:', rpcError);

    // Fallback: direct SQL updates when the RPC is missing or fails
    const paidAt = new Date().toISOString();
    let fallbackTicketId: string | null = null;
    let fallbackTicketOrderConfirmed = false;
    let fallbackOrderConfirmed = false;
    const hadRelevantIds = !!(ticketPurchaseId || ticketOrderId || resolvedOrderId);

    if (ticketPurchaseId) {
      try {
        const { data: updated } = await supabase
          .from('ticket_purchases')
          .update({ status: 'confirmed' })
          .eq('id', ticketPurchaseId)
          .eq('status', 'pending')
          .select('id, customer_id, event_id');
        if (updated?.[0]) {
          fallbackTicketId = updated[0].id;
          try {
            await supabase.from('ticket_purchases')
              .update({ confirmed_at: paidAt, confirmation_sent: false } as any)
              .eq('id', fallbackTicketId);
          } catch { /* optional columns may not exist */ }
          if (updated[0].customer_id) {
            try {
              await supabase.from('notifications').insert({
                user_id: updated[0].customer_id,
                type: 'payment_success',
                title: 'Paiement confirmé',
                message: 'Votre billet a été confirmé.',
                data: { ticket_id: fallbackTicketId, event_id: updated[0].event_id },
              });
            } catch { /* notification insert is best-effort */ }
          }
        }
      } catch (err) {
        console.error('[Webhook] Fallback ticket_purchases update failed:', err);
      }
    }

    if (ticketOrderId) {
      try {
        const { error: toErr } = await supabase.from('ticket_orders')
          .update({ status: 'paid', paid_at: paidAt, updated_at: paidAt })
          .eq('id', ticketOrderId);
        if (toErr) {
          console.error('[Webhook] Fallback ticket_orders update error:', toErr);
        } else {
          fallbackTicketOrderConfirmed = true;
        }
      } catch (err) {
        console.error('[Webhook] Fallback ticket_orders update failed:', err);
      }
    }

    if (resolvedOrderId) {
      try {
        const { error: ordErr } = await supabase.from('orders')
          .update({ status: 'confirmed', paid_at: paidAt, updated_at: paidAt } as any)
          .eq('id', resolvedOrderId)
          .neq('status', 'confirmed');
        if (ordErr) {
          console.error('[Webhook] Fallback orders update error:', ordErr);
        } else {
          fallbackOrderConfirmed = true;
        }
      } catch (err) {
        console.error('[Webhook] Fallback orders update failed:', err);
      }
    }

    // If we had IDs to process but nothing was confirmed, throw so
    // the main handler returns 500 and GeniusPay retries the webhook.
    const anyConfirmed = fallbackTicketId || fallbackTicketOrderConfirmed || fallbackOrderConfirmed;
    if (hadRelevantIds && !anyConfirmed) {
      throw new Error('Fallback: all DB updates failed — no payment was confirmed');
    }

    // Credit restaurant balance in fallback path
    if (restaurantId && anyConfirmed) {
      try {
        await creditRestaurantBalance(
          supabase,
          restaurantId,
          Number(data?.amount ?? 0),
          reference,
          String(data?.currency ?? 'XOF'),
        );
      } catch (err) {
        console.error('[Webhook] Fallback creditRestaurantBalance failed (non-blocking):', err);
      }
    }

    // Send confirmation emails from fallback
    if (fallbackTicketId) {
      try { await sendTicketPurchaseEmailFromWebhook(supabase, fallbackTicketId); }
      catch (err) { console.error('[Webhook] Fallback sendTicketPurchaseEmailFromWebhook failed:', err); }
    }
    if (fallbackTicketOrderConfirmed && ticketOrderId) {
      try { await sendTicketOrderEmailFromWebhook(supabase, ticketOrderId); }
      catch (err) { console.error('[Webhook] Fallback sendTicketOrderEmailFromWebhook failed:', err); }
    }

    // Notification email "paiement reçu" au propriétaire du restaurant
    // (uniquement pour les commandes resto, pas les billets événements).
    if (fallbackOrderConfirmed && resolvedOrderId) {
      try {
        const { data: order } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, customer_name, restaurant_id, paid_at')
          .eq('id', resolvedOrderId)
          .maybeSingle();
        if (order) {
          await sendPaymentReceivedEmailToOwner(supabase, {
            restaurantId: order.restaurant_id ?? restaurantId ?? null,
            orderId: order.id,
            orderNumber: order.order_number ?? null,
            customerName: order.customer_name ?? null,
            reference,
            amount: Number(order.total_amount ?? data?.amount ?? 0),
            currency: String(data?.currency ?? 'XOF'),
            paidAt: order.paid_at ?? paidAt,
          });
        }
      } catch (err) {
        console.error('[Webhook] Fallback sendPaymentReceivedEmailToOwner failed:', err);
      }
    }

    return {
      success: true,
      reference,
      order_id: resolvedOrderId,
      ticket_id: fallbackTicketId,
      ticket_order_id: ticketOrderId,
    };
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const confirmedTicketId = row?.confirmed_ticket_purchase_id ?? null;
  const confirmedTicketOrderId = row?.confirmed_ticket_order_id ?? null;

  // Credit restaurant balance (the DB trigger may not fire for UPSERTs that do INSERT)
  if (restaurantId) {
    try {
      await creditRestaurantBalance(
        supabase,
        restaurantId,
        Number(data?.amount ?? 0),
        reference,
        String(data?.currency ?? 'XOF'),
      );
    } catch (err) {
      console.error('[Webhook] creditRestaurantBalance failed (non-blocking):', err);
    }
  }

  // Fire confirmation emails AFTER the RPC has flipped the row to confirmed.
  if (confirmedTicketId) {
    try { await sendTicketPurchaseEmailFromWebhook(supabase, confirmedTicketId); }
    catch (err) { console.error('[Webhook] sendTicketPurchaseEmailFromWebhook failed:', err); }
  }
  if (confirmedTicketOrderId) {
    try { await sendTicketOrderEmailFromWebhook(supabase, confirmedTicketOrderId); }
    catch (err) { console.error('[Webhook] sendTicketOrderEmailFromWebhook failed:', err); }
  }

  // Email "paiement reçu" au propriétaire du restaurant pour les commandes
  // resto (le RPC confirm_payment renvoie l'order_id quand applicable).
  const confirmedOrderId = row?.confirmed_order_id ?? null;
  if (confirmedOrderId) {
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, customer_name, restaurant_id, paid_at')
        .eq('id', confirmedOrderId)
        .maybeSingle();
      if (order) {
        await sendPaymentReceivedEmailToOwner(supabase, {
          restaurantId: order.restaurant_id ?? restaurantId ?? null,
          orderId: order.id,
          orderNumber: order.order_number ?? null,
          customerName: order.customer_name ?? null,
          reference,
          amount: Number(order.total_amount ?? data?.amount ?? 0),
          currency: String(data?.currency ?? 'XOF'),
          paidAt: order.paid_at ?? new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[Webhook] sendPaymentReceivedEmailToOwner failed:', err);
    }
  }

  return {
    success: true,
    reference,
    order_id: confirmedOrderId,
    ticket_id: confirmedTicketId,
    ticket_order_id: confirmedTicketOrderId,
  };
}

// ─── Resend helpers (webhook-side) ─────────────────────────────────────────
// These mirror the helpers in api/payments/initiate.ts. Duplicated here on
// purpose so each Vercel serverless function stays self-contained (no
// cross-directory imports — those caused FUNCTION_INVOCATION_FAILED at
// load-time on the orders/payments routes, see PR #38 audit).

async function sendResendEmail(payload: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[Webhook] RESEND_API_KEY not set - skipping email');
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Restafy <noreply@app.restafy.shop>',
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    }),
  });
  if (!response.ok) {
    const errBody = await response.text();
    console.error('[Webhook] Resend HTTP', response.status, errBody);
  }
}

async function sendTicketPurchaseEmailFromWebhook(supabase: any, ticketId: string): Promise<void> {
  const { data: ticket } = await supabase
    .from('ticket_purchases')
    .select(`
      id, qr_code_data, ticket_number, customer_name, customer_email,
      events:event_id ( title, start_time, location ),
      event_tickets:ticket_id ( name, price )
    `)
    .eq('id', ticketId)
    .single();
  if (!ticket || !ticket.customer_email) return;

  const qrValue = ticket.qr_code_data || ticket.ticket_number || ticket.id;
  const ticketNumber = ticket.ticket_number || `#${String(ticket.id).slice(0, 8).toUpperCase()}`;
  const eventTitle = ticket.events?.title || 'Événement';
  const eventDate = ticket.events?.start_time
    ? new Date(ticket.events.start_time).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
  <div style="background: white; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #FF6B00, #e85d04); padding: 30px 20px; text-align: center;">
      <h1 style="color: white; margin: 0;">🎫 Billet confirmé !</h1>
    </div>
    <div style="padding: 30px;">
      <p>Bonjour <strong>${ticket.customer_name}</strong>,</p>
      <p>Votre paiement a été confirmé. Voici votre billet :</p>
      <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; text-align: center;">
        <p style="font-size: 20px; font-weight: bold;">${eventTitle}</p>
        ${eventDate ? `<p style="color:#666;">${eventDate}</p>` : ''}
        ${ticket.events?.location ? `<p style="color:#666;">📍 ${ticket.events.location}</p>` : ''}
      </div>
      <div style="border: 2px dashed #ddd; border-radius: 12px; padding: 30px; text-align: center; margin: 20px 0;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}" alt="QR Code" style="width:200px;height:200px;">
        <p style="font-family:monospace;margin:15px 0 0;">${ticketNumber}</p>
      </div>
      <p style="color:#999;font-size:12px;text-align:center;">Présentez ce code QR à l'entrée. Disponible aussi dans l'application Restafy.</p>
    </div>
  </div>
</body></html>`.trim();

  await sendResendEmail({ to: ticket.customer_email, subject: `🎫 Votre billet - ${eventTitle}`, html });
}

async function sendTicketOrderEmailFromWebhook(supabase: any, ticketOrderId: string): Promise<void> {
  const { data: order } = await supabase
    .from('ticket_orders')
    .select(`
      id, quantity, total_amount, customer_name, customer_email, payment_reference,
      events:event_id ( title, start_time, location ),
      event_tickets:ticket_type_id ( name, price )
    `)
    .eq('id', ticketOrderId)
    .single();
  if (!order || !order.customer_email) return;

  const eventTitle = order.events?.title || 'Événement';
  const ticketTypeName = order.event_tickets?.name || 'Billet';
  const eventDate = order.events?.start_time
    ? new Date(order.events.start_time).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';
  const refLabel = order.payment_reference || `#${String(order.id).slice(0, 8).toUpperCase()}`;
  const qrValue = order.payment_reference || order.id;

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
  <div style="background: white; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #FF6B00, #e85d04); padding: 30px 20px; text-align: center;">
      <h1 style="color: white; margin: 0;">🎫 Billets confirmés !</h1>
    </div>
    <div style="padding: 30px;">
      <p>Bonjour <strong>${order.customer_name}</strong>,</p>
      <p>Votre paiement de <strong>${Number(order.total_amount).toLocaleString()} FCFA</strong> a été confirmé.</p>
      <div style="background:#f9f9f9;border-radius:12px;padding:20px;text-align:center;">
        <p style="font-size:20px;font-weight:bold;">${eventTitle}</p>
        <p style="color:#666;">${ticketTypeName} × ${order.quantity}</p>
        ${eventDate ? `<p style="color:#666;">${eventDate}</p>` : ''}
        ${order.events?.location ? `<p style="color:#666;">📍 ${order.events.location}</p>` : ''}
      </div>
      <div style="border:2px dashed #ddd;border-radius:12px;padding:30px;text-align:center;margin:20px 0;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}" alt="QR Code" style="width:200px;height:200px;">
        <p style="font-family:monospace;margin:15px 0 0;">${refLabel}</p>
      </div>
      <p style="color:#999;font-size:12px;text-align:center;">Présentez cette référence à l'entrée. Disponible aussi dans l'application Restafy.</p>
    </div>
  </div>
</body></html>`.trim();

  await sendResendEmail({ to: order.customer_email, subject: `🎫 Vos billets - ${eventTitle}`, html });
}

// ─── Owner-facing finance emails ──────────────────────────────────────────
//
// "Paiement reçu" : envoyé au propriétaire du restaurant chaque fois qu'une
// commande passe en `confirmed` après webhook payment.success. Distinct de
// l'email client (qui confirme la livraison du billet). Permet au resto
// d'avoir une trace écrite + de vérifier le solde temps réel.

interface PaymentReceivedPayload {
  restaurantId: string | null;
  orderId: string | null;
  reference: string;
  amount: number;
  currency?: string;
  paidAt: string;
  customerName?: string | null;
  orderNumber?: string | null;
}

async function findRestaurantOwnerEmail(
  supabase: any,
  restaurantId: string | null,
): Promise<{ email: string; name: string | null; balance: number | null } | null> {
  if (!restaurantId) return null;
  // Lookup défensif : on accepte les profils 'restaurant_owner' ou 'admin'
  // (selon la migration courante) liés à ce restaurant. On préfère le plus
  // ancien (created_at ASC) pour cibler le propriétaire historique.
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('restaurant_id', restaurantId)
    .in('role', ['restaurant_owner', 'restaurant', 'admin'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!profile?.email) return null;

  const { data: rest } = await supabase
    .from('restaurants')
    .select('available_balance, name')
    .eq('id', restaurantId)
    .maybeSingle();

  return {
    email: profile.email,
    name: profile.full_name ?? rest?.name ?? null,
    balance: rest?.available_balance ?? null,
  };
}

function fmtAmountFCFA(n: number): string {
  return `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function financeEmailShell(opts: {
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string; emphasize?: boolean }>;
  footer?: string;
}): string {
  const rowsHtml = opts.rows
    .map(
      (r) => `
        <tr>
          <td style="padding:10px 0;color:#6b7280;font-size:13px;">${r.label}</td>
          <td style="padding:10px 0;text-align:right;font-weight:${r.emphasize ? '700' : '600'};color:${r.emphasize ? '#FF6B00' : '#111827'};font-size:${r.emphasize ? '17px' : '14px'};">${r.value}</td>
        </tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f3f4f6;">
  <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #FF6B00, #e85d04); padding: 28px 24px;">
      <h1 style="color:white;margin:0;font-size:20px;letter-spacing:-0.01em;">${opts.title}</h1>
    </div>
    <div style="padding: 28px 24px;">
      <p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.6;">${opts.intro}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
        ${rowsHtml}
      </table>
      ${opts.footer ? `<p style="margin:18px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">${opts.footer}</p>` : ''}
    </div>
    <div style="background:#f9fafb;padding:14px 24px;text-align:center;color:#9ca3af;font-size:11px;">
      Restafy — restafy.shop · Cet email est automatique, ne pas y répondre.
    </div>
  </div>
</body></html>`.trim();
}

interface PayoutCompletedPayload {
  restaurantId: string | null;
  reference: string;
  amount: number;
  recipientPhone: string;
  recipientName: string | null;
  completedAt: string;
}

async function sendPayoutCompletedEmailToOwner(
  supabase: any,
  payload: PayoutCompletedPayload,
): Promise<void> {
  if (!payload.restaurantId) return;
  const owner = await findRestaurantOwnerEmail(supabase, payload.restaurantId);
  if (!owner) return;

  const html = financeEmailShell({
    title: 'Retrait confirmé',
    intro: `Bonjour${owner.name ? ` <strong>${owner.name}</strong>` : ''}, votre retrait a été transféré avec succès sur le numéro Mobile Money indiqué.`,
    rows: [
      { label: 'Type', value: 'Retrait confirmé' },
      { label: 'Montant', value: fmtAmountFCFA(payload.amount), emphasize: true },
      ...(payload.recipientName ? [{ label: 'Bénéficiaire', value: payload.recipientName }] : []),
      ...(payload.recipientPhone ? [{ label: 'Numéro', value: payload.recipientPhone }] : []),
      { label: 'Référence', value: payload.reference || '—' },
      { label: 'Date', value: fmtDateTime(payload.completedAt) },
      ...(owner.balance !== null
        ? [{ label: 'Solde restant', value: fmtAmountFCFA(owner.balance) }]
        : []),
    ],
    footer:
      'Si vous ne recevez pas la transaction Mobile Money sous 30 minutes, contactez notre support.',
  });

  try {
    await sendResendEmail({
      to: owner.email,
      subject: `Restafy — Retrait confirmé (${fmtAmountFCFA(payload.amount)})`,
      html,
    });
  } catch (err) {
    console.error('[Webhook] sendPayoutCompletedEmailToOwner Resend error:', err);
  }
}

async function sendPaymentReceivedEmailToOwner(
  supabase: any,
  payload: PaymentReceivedPayload,
): Promise<void> {
  if (!payload.restaurantId || !payload.orderId) return;
  const owner = await findRestaurantOwnerEmail(supabase, payload.restaurantId);
  if (!owner) {
    console.warn('[Webhook] No owner email found for restaurant', payload.restaurantId);
    return;
  }

  const orderLabel = payload.orderNumber || `#${String(payload.orderId).slice(0, 8).toUpperCase()}`;
  const html = financeEmailShell({
    title: 'Paiement reçu',
    intro: `Bonjour${owner.name ? ` <strong>${owner.name}</strong>` : ''}, vous venez de recevoir un paiement client. Le montant a été ajouté à votre solde Restafy disponible.`,
    rows: [
      { label: 'Type', value: 'Paiement client' },
      { label: 'Commande', value: orderLabel },
      ...(payload.customerName ? [{ label: 'Client', value: payload.customerName }] : []),
      { label: 'Montant', value: fmtAmountFCFA(payload.amount), emphasize: true },
      { label: 'Référence', value: payload.reference },
      { label: 'Date', value: fmtDateTime(payload.paidAt) },
      ...(owner.balance !== null
        ? [{ label: 'Solde après transaction', value: fmtAmountFCFA(owner.balance) }]
        : []),
    ],
    footer:
      'Vous pouvez initier un retrait à tout moment depuis votre tableau de bord, section "Mes Revenus".',
  });

  try {
    await sendResendEmail({
      to: owner.email,
      subject: `Restafy — Paiement reçu (${fmtAmountFCFA(payload.amount)})`,
      html,
    });
  } catch (err) {
    console.error('[Webhook] sendPaymentReceivedEmailToOwner failed:', err);
  }
}

function extractContextIds(data: any, payload: any) {
  return {
    ticketOrderId: data?.metadata?.ticket_order_id || payload?.metadata?.ticket_order_id || null,
    ticketPurchaseId: data?.metadata?.ticket_purchase_id || payload?.metadata?.ticket_purchase_id || null,
    orderId: data?.metadata?.order_id || payload?.metadata?.order_id || null,
  };
}

async function handlePaymentFailed(supabase: any, data: any, payload: any) {
  const reference = data?.reference || payload?.reference || '';
  const { ticketOrderId, ticketPurchaseId, orderId } = extractContextIds(data, payload);

  const nowIso = new Date().toISOString();

  if (ticketOrderId) {
    await supabase.from('ticket_orders').update({ status: 'failed', updated_at: nowIso }).eq('id', ticketOrderId);
  }

  if (ticketPurchaseId) {
    await supabase.from('ticket_purchases').update({ status: 'failed' }).eq('id', ticketPurchaseId);
  } else if (reference) {
    await supabase.from('ticket_purchases').update({ status: 'failed' }).eq('payment_ref', reference);
  }

  // Depuis la migration 094, l'ENUM order_status inclut 'payment_failed'.
  // On essaie d'abord d'écrire cette valeur plus précise ; si le backend
  // n'a pas encore reloadé le schéma (22P02 ou migration pas appliquée),
  // on retombe sur 'cancelled' comme avant.
  const failStatusUpdate = async (match: { id?: string; payment_ref?: string }) => {
    const query = supabase.from('orders').update({ status: 'payment_failed', updated_at: nowIso });
    const execute = match.id ? query.eq('id', match.id) : query.eq('payment_ref', match.payment_ref!);
    const { error } = await execute;
    if (!error) return;
    if (error.code === '22P02' || /invalid input value for enum/i.test(String(error.message))) {
      const fallback = supabase.from('orders').update({ status: 'cancelled', updated_at: nowIso });
      const exec2 = match.id ? fallback.eq('id', match.id) : fallback.eq('payment_ref', match.payment_ref!);
      await exec2;
    } else {
      throw error;
    }
  };

  if (orderId) {
    await failStatusUpdate({ id: orderId });
  } else if (reference) {
    await failStatusUpdate({ payment_ref: reference });
  }

  if (reference) {
    await supabase.from('payments').update({ status: 'failed' }).eq('transaction_ref', reference);
  }
}

async function handlePaymentExpired(supabase: any, data: any, payload: any) {
  const reference = data?.reference || payload?.reference || '';
  const { ticketOrderId, ticketPurchaseId, orderId } = extractContextIds(data, payload);

  const nowIso = new Date().toISOString();

  if (ticketOrderId) {
    await supabase.from('ticket_orders').update({ status: 'expired', updated_at: nowIso }).eq('id', ticketOrderId);
  }

  if (ticketPurchaseId) {
    await supabase.from('ticket_purchases').update({ status: 'expired' }).eq('id', ticketPurchaseId);
  } else if (reference) {
    await supabase.from('ticket_purchases').update({ status: 'expired' }).eq('payment_ref', reference);
  }

  if (orderId) {
    await supabase.from('orders').update({ status: 'cancelled', updated_at: nowIso }).eq('id', orderId);
  } else if (reference) {
    await supabase.from('orders').update({ status: 'cancelled', updated_at: nowIso }).eq('payment_ref', reference);
  }

  if (reference) {
    await supabase.from('payments').update({ status: 'expired' }).eq('transaction_ref', reference);
  }
}

// ─── KKIAPAY WEBHOOK VERIFICATION ──────────────────────────────────────────
function verifyKkiapayWebhook(rawBody: Buffer, kkiapaySecretHeader: string): boolean {
  const kkiapaySecret = process.env.KKIAPAY_SECRET_KEY || '';
  if (!kkiapaySecret || !kkiapaySecretHeader) return false;

  const expectedHash = createHash('sha256')
    .update(kkiapaySecret)
    .digest('hex');

  try {
    const receivedHash = String(kkiapaySecretHeader).trim().toLowerCase();
    if (!receivedHash || receivedHash.length !== expectedHash.length) return false;
    return timingSafeEqual(Buffer.from(receivedHash), Buffer.from(expectedHash));
  } catch {
    return false;
  }
}

function isKkiapayWebhook(req: VercelRequest): boolean {
  return !!req.headers['x-kkiapay-secret'];
}

// ─── KKIAPAY-SPECIFIC HANDLERS ────────────────────────────────────────────
async function handleKkiapaySuccess(supabase: ReturnType<typeof getSupabaseAdmin>, payload: Record<string, unknown>) {
  const transactionId = String(payload.transactionId || '');
  const amount = Number(payload.amount || 0);
  const fees = Number(payload.fees || 0);
  const method = String(payload.method || 'MOBILE_MONEY');
  const partnerId = String(payload.partnerId || '');

  if (!transactionId) {
    throw new Error('handleKkiapaySuccess: missing transactionId in payload');
  }

  const reference = transactionId;

  let orderId: string | null = null;
  let ticketPurchaseId: string | null = null;
  let ticketOrderId: string | null = null;
  let restaurantId: string | null = null;

  if (partnerId) {
    const { data: orderRow } = await supabase
      .from('orders')
      .select('id, restaurant_id')
      .eq('id', partnerId)
      .maybeSingle();
    if (orderRow) {
      orderId = orderRow.id;
      restaurantId = orderRow.restaurant_id;
    } else {
      const { data: ticketRow } = await supabase
        .from('ticket_purchases')
        .select('id')
        .eq('id', partnerId)
        .maybeSingle();
      if (ticketRow) ticketPurchaseId = ticketRow.id;
    }
  }

  if (!orderId && reference) {
    const { data: orderRow } = await supabase
      .from('orders')
      .select('id, restaurant_id')
      .eq('payment_ref', reference)
      .neq('status', 'confirmed')
      .maybeSingle();
    if (orderRow) {
      orderId = orderRow.id;
      if (!restaurantId) restaurantId = orderRow.restaurant_id;
    }
  }

  if (!ticketPurchaseId && reference) {
    const { data: ticketRow } = await supabase
      .from('ticket_purchases')
      .select('id')
      .eq('payment_ref', reference)
      .eq('status', 'pending')
      .maybeSingle();
    if (ticketRow) ticketPurchaseId = ticketRow.id;
  }

  if (!restaurantId && orderId) {
    const { data: order } = await supabase
      .from('orders')
      .select('restaurant_id')
      .eq('id', orderId)
      .maybeSingle();
    if (order?.restaurant_id) restaurantId = order.restaurant_id;
  }

  const { error: rpcError } = await supabase.rpc('confirm_payment', {
    p_reference: reference,
    p_amount: amount,
    p_currency: 'XOF',
    p_provider_response: payload,
    p_order_id: orderId,
    p_ticket_purchase_id: ticketPurchaseId,
    p_ticket_order_id: ticketOrderId,
    p_restaurant_id: restaurantId,
  });

  if (rpcError) {
    console.warn('[Webhook/Kkiapay] confirm_payment RPC failed, using direct update:', rpcError.message);

    const paidAt = new Date().toISOString();
    if (orderId) {
      await supabase.from('orders')
        .update({ status: 'confirmed', paid_at: paidAt, updated_at: paidAt } as Record<string, unknown>)
        .eq('id', orderId)
        .neq('status', 'confirmed');
    }
    if (ticketPurchaseId) {
      await supabase.from('ticket_purchases')
        .update({ status: 'confirmed', updated_at: paidAt })
        .eq('id', ticketPurchaseId)
        .eq('status', 'pending');
    }
    await supabase.from('payments').upsert(
      {
        transaction_ref: reference,
        amount,
        currency: 'XOF',
        status: 'confirmed',
        provider: 'kkiapay',
        provider_response: payload,
        order_id: orderId,
        ticket_purchase_id: ticketPurchaseId,
        restaurant_id: restaurantId,
        confirmed_at: paidAt,
      },
      { onConflict: 'transaction_ref' },
    );
  }

  if (restaurantId && amount > 0) {
    try {
      await creditRestaurantBalance(supabase, restaurantId, amount, reference, 'XOF');
    } catch (err) {
      console.error('[Webhook/Kkiapay] creditRestaurantBalance failed (non-blocking):', err);
    }
  }

  if (ticketPurchaseId) {
    try { await sendTicketPurchaseEmailFromWebhook(supabase, ticketPurchaseId); }
    catch (err) { console.error('[Webhook/Kkiapay] sendTicketPurchaseEmailFromWebhook failed:', err); }
  }

  console.log('[Webhook/Kkiapay] Payment confirmed:', { transactionId, amount, orderId, ticketPurchaseId });
}

async function handleKkiapayFailed(supabase: ReturnType<typeof getSupabaseAdmin>, payload: Record<string, unknown>) {
  const transactionId = String(payload.transactionId || '');
  const partnerId = String(payload.partnerId || '');
  const nowIso = new Date().toISOString();

  if (partnerId) {
    await supabase.from('orders')
      .update({ status: 'cancelled', updated_at: nowIso })
      .eq('id', partnerId)
      .neq('status', 'confirmed');
  }

  if (transactionId) {
    await supabase.from('payments')
      .update({ status: 'failed', updated_at: nowIso })
      .eq('transaction_ref', transactionId);
  }

  console.log('[Webhook/Kkiapay] Payment failed:', { transactionId });
}

// ─── MAIN HANDLER ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Signature, x-kkiapay-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let rawBody: Buffer;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    if (err instanceof WebhookBodyTooLarge) {
      console.warn('[Webhook] Payload too large:', err.received, 'bytes');
      return res.status(413).json({ error: 'Payload too large' });
    }
    return res.status(400).json({ error: 'Failed to read body' });
  }

  const supabase = getSupabaseAdmin();

  // ── KKIAPAY WEBHOOK PATH ──
  if (isKkiapayWebhook(req)) {
    const kkiapaySecret = req.headers['x-kkiapay-secret'] as string;

    if (!verifyKkiapayWebhook(rawBody, kkiapaySecret)) {
      console.warn('[Webhook/Kkiapay] Invalid x-kkiapay-secret');
      return res.status(401).json({ error: 'Invalid Kkiapay signature' });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const eventType = String(payload.event || 'unknown');
    const transactionId = String(payload.transactionId || '');

    console.log('[Webhook/Kkiapay] Event:', eventType, 'TransactionId:', transactionId);
    await logWebhook(supabase, 'kkiapay', eventType, payload, true, 'received');

    const webhookEventId = transactionId || createHash('sha256').update(rawBody).digest('hex');
    const dedup = await checkAndRecordWebhookEvent(supabase, {
      id: `kkiapay_${webhookEventId}`,
      eventType,
      reference: transactionId,
    });
    if (dedup.alreadyProcessed) {
      console.log('[Webhook/Kkiapay] duplicate, short-circuit:', webhookEventId);
      return res.status(200).json({ received: true, event: eventType, deduped: true });
    }

    try {
      switch (eventType) {
        case 'transaction.success': {
          await handleKkiapaySuccess(supabase, payload);
          await logWebhook(supabase, 'kkiapay', eventType, payload, true, 'processed');
          await markWebhookEventProcessed(supabase, `kkiapay_${webhookEventId}`);
          return res.status(200).json({ received: true, event: eventType });
        }
        case 'transaction.failed': {
          await handleKkiapayFailed(supabase, payload);
          await logWebhook(supabase, 'kkiapay', eventType, payload, true, 'failed');
          await markWebhookEventProcessed(supabase, `kkiapay_${webhookEventId}`);
          return res.status(200).json({ received: true, event: eventType });
        }
        default: {
          await logWebhook(supabase, 'kkiapay', eventType, payload, true, 'unknown');
          await markWebhookEventProcessed(supabase, `kkiapay_${webhookEventId}`);
          return res.status(200).json({ received: true, event: eventType, note: 'Unknown event type' });
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Webhook/Kkiapay] Error:', errMsg);
      await logWebhook(supabase, 'kkiapay', 'error', { error: errMsg }, false, 'error');
      await markWebhookEventProcessed(supabase, `kkiapay_${webhookEventId}`, 'error');
      return res.status(500).json({ error: errMsg || 'Internal error' });
    }
  }

  // ── LEGACY GENIUSPAY WEBHOOK PATH ──
  // Conservé pour absorber les rejeux d'anciens webhooks GP encore en flight.
  // En mode Kkiapay-only (GENIUSPAY_WEBHOOK_SECRET absent), on renvoie 410
  // Gone — l'upstream GP cessera de retry.
  const webhookType = req.query?.type as string;
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;
  const eventHeader = req.headers['x-webhook-event'] as string;

  if (!WEBHOOK_SECRET) {
    console.warn('[Webhook] GeniusPay legacy path hit but GENIUSPAY_WEBHOOK_SECRET absent — returning 410 Gone');
    return res.status(410).json({
      error: 'GeniusPay webhook path deprecated',
      message: 'Restafy a migré à 100% sur Kkiapay. Les webhooks GeniusPay ne sont plus traités. Utiliser POST /api/webhooks avec le header x-kkiapay-secret.',
    });
  }

  if (!verifySignature(rawBody, signature, timestamp)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const eventType = String(payload.event || eventHeader || 'unknown');

  console.log('[Webhook] Event:', eventType, 'Type:', webhookType);
  await logWebhook(supabase, webhookType || 'geniuspay', eventType, payload, true, 'received');

  const webhookIdHeader =
    (req.headers['x-webhook-id'] as string) ||
    (req.headers['x-webhook-event-id'] as string) ||
    '';
  const webhookEventId = (webhookIdHeader.trim() || createHash('sha256').update(rawBody).digest('hex'));
  const referenceHint = (payload?.data as Record<string, unknown>)?.reference as string || payload?.reference as string || null;

  const dedup = await checkAndRecordWebhookEvent(supabase, {
    id: webhookEventId,
    eventType,
    reference: referenceHint,
  });
  if (dedup.alreadyProcessed) {
    console.log('[Webhook] duplicate, short-circuit:', webhookEventId);
    return res.status(200).json({ received: true, event: eventType, deduped: true });
  }

  try {
    // PAYOUT WEBHOOKS
    if (webhookType === 'payout') {
      switch (eventType) {
        case 'payout.completed': {
          const result = await handlePayoutCompleted(supabase, (payload as Record<string, unknown>).data);
          await logWebhook(supabase, 'geniuspay_payout', eventType, payload, !result.error, result.error || 'completed');
          await markWebhookEventProcessed(supabase, webhookEventId);
          return res.status(200).json({ received: true, event: eventType, result });
        }
        case 'payout.failed': {
          const failResult = await handlePayoutFailed(supabase, (payload as Record<string, unknown>).data);
          await logWebhook(supabase, 'geniuspay_payout', eventType, payload, !failResult.error, failResult.error || 'failed');
          await markWebhookEventProcessed(supabase, webhookEventId);
          return res.status(200).json({ received: true, event: eventType, result: failResult });
        }
        default: {
          await logWebhook(supabase, 'geniuspay_payout', eventType, payload, true, 'unknown');
          await markWebhookEventProcessed(supabase, webhookEventId);
          return res.status(200).json({ received: true, event: eventType, note: 'Unknown event type' });
        }
      }
    }

    // PAYMENT WEBHOOKS (default)
    switch (eventType) {
      case 'payment.success': {
        await handlePaymentSuccess(supabase, (payload as Record<string, unknown>).data, payload);
        await logWebhook(supabase, 'geniuspay', eventType, payload, true, 'processed');
        await markWebhookEventProcessed(supabase, webhookEventId);
        return res.status(200).json({ received: true, event: eventType });
      }

      case 'payment.failed': {
        await handlePaymentFailed(supabase, (payload as Record<string, unknown>)?.data, payload);
        await logWebhook(supabase, 'geniuspay', eventType, payload, true, 'failed');
        await markWebhookEventProcessed(supabase, webhookEventId);
        return res.status(200).json({ received: true, event: eventType });
      }

      case 'payment.expired':
      case 'payment.cancelled': {
        await handlePaymentExpired(supabase, (payload as Record<string, unknown>)?.data, payload);
        await logWebhook(supabase, 'geniuspay', eventType, payload, true, 'cancelled');
        await markWebhookEventProcessed(supabase, webhookEventId);
        return res.status(200).json({ received: true, event: eventType });
      }

      default: {
        await logWebhook(supabase, 'geniuspay', eventType, payload, true, 'unknown');
        await markWebhookEventProcessed(supabase, webhookEventId);
        return res.status(200).json({ received: true, event: eventType, note: 'Unknown event type' });
      }
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Webhook] Error:', errMsg);
    await logWebhook(supabase, webhookType || 'geniuspay', 'error', { error: errMsg }, false, 'error');
    await markWebhookEventProcessed(supabase, webhookEventId, 'error');
    return res.status(500).json({ error: errMsg || 'Internal error' });
  }
}
