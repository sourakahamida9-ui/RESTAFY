/**
 * GeniusPay Merchant API proxy (consolidé)
 *
 * Documentation officielle: https://pay.genius.ci/docs
 * Authentication: X-API-Key + X-API-Secret headers
 *
 * Routes (via rewrites dans vercel.json pour rester sous la limite Hobby
 * de 12 Serverless Functions) :
 *   POST /api/payments/initiate                                 → POST /payments
 *   GET  /api/account/balance      (→ ?action=balance)          → GET  /account/balance
 *   GET  /api/pawapay/providers    (→ ?action=pawapay_providers) → GET  /pawapay/providers
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit';
import { withRetry } from '../_shared/withRetry';
import { applyCors } from '../_shared/cors';
import { handler as verifyKkiapayHandler } from './_verifyKkiapay';

// Constants
const GENIUSPAY_BASE_URL = process.env.GENIUSPAY_BASE_URL || 'https://pay.genius.ci/api/v1/merchant';
const APP_URL = process.env.APP_URL || 'https://app.restafy.shop';


async function requireAuthenticatedUser(req: VercelRequest): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }
  const accessToken = authHeader.slice(7);
  try {
    const supabase = getSupabaseAdmin();
    // @supabase/supabase-js v2: use `auth.getUser(token)` (the v1 `auth.api`
    // namespace no longer exists and calling it raised a TypeError on every
    // payment initiation).
    const { data, error } = await (supabase.auth as any).getUser(accessToken);
    if (error || !data?.user?.id) {
      return { error: 'Invalid token', status: 401 };
    }
    return { userId: data.user.id };
  } catch (err) {
    console.error('[GeniusPay] Auth check failed:', err);
    return { error: 'Authentication check failed', status: 500 };
  }
}

function getGeniusPayKeys(): { publicKey: string; secretKey: string } | null {
  // Prefer paired keys (aligned with payouts)
  const publicKey = process.env.GENIUSPAY_PUBLIC_KEY || process.env.GENIUSPAY_API_KEY || '';
  const secretKey = process.env.GENIUSPAY_SECRET_KEY || '';

  if (!publicKey || !secretKey) return null;
  return { publicKey, secretKey };
}

function buildGeniusPayHeaders(keys: { publicKey: string; secretKey: string }, extra: Record<string, string> = {}) {
  return {
    'X-API-Key': keys.publicKey,
    'X-API-Secret': keys.secretKey,
    'Accept': 'application/json',
    'User-Agent': 'Restafy/1.0',
    ...extra,
  };
}

// Maps a raw GeniusPay payment status to the 4-state vocabulary used by the
// frontend polling UI (src/pages/PaymentSuccess.tsx). Keeping the set small
// avoids the UI ever getting stuck on unknown strings.
function mapGeniusPayStatus(raw: string): 'completed' | 'pending' | 'failed' | 'cancelled' {
  const s = String(raw || '').toLowerCase();
  if (s === 'completed' || s === 'success' || s === 'successful' || s === 'paid' || s === 'confirmed') {
    return 'completed';
  }
  if (s === 'failed' || s === 'error' || s === 'declined' || s === 'rejected') {
    return 'failed';
  }
  if (s === 'cancelled' || s === 'canceled' || s === 'expired' || s === 'timeout' || s === 'refunded') {
    return 'cancelled';
  }
  // 'pending', 'processing', 'accepted', 'initiated', 'submitted' → still pending
  return 'pending';
}

// ═══════════════════════════════════════════════════════════════
// Email de confirmation billet (QR code)
// ═══════════════════════════════════════════════════════════════

function getResendKey(): string | undefined {
  return process.env.RESEND_API_KEY || process.env.RESEND_KEY;
}

// Sends the QR-code ticket email for the new `ticket_orders` flow
// (api/ticket-orders/create.ts). The legacy `ticket_purchases` flow uses
// `sendTicketConfirmationEmail` below. Both are invoked after the
// `confirm_payment` RPC has flipped the row to confirmed/paid.
async function sendTicketOrderConfirmationEmail(
  supabase: any,
  ticketOrderId: string,
): Promise<void> {
  const RESEND_API_KEY = getResendKey();
  if (!RESEND_API_KEY) {
    console.warn('[payments] RESEND_API_KEY not set - skipping ticket_order email');
    return;
  }

  try {
    const { data: order } = await supabase
      .from('ticket_orders')
      .select(`
        id,
        quantity,
        unit_price,
        total_amount,
        customer_name,
        customer_email,
        payment_reference,
        events:event_id ( title, start_time, location ),
        event_tickets:ticket_type_id ( name, price )
      `)
      .eq('id', ticketOrderId)
      .single();

    if (!order || !order.customer_email) {
      console.warn('[payments] ticket_order or email not found:', ticketOrderId);
      return;
    }

    const eventTitle = order.events?.title || 'Événement';
    const ticketTypeName = order.event_tickets?.name || 'Billet';
    const eventDate = order.events?.start_time
      ? new Date(order.events.start_time).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';
    const refLabel = order.payment_reference || `#${String(order.id).slice(0, 8).toUpperCase()}`;
    const qrValue = order.payment_reference || order.id;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Vos billets - ${eventTitle}</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
  <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #FF6B00, #e85d04); padding: 30px 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">🎫 Billets confirmés !</h1>
    </div>
    <div style="padding: 30px;">
      <p style="font-size: 18px; color: #333;">Bonjour <strong>${order.customer_name}</strong>,</p>
      <p style="color: #666;">Votre paiement de <strong>${Number(order.total_amount).toLocaleString()} FCFA</strong> a été confirmé. Voici le récapitulatif :</p>

      <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="font-size: 11px; color: #999; text-transform: uppercase; margin: 0 0 10px;">Événement</p>
        <p style="font-size: 20px; font-weight: bold; color: #333; margin: 0 0 15px;">${eventTitle}</p>
        <p style="font-size: 14px; color: #666; margin: 0;">${ticketTypeName} × ${order.quantity}</p>
        ${eventDate ? `<p style="font-size: 14px; color: #666; margin: 8px 0 0;">${eventDate}</p>` : ''}
        ${order.events?.location ? `<p style="font-size: 14px; color: #666; margin: 4px 0 0;">📍 ${order.events.location}</p>` : ''}
      </div>

      <div style="background: white; border: 2px dashed #ddd; border-radius: 12px; padding: 30px; margin: 20px 0; text-align: center;">
        <p style="font-size: 11px; color: #999; text-transform: uppercase; margin: 0 0 10px;">Référence</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}"
             alt="QR Code" style="width: 200px; height: 200px; border: none;" />
        <p style="font-size: 14px; font-family: monospace; color: #333; margin: 15px 0 0;">${refLabel}</p>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center;">
        📷 Présentez cette référence à l'entrée de l'événement.<br>
        Vous pouvez aussi consulter vos billets dans l'application <strong>Restafy</strong>.
      </p>
    </div>
    <div style="background: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px; margin: 0;">
        Restafy - <a href="https://restafy.shop" style="color: #FF6B00;">restafy.shop</a>
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Restafy <noreply@app.restafy.shop>',
        to: [order.customer_email],
        subject: `🎫 Vos billets - ${eventTitle}`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[payments] Failed to send ticket_order email:', err);
    } else {
      console.log('[payments] ticket_order email sent:', ticketOrderId);
    }
  } catch (err) {
    console.error('[payments] Error sending ticket_order email:', err);
  }
}

async function sendTicketConfirmationEmail(supabase: any, ticketId: string): Promise<void> {
  const RESEND_API_KEY = getResendKey();
  if (!RESEND_API_KEY) {
    console.warn('[payments] RESEND_API_KEY not set - skipping ticket email');
    return;
  }

  try {
    // Récupérer les détails du billet
    const { data: ticket } = await supabase
      .from('ticket_purchases')
      .select(`
        id,
        qr_code_data,
        ticket_number,
        status,
        customer_name,
        customer_email,
        events:event_id ( title, start_time, location ),
        event_tickets:ticket_id ( name, price )
      `)
      .eq('id', ticketId)
      .single();

    if (!ticket || !ticket.customer_email) {
      console.warn('[payments] Ticket or email not found:', ticketId);
      return;
    }

    const qrValue = ticket.qr_code_data || ticket.ticket_number || ticket.id;
    const ticketNumber = ticket.ticket_number || `#${ticket.id.slice(0, 8).toUpperCase()}`;
    const eventTitle = ticket.events?.title || 'Événement';
    const ticketType = ticket.event_tickets?.name || 'Billet';
    const ticketPrice = ticket.event_tickets?.price || 0;
    const eventDate = ticket.events?.start_time
      ? new Date(ticket.events.start_time).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Votre billet - ${eventTitle}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
  <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #FF6B00, #e85d04); padding: 30px 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">🎫 Billet confirmé !</h1>
    </div>
    <div style="padding: 30px;">
      <p style="font-size: 18px; color: #333;">Bonjour <strong>${ticket.customer_name}</strong>,</p>
      <p style="color: #666;">Votre paiement a été confirmé. Voici votre billet :</p>

      <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="font-size: 11px; color: #999; text-transform: uppercase; margin: 0 0 10px;">Événement</p>
        <p style="font-size: 20px; font-weight: bold; color: #333; margin: 0 0 15px;">${eventTitle}</p>
        <p style="font-size: 14px; color: #666; margin: 0;">${ticketType}</p>
        ${eventDate ? `<p style="font-size: 14px; color: #666; margin: 8px 0 0;">${eventDate}</p>` : ''}
        ${ticket.events?.location ? `<p style="font-size: 14px; color: #666; margin: 4px 0 0;">📍 ${ticket.events.location}</p>` : ''}
      </div>

      <div style="background: white; border: 2px dashed #ddd; border-radius: 12px; padding: 30px; margin: 20px 0; text-align: center;">
        <p style="font-size: 11px; color: #999; text-transform: uppercase; margin: 0 0 10px;">Code QR</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}"
             alt="QR Code" style="width: 200px; height: 200px; border: none;"
             onerror="this.style.display='none'" />
        <p style="font-size: 14px; font-family: monospace; color: #333; margin: 15px 0 0;">${ticketNumber}</p>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center;">
        📷 Présentez ce code QR à l'entrée de l'événement.<br>
        Vous pouvez aussi télécharger le code depuis l'application <strong>Restafy</strong>.
      </p>
    </div>
    <div style="background: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px; margin: 0;">
        Restafy - <a href="https://restafy.shop" style="color: #FF6B00;">restafy.shop</a>
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Restafy <noreply@app.restafy.shop>',
        to: [ticket.customer_email],
        subject: `🎫 Votre billet - ${eventTitle}`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[payments] Failed to send ticket email:', err);
    } else {
      console.log('[payments] Ticket email sent:', ticketId);
    }
  } catch (err) {
    console.error('[payments] Error sending ticket email:', err);
  }
}

// ─── Credit restaurant balance after payment ──────────────────────────────
// Mirrors the same logic in api/webhooks/index.ts. Duplicated because each
// Vercel serverless function must be self-contained (no cross-directory imports).
// Idempotent via reference check on restaurant_transactions.
async function creditRestaurantBalanceFromInitiate(
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
    console.log('[Status] Balance already credited for reference:', reference);
    return;
  }

  // Calculate net amount (same formula as DB trigger: 1% + 100 + 150)
  const fees = (grossAmount * 0.01) + 100 + 150;
  const netAmount = grossAmount - fees;
  if (netAmount <= 0) return;

  // Try the atomic RPC first (same as webhook path)
  const { error: rpcErr } = await supabase.rpc('credit_restaurant_balance_safe', {
    p_restaurant_id: restaurantId,
    p_net_amount: netAmount,
    p_gross_amount: grossAmount,
    p_fees: fees,
    p_reference: reference,
    p_currency: currency,
  });

  if (!rpcErr) {
    console.log(`[Status] Restaurant ${restaurantId} credited via RPC: +${netAmount} ${currency}`);
    return;
  }

  // Fallback: direct update when RPC is not available
  console.warn('[Status] credit_restaurant_balance_safe RPC not available, using direct update:', rpcErr.message);

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
      description: `Paiement reçu (polling) — brut: ${grossAmount}, frais: ${Math.round(fees)}`,
      metadata: { gross_amount: grossAmount, fees, source: 'polling_credit' },
    });

    console.log(`[Status] Restaurant ${restaurantId} credited: +${netAmount} ${currency} (gross: ${grossAmount}, fees: ${Math.round(fees)})`);
  }
}

// Confirms ticket_purchases / orders / ticket_orders / payments rows inline
// when the client polls after a successful sandbox or live payment. Appelle
// la RPC Postgres `confirm_payment` (migration 094) pour que les 4 UPDATE
// se fassent en une seule transaction atomique — identique au chemin webhook.
// Avant ce fix: 5 UPDATE séquentiels non-atomiques, avec try/catch qui
// avalaient les erreurs silencieusement (voir audit §2.4).
async function confirmPaymentInDatabase(
  reference: string,
  paymentData: any,
  options: { skipPaymentsUpsert?: boolean } = {},
) {
  if (!reference) return { ticket_id: null as string | null, order_id: null as string | null };

  const supabase = getSupabaseAdmin();
  const metadata = paymentData?.metadata || {};
  const ticketOrderId = metadata.ticket_order_id || null;
  let ticketPurchaseId = metadata.ticket_purchase_id || null;
  let metaOrderId = metadata.order_id || null;
  let restaurantId = metadata.restaurant_id || null;

  // Fallback: resolve ticket_purchase_id by payment_ref when metadata is missing
  if (!ticketPurchaseId && reference) {
    const { data: ticketRow } = await supabase
      .from('ticket_purchases')
      .select('id')
      .eq('payment_ref', reference)
      .eq('status', 'pending')
      .maybeSingle();
    if (ticketRow) {
      ticketPurchaseId = ticketRow.id;
      console.log('[Status] Resolved ticket_purchase_id via payment_ref fallback:', ticketPurchaseId);
    }
  }

  // Fallback: resolve order_id by payment_ref when metadata is missing
  if (!metaOrderId && reference) {
    const { data: orderRow } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_ref', reference)
      .neq('status', 'confirmed')
      .maybeSingle();
    if (orderRow) {
      metaOrderId = orderRow.id;
      console.log('[Status] Resolved order_id via payment_ref fallback:', metaOrderId);
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
      const eventsArr = tp?.events as unknown as { restaurant_id: string }[] | { restaurant_id: string } | null;
      const evtRow = Array.isArray(eventsArr) ? eventsArr[0] : eventsArr;
      if (evtRow?.restaurant_id) {
        restaurantId = evtRow.restaurant_id;
        console.log('[Status] Resolved restaurant_id from ticket_purchase→event:', restaurantId);
      }
    } catch (err) {
      console.warn('[Status] Could not resolve restaurant_id from ticket_purchase:', err);
    }
  }

  // Fallback: resolve restaurant_id from order
  if (!restaurantId && metaOrderId) {
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('restaurant_id')
        .eq('id', metaOrderId)
        .maybeSingle();
      if (order?.restaurant_id) {
        restaurantId = order.restaurant_id;
        console.log('[Status] Resolved restaurant_id from order:', restaurantId);
      }
    } catch (err) {
      console.warn('[Status] Could not resolve restaurant_id from order:', err);
    }
  }

  const rpcArgs: Record<string, unknown> = {
    p_reference: reference,
    p_amount: Number(paymentData?.amount ?? 0),
    p_currency: String(paymentData?.currency ?? 'XOF'),
    p_provider_response: paymentData ?? {},
    p_order_id: metaOrderId,
    p_ticket_purchase_id: ticketPurchaseId,
    p_ticket_order_id: ticketOrderId,
    p_restaurant_id: restaurantId,
  };
  if (options.skipPaymentsUpsert === true) {
    rpcArgs.p_skip_payments_upsert = true;
  }

  let { data: rpcData, error: rpcError } = await supabase.rpc('confirm_payment', rpcArgs);

  // Fallback gracieux si la migration 095 n'est pas encore appliquée
  // (signature sans p_skip_payments_upsert). On retente sans le flag plutôt
  // que de bloquer la confirmation. L'effet: on peut écraser provider_response
  // avec un payload synthétique jusqu'à ce que la migration tourne en prod.
  if (rpcError && options.skipPaymentsUpsert === true) {
    const msg = String(rpcError?.message || '').toLowerCase();
    if (msg.includes('p_skip_payments_upsert') || msg.includes('does not exist') || msg.includes('function')) {
      console.warn('[Status] confirm_payment signature mismatch (migration 095 not applied?) — retry without skip flag');
      delete rpcArgs.p_skip_payments_upsert;
      const retry = await supabase.rpc('confirm_payment', rpcArgs);
      rpcData = retry.data;
      rpcError = retry.error;
    }
  }

  if (rpcError) {
    console.error('[Status] confirm_payment RPC failed, using direct update fallback:', rpcError);

    // Fallback: direct SQL updates when the RPC is missing or fails
    // (e.g. migration 094 not applied, or payment_ref column missing).
    const paidAt = new Date().toISOString();
    let fallbackTicketId: string | null = null;
    let fallbackOrderId: string | null = null;

    // Confirm ticket_purchases
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
          // Try setting optional columns (may not exist)
          try {
            await supabase.from('ticket_purchases')
              .update({ confirmed_at: paidAt, confirmation_sent: false } as any)
              .eq('id', fallbackTicketId);
          } catch { /* optional columns may not exist */ }
          // Send notification
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
        console.error('[Status] Fallback ticket_purchases update failed:', err);
      }
    }

    // Confirm orders
    if (metaOrderId) {
      try {
        const { data: updated } = await supabase
          .from('orders')
          .update({ status: 'confirmed', paid_at: paidAt, updated_at: paidAt } as any)
          .eq('id', metaOrderId)
          .neq('status', 'confirmed')
          .select('id');
        if (updated?.[0]) fallbackOrderId = updated[0].id;
      } catch (err) {
        console.error('[Status] Fallback orders update failed:', err);
      }
    }

    // Confirm ticket_orders
    let fallbackTicketOrderConfirmed = false;
    if (ticketOrderId) {
      try {
        const { error: toErr } = await supabase.from('ticket_orders')
          .update({ status: 'paid', paid_at: paidAt, updated_at: paidAt })
          .eq('id', ticketOrderId);
        if (toErr) {
          console.error('[Status] Fallback ticket_orders update error:', toErr);
        } else {
          fallbackTicketOrderConfirmed = true;
        }
      } catch (err) {
        console.error('[Status] Fallback ticket_orders update failed:', err);
      }
    }

    // Credit restaurant balance in fallback path
    const anyConfirmed = fallbackTicketId || fallbackOrderId || fallbackTicketOrderConfirmed;
    if (restaurantId && anyConfirmed) {
      try {
        await creditRestaurantBalanceFromInitiate(
          supabase, restaurantId,
          Number(paymentData?.amount ?? 0),
          reference,
          String(paymentData?.currency ?? 'XOF'),
        );
      } catch (err) {
        console.error('[Status] Fallback creditRestaurantBalance failed (non-blocking):', err);
      }
    }

    // Send confirmation emails from fallback
    if (fallbackTicketId) {
      try { await sendTicketConfirmationEmail(supabase, fallbackTicketId); }
      catch (err) { console.error('[Status] Fallback sendTicketConfirmationEmail failed:', err); }
    }
    if (fallbackTicketOrderConfirmed && ticketOrderId) {
      try { await sendTicketOrderConfirmationEmail(supabase, ticketOrderId); }
      catch (err) { console.error('[Status] Fallback sendTicketOrderConfirmationEmail failed:', err); }
    }

    return { ticket_id: fallbackTicketId, order_id: fallbackOrderId };
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const confirmedTicketId = row?.confirmed_ticket_purchase_id ?? null;
  const confirmedTicketOrderId = row?.confirmed_ticket_order_id ?? null;

  // Credit restaurant balance (the DB trigger may not fire for UPSERTs that do INSERT)
  if (restaurantId) {
    try {
      await creditRestaurantBalanceFromInitiate(
        supabase, restaurantId,
        Number(paymentData?.amount ?? 0),
        reference,
        String(paymentData?.currency ?? 'XOF'),
      );
    } catch (err) {
      console.error('[Status] creditRestaurantBalance failed (non-blocking):', err);
    }
  }

  // Fire-and-forget confirmation emails. Wrapped in try/catch so a failed
  // email never breaks the payment-confirmation flow (the row is already
  // committed by the RPC). Both handlers no-op when RESEND_API_KEY is
  // missing or when customer_email is null.
  if (confirmedTicketId) {
    try { await sendTicketConfirmationEmail(supabase, confirmedTicketId); }
    catch (err) { console.error('[Status] sendTicketConfirmationEmail failed:', err); }
  }
  if (confirmedTicketOrderId) {
    try { await sendTicketOrderConfirmationEmail(supabase, confirmedTicketOrderId); }
    catch (err) { console.error('[Status] sendTicketOrderConfirmationEmail failed:', err); }
  }

  return {
    ticket_id: confirmedTicketId,
    order_id: row?.confirmed_order_id ?? null,
  };
}

// Looks up our own DB for a reference. Used as a fallback when GeniusPay's
// own lookup endpoint fails (sandbox returns 404 on GET /payments/{ref}) or
// when we want to short-circuit polling because the webhook has already
// persisted a confirmed payment.
async function lookupLocalStatus(
  reference: string,
  userId: string | null,
  hints: { purchaseId?: string | null; orderId?: string | null } = {},
): Promise<{
  status: 'completed' | 'pending' | 'failed' | 'cancelled' | 'unknown';
  source: 'payments' | 'ticket_purchases' | 'orders' | 'ticket_orders' | null;
  payment?: any;
  matchedById?: boolean;
  debug?: Record<string, unknown>;
}> {
  const supabase = getSupabaseAdmin();
  const debug: Record<string, unknown> = {
    reference,
    userId,
    hints,
    payment_row: null,
    payment_status: null,
    ticket_row: null,
    ticket_status: null,
    order_row: null,
    order_status: null,
    order_customer_id: null,
    order_by_id_owner_mismatch: false,
  };

  // 1) payments table (authoritative — webhook writes here on payment.success).
  const { data: paymentRow } = await supabase
    .from('payments')
    .select('*')
    .eq('transaction_ref', reference)
    .maybeSingle();

  if (paymentRow) {
    debug.payment_row = paymentRow.id ?? true;
    debug.payment_status = paymentRow.status;
    const s = String(paymentRow.status || '').toLowerCase();
    if (s === 'confirmed' || s === 'completed' || s === 'paid' || s === 'success') {
      return { status: 'completed', source: 'payments', payment: paymentRow, debug };
    }
    if (s === 'failed' || s === 'error' || s === 'declined') {
      return { status: 'failed', source: 'payments', payment: paymentRow, debug };
    }
    if (s === 'cancelled' || s === 'canceled' || s === 'expired') {
      return { status: 'cancelled', source: 'payments', payment: paymentRow, debug };
    }
  }

  // 2) ticket_purchases / orders — match by `payment_ref` first, but ALSO
  //    accept a client-supplied id hint so we stay robust even when the
  //    initiate-time payment_ref link didn't land (transient DB error, PostgREST
  //    schema refresh, race with the client redirect). The id hint is gated on
  //    customer_id ownership so a user can never confirm a row they don't own.
  // IMPORTANT: keep SELECT minimal. Selecting `payment_ref` here used to
  // silently fail when PostgREST schema cache lagged behind migration 088
  // (column added but schema cache not reloaded), returning {data:null,
  // error:<schema cache>} which the caller dropped. That made this whole
  // owner-gated lookup return no row even when the row DID exist and was
  // owned by the user — keeping the sandbox auto-confirm fallback from
  // ever firing. We only need id/status/customer_id for the flow logic.
  let ticketQuery = supabase
    .from('ticket_purchases')
    .select('id, status, customer_id, event_id')
    .limit(1);
  ticketQuery = hints.purchaseId
    ? ticketQuery.eq('id', hints.purchaseId)
    : ticketQuery.eq('payment_ref', reference);
  if (userId) ticketQuery = ticketQuery.eq('customer_id', userId);
  const { data: ticketRows, error: ticketErr } = await ticketQuery;
  if (ticketErr) {
    (debug as any).ticket_query_error = ticketErr.message || String(ticketErr);
    console.error('[lookupLocalStatus] ticket_purchases query failed:', ticketErr);
  }
  const ticket = ticketRows?.[0];
  if (ticket) {
    debug.ticket_row = ticket.id;
    debug.ticket_status = ticket.status;
    const matchedById = Boolean(hints.purchaseId);
    const s = String(ticket.status || '').toLowerCase();
    if (s === 'confirmed') return { status: 'completed', source: 'ticket_purchases', matchedById, debug };
    if (s === 'cancelled' || s === 'canceled') return { status: 'cancelled', source: 'ticket_purchases', matchedById, debug };
    return { status: 'pending', source: 'ticket_purchases', matchedById, debug };
  }

  let orderQuery = supabase
    .from('orders')
    .select('id, status, customer_id, restaurant_id')
    .limit(1);
  orderQuery = hints.orderId
    ? orderQuery.eq('id', hints.orderId)
    : orderQuery.eq('payment_ref', reference);
  if (userId) orderQuery = orderQuery.eq('customer_id', userId);
  const { data: orderRows, error: orderErr } = await orderQuery;
  if (orderErr) {
    (debug as any).order_query_error = orderErr.message || String(orderErr);
    console.error('[lookupLocalStatus] orders query failed:', orderErr);
  }
  const order = orderRows?.[0];
  if (order) {
    debug.order_row = order.id;
    debug.order_status = order.status;
    debug.order_customer_id = order.customer_id;
    const matchedById = Boolean(hints.orderId);
    const s = String(order.status || '').toLowerCase();
    if (s === 'confirmed' || s === 'paid') return { status: 'completed', source: 'orders', matchedById, debug };
    if (s === 'cancelled' || s === 'canceled') return { status: 'cancelled', source: 'orders', matchedById, debug };
    return { status: 'pending', source: 'orders', matchedById, debug };
  }

  // 3) Safety net: if id hints were provided but the owner-gated query
  //    didn't match (transient Supabase error, schema cache issue, etc.),
  //    look up by id alone and verify ownership in code. This lets us still
  //    unblock the SANDBOX auto-confirm fallback when section 2 fails for
  //    non-ownership reasons. Ownership is strictly enforced — we NEVER
  //    return 'pending' (which feeds sandbox auto-confirm) for a row whose
  //    customer_id doesn't match the authenticated user.
  if (hints.orderId) {
    const { data: anyOrder, error: anyOrderErr } = await supabase
      .from('orders')
      .select('id, status, customer_id')
      .eq('id', hints.orderId)
      .maybeSingle();
    if (anyOrderErr) {
      (debug as any).any_order_query_error = anyOrderErr.message || String(anyOrderErr);
    }
    if (anyOrder) {
      debug.order_row = anyOrder.id;
      debug.order_status = anyOrder.status;
      debug.order_customer_id = anyOrder.customer_id;
      const ownerOk = userId ? anyOrder.customer_id === userId : true;
      debug.order_by_id_owner_mismatch = !ownerOk;
      if (ownerOk) {
        const s = String(anyOrder.status || '').toLowerCase();
        const matchedById = true;
        if (s === 'confirmed' || s === 'paid') return { status: 'completed', source: 'orders', matchedById, debug };
        if (s === 'cancelled' || s === 'canceled') return { status: 'cancelled', source: 'orders', matchedById, debug };
        return { status: 'pending', source: 'orders', matchedById, debug };
      }
    }
  }
  if (hints.purchaseId) {
    const { data: anyTicket, error: anyTicketErr } = await supabase
      .from('ticket_purchases')
      .select('id, status, customer_id')
      .eq('id', hints.purchaseId)
      .maybeSingle();
    if (anyTicketErr) {
      (debug as any).any_ticket_query_error = anyTicketErr.message || String(anyTicketErr);
    }
    if (anyTicket) {
      debug.ticket_row = anyTicket.id;
      debug.ticket_status = anyTicket.status;
      (debug as any).ticket_customer_id = anyTicket.customer_id;
      const ownerOk = userId ? anyTicket.customer_id === userId : true;
      (debug as any).ticket_by_id_owner_mismatch = !ownerOk;
      if (ownerOk) {
        const s = String(anyTicket.status || '').toLowerCase();
        const matchedById = true;
        if (s === 'confirmed') return { status: 'completed', source: 'ticket_purchases', matchedById, debug };
        if (s === 'cancelled' || s === 'canceled') return { status: 'cancelled', source: 'ticket_purchases', matchedById, debug };
        return { status: 'pending', source: 'ticket_purchases', matchedById, debug };
      }
    }
  }

  return { status: 'unknown', source: null, debug };
}

// Backfills payment_ref when we matched a ticket/order by id (because the
// initial link from /api/payments/initiate didn't land). Best-effort; logs
// and swallows errors — the caller still proceeds with confirmation.
async function backfillPaymentRef(
  table: 'ticket_purchases' | 'orders',
  id: string,
  reference: string,
) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from(table).update({ payment_ref: reference }).eq('id', id).is('payment_ref', null);
  } catch (err) {
    console.error(`[Status] backfill payment_ref on ${table} failed:`, err);
  }
}

// Client-facing status endpoint. Queries GeniusPay as the source of truth, then
// mirrors a successful payment into our own DB (idempotently). If the upstream
// lookup fails (common in sandbox, where GET /payments/{reference} returns 404
// even right after a successful simulation), falls back to our own `payments`
// table which the webhook writes on payment.success. This guarantees that
// `/payment/success` resolves to confirmed as soon as either path succeeds.
/**
 * Status check ordering — local-DB-first (perf optimization).
 *
 * Polls hit this endpoint every ~1-3s. The webhook normally lands within
 * 5-15s of the user paying, so by the time the second/third poll arrives
 * our `payments` row is already `confirmed`. Hitting GeniusPay first on
 * every poll spent a 600-1500ms upstream roundtrip even though we already
 * had the answer locally — that wasted 200+ GeniusPay calls per paid
 * order at 90s of polling, AND made the user wait an extra second per
 * poll attempt for nothing.
 *
 * New ordering:
 *   1. Local DB lookup (fast: ~30-80ms). If we already know the outcome
 *      (webhook processed, ticket/order flipped, local payment row exists),
 *      return immediately.
 *   2. Only fall back to GeniusPay GET /payments/{ref} when local says
 *      pending/unknown (= webhook hasn't fired yet). Same retry/timeout
 *      semantics as before.
 *   3. SANDBOX_ auto-confirm path is unchanged — still triggered when
 *      local has a pending ticket/order owned by the user but no
 *      authoritative completion signal yet.
 *
 * Live payment correctness is preserved: a confirmed local row only
 * exists if it was written by either the webhook (HMAC-verified) or by a
 * prior upstream-completed call — both authoritative.
 */
async function handlePaymentStatusCheck(
  reference: string,
  userId: string,
  res: VercelResponse,
  keys: { publicKey: string; secretKey: string } | null,
  hints: { purchaseId?: string | null; orderId?: string | null } = {},
) {
  let upstreamStatus: number | null = null;
  let lastLocalDebug: Record<string, unknown> | undefined;

  // ── Step 1: Local DB lookup (fast path) ────────────────────────────
  try {
    const local = await lookupLocalStatus(reference, userId, hints);
    lastLocalDebug = local.debug;

    if (local.status === 'completed') {
      // When the completion signal came from the `payments` table (webhook
      // fired first), propagate to ticket_purchases/orders via the guarded
      // update path, BUT skip the payments upsert — the row is already
      // correct, and re-upserting with the raw DB row (whose shape differs
      // from the GeniusPay API response) would overwrite amount, order_id,
      // restaurant_id, provider_response with null/garbage. We rebuild a
      // synthetic paymentData-shaped object from `provider_response` (which
      // contains the original webhook payload) so metadata-driven lookups
      // still work; if provider_response isn't a usable object, the helper
      // falls back to matching by payment_ref.
      //
      // When the signal came from ticket_purchases/orders, the ticket/order
      // is already confirmed — nothing left to persist.
      let ticketId: string | null = null;
      let orderId: string | null = null;
      if (local.source === 'payments' && local.payment) {
        const pr = (local.payment as any).provider_response;
        const syntheticPaymentData = {
          amount: local.payment.amount,
          currency: local.payment.currency,
          metadata:
            (pr && typeof pr === 'object' && (pr.data?.metadata || pr.metadata)) || {},
        };
        const confirmation = await confirmPaymentInDatabase(
          reference,
          syntheticPaymentData,
          { skipPaymentsUpsert: true },
        );
        ticketId = confirmation.ticket_id;
        orderId = confirmation.order_id;
      }

      return res.status(200).json({
        success: true,
        reference,
        status: 'completed',
        source: 'local_db',
        local_source: local.source,
        ticket_id: ticketId,
        order_id: orderId,
      });
    }

    if (local.status === 'failed' || local.status === 'cancelled') {
      return res.status(200).json({
        success: true,
        reference,
        status: local.status,
        source: 'local_db',
      });
    }
    // local says pending or unknown → fall through to upstream
  } catch (err) {
    console.error('[Status] Local-first lookup threw:', err);
    // continue to upstream
  }

  // ── Step 2: GeniusPay upstream lookup (legacy — only when GP keys present) ─
  // En mode Kkiapay-only (KKIAPAY_* définis, GENIUSPAY_* absents), on saute
  // complètement cette étape : _verifyKkiapay.ts a déjà confirmé la transaction
  // en DB via la callback du widget, et le webhook Kkiapay est la source de
  // vérité pour les flows asynchrones. Appeler l'API GeniusPay ici renverrait
  // 404 systématiquement pour toute référence Kkiapay → boucle de polling
  // bloquée côté client jusqu'au timeout.
  let upstreamMapped: 'completed' | 'pending' | 'failed' | 'cancelled' | null = null;
  let upstreamRawStatus = '';
  let upstreamPaymentData: any = null;

  if (!keys) {
    return res.status(200).json({
      success: true,
      reference,
      status: 'pending',
      source: 'local_db',
      message: 'Awaiting webhook or verify confirmation.',
      _debug: lastLocalDebug,
    });
  }

  try {
    const upstream = await withRetry(
      () =>
        fetch(`${GENIUSPAY_BASE_URL}/payments/${encodeURIComponent(reference)}`, {
          method: 'GET',
          headers: buildGeniusPayHeaders(keys),
        }),
      { attempts: 3, label: 'GeniusPay GET payment' },
    );

    upstreamStatus = upstream.status;
    const raw = await upstream.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

    if (upstream.ok) {
      upstreamPaymentData = data?.data?.payment || data?.data || data;
      upstreamRawStatus = upstreamPaymentData?.status || '';
      upstreamMapped = mapGeniusPayStatus(upstreamRawStatus);

      if (upstreamMapped === 'completed') {
        const confirmation = await confirmPaymentInDatabase(reference, upstreamPaymentData);
        return res.status(200).json({
          success: true,
          reference,
          status: 'completed',
          raw_status: upstreamRawStatus,
          source: 'upstream',
          amount: upstreamPaymentData?.amount,
          currency: upstreamPaymentData?.currency,
          gateway: upstreamPaymentData?.gateway,
          environment: upstreamPaymentData?.environment,
          ticket_id: confirmation.ticket_id,
          order_id: confirmation.order_id,
        });
      }

      if (upstreamMapped === 'failed' || upstreamMapped === 'cancelled') {
        return res.status(200).json({
          success: true,
          reference,
          status: upstreamMapped,
          raw_status: upstreamRawStatus,
          source: 'upstream',
        });
      }
      // upstream says pending → fall through to sandbox safety net
    } else {
      console.error('[Status] GeniusPay lookup failed:', reference, upstream.status, raw.substring(0, 200));
    }
  } catch (err) {
    console.error('[Status] Upstream GET threw:', err);
  }

  // ── Step 3: SANDBOX_ auto-confirm safety net ───────────────────────
  // GeniusPay's sandbox GET /payments/{ref} returns 404 for SANDBOX_
  // references even after a successful "Simuler le paiement", AND the
  // sandbox doesn't deliver webhooks unless the merchant explicitly wires
  // one up. Without this safety net, sandbox testing leaves the user
  // stuck polling pending for 30s.
  //
  // We re-run the local lookup here (cheap) since we may have new state
  // after the upstream call also updated state internally. Live payments
  // (MTX-...) are unaffected — only SANDBOX_ refs trigger this path.
  try {
    const localAfterUpstream = await lookupLocalStatus(reference, userId, hints);
    lastLocalDebug = localAfterUpstream.debug;

    if (
      reference.startsWith('SANDBOX_') &&
      (localAfterUpstream.source === 'ticket_purchases' || localAfterUpstream.source === 'orders') &&
      localAfterUpstream.status === 'pending'
    ) {
      const metadata: Record<string, string> = {};
      if (localAfterUpstream.matchedById && hints.purchaseId && localAfterUpstream.source === 'ticket_purchases') {
        await backfillPaymentRef('ticket_purchases', hints.purchaseId, reference);
        metadata.ticket_purchase_id = hints.purchaseId;
      }
      if (localAfterUpstream.matchedById && hints.orderId && localAfterUpstream.source === 'orders') {
        await backfillPaymentRef('orders', hints.orderId, reference);
        metadata.order_id = hints.orderId;
      }
      const confirmation = await confirmPaymentInDatabase(reference, {
        amount: 0,
        currency: 'XOF',
        metadata,
      });
      return res.status(200).json({
        success: true,
        reference,
        status: 'completed',
        source: 'sandbox_redirect',
        local_source: localAfterUpstream.source,
        matched_by_id: localAfterUpstream.matchedById === true,
        upstream_status: upstreamStatus,
        ticket_id: confirmation.ticket_id,
        order_id: confirmation.order_id,
      });
    }
  } catch (err) {
    console.error('[Status] Sandbox safety net threw:', err);
  }

  return res.status(200).json({
    success: false,
    reference,
    status: 'pending',
    upstream_status: upstreamStatus,
    message: 'Payment not yet confirmed (neither upstream nor webhook).',
    _debug: lastLocalDebug,
  });
}

async function proxyGet(
  path: string,
  res: VercelResponse,
  keys: { publicKey: string; secretKey: string },
  { cacheControl }: { cacheControl: string },
) {
  try {
    const response = await fetch(`${GENIUSPAY_BASE_URL}${path}`, {
      method: 'GET',
      headers: buildGeniusPayHeaders(keys),
    });

    const raw = await response.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      console.error('[GeniusPay] Proxy GET error:', path, response.status, raw.substring(0, 300));
      return res.status(response.status).json({
        success: false,
        error: data?.message || data?.error || 'GeniusPay request failed',
        status: response.status,
        details: data,
      });
    }

    res.setHeader('Cache-Control', cacheControl);
    return res.status(200).json(data ?? { success: true, data: null });
  } catch (error) {
    console.error('[GeniusPay] Proxy GET unexpected error:', path, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Restrict CORS to trusted origins (same policy as payouts).
  applyCors(res, req);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const action = typeof req.query?.action === 'string' ? req.query.action : '';

  // Kkiapay payment verification (routed here via vercel.json rewrite from
  // /api/payments/verify to keep us under Vercel Hobby's 12-function limit).
  if (action === 'verify') {
    return verifyKkiapayHandler(req, res);
  }

  // Dispatch GET sub-actions (routed here via vercel.json rewrites)
  if (req.method === 'GET') {
    // Les clés GeniusPay ne sont requises que pour les sous-actions legacy
    // (balance / pawapay_providers / polling upstream). En mode Kkiapay-only,
    // `keys` est null ; `handlePaymentStatusCheck` saute alors l'appel
    // upstream et ne lit que la DB locale.
    const keys = getGeniusPayKeys();

    if ((action === 'balance' || action === 'pawapay_providers') && !keys) {
      return res.status(410).json({
        success: false,
        error: 'GeniusPay endpoints removed',
        message:
          'Les endpoints /api/account/balance et /api/pawapay/providers ne sont plus supportés (migration 100% Kkiapay). Utilisez le dashboard Kkiapay : https://app.kkiapay.me/dashboard',
      });
    }

    if (action === 'balance') {
      // Require an authenticated Supabase session — this endpoint exposes
      // merchant financial data and must not be reachable anonymously.
      const auth = await requireAuthenticatedUser(req);
      if ('error' in auth) {
        return res.status(auth.status).json({ success: false, error: auth.error });
      }
      return proxyGet('/account/balance', res, keys, { cacheControl: 'private, no-store' });
    }

    if (action === 'pawapay_providers') {
      // Providers list is not financial data but still requires auth to avoid
      // exposing it to arbitrary origins (it also counts against the upstream
      // rate limit).
      const auth = await requireAuthenticatedUser(req);
      if ('error' in auth) {
        return res.status(auth.status).json({ success: false, error: auth.error });
      }
      const country = typeof req.query?.country === 'string' ? req.query.country.trim() : '';
      const path = country
        ? `/pawapay/providers?country=${encodeURIComponent(country)}`
        : '/pawapay/providers';
      return proxyGet(path, res, keys, {
        cacheControl: 'private, max-age=300',
      });
    }

    // /api/payments/status?reference=MTX-... (routed here via vercel.json)
    // Returns a synthesized status compatible with the PaymentSuccess polling UI
    // ({ status: 'completed' | 'pending' | 'failed' | 'cancelled' }). On completed,
    // ALSO performs the DB confirmation inline so tickets/orders flip to confirmed
    // even if the GeniusPay webhook never arrives (network hiccups, dashboard not
    // configured, signature mismatch, etc.). The webhook path remains the primary
    // mechanism; this endpoint is the client-side fallback.
    //
    // Requires a valid Supabase session (same pattern as balance / pawapay_providers)
    // so unauthenticated callers cannot (a) read payment details from GeniusPay,
    // (b) trigger admin DB writes via confirmPaymentInDatabase, or (c) abuse the
    // upstream GeniusPay rate limit. PaymentSuccess.tsx always has a session
    // (the user was logged in to initiate the purchase and Supabase persists it
    // in localStorage across the GeniusPay redirect).
    const rawReference = typeof req.query?.reference === 'string' ? req.query.reference : '';
    const reference = rawReference.trim();
    if (reference) {
      const auth = await requireAuthenticatedUser(req);
      if ('error' in auth) {
        return res.status(auth.status).json({ success: false, error: auth.error });
      }
      const purchaseIdRaw = typeof req.query?.purchase_id === 'string' ? req.query.purchase_id.trim() : '';
      const orderIdRaw = typeof req.query?.order_id === 'string' ? req.query.order_id.trim() : '';
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const hints = {
        purchaseId: uuidRe.test(purchaseIdRaw) ? purchaseIdRaw : null,
        orderId: uuidRe.test(orderIdRaw) ? orderIdRaw : null,
      };
      return handlePaymentStatusCheck(reference, auth.userId, res, keys, hints);
    }

    return res.status(400).json({
      success: false,
      error: 'Unknown or missing GET action',
      message: 'Supported: action=balance, action=pawapay_providers, or ?reference=MTX-...',
    });
  }

  // Only POST is allowed beyond this point
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed.',
    });
  }

  // Hoisted pour rester accessibles dans le catch final (sinon le marquage
  // payment_attempts='failed' en cas d'exception ne compile pas).
  let idempotencyKey: string | null = null;
  let supabaseAdminForIdem: ReturnType<typeof getSupabaseAdmin> | null = null;

  try {
    // Step 1: Get API keys from environment
    const keys = getGeniusPayKeys();

    if (!keys) {
      // Mode Kkiapay-only (post-migration) : le frontend ne POST plus jamais
      // ici — tous les paiements partent du widget kkiapay-react côté client
      // puis POST /api/payments/verify. Un appel POST /api/payments/initiate
      // en Kkiapay-only est soit un ancien client cached, soit du scraping.
      // 410 Gone = "cette ressource a été retirée" → plus clair que 500.
      console.warn('[Payments] POST /api/payments/initiate hit in Kkiapay-only mode — returning 410 Gone');
      return res.status(410).json({
        success: false,
        error: 'Endpoint deprecated',
        message:
          'Restafy a migré à 100% sur Kkiapay. Ce endpoint (initiation GeniusPay directe) n\'est plus supporté. ' +
          'Les paiements passent désormais par le widget Kkiapay côté client puis POST /api/payments/verify.',
      });
    }

    // Step 2: Parse request body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
      });
    }

    const {
      amount,
      currency = 'XOF',
      description = 'Paiement Restafy',
      // Flat customer fields (backward compatibility)
      customer_name,
      customer_email,
      customer_phone,
      customer_country,
      // Nested customer object (new, matches doc)
      customer: customerInput,
      // Order / business context
      order_id,
      restaurant_id,
      ticket_purchase_id,
      ticket_order_id,
      metadata = {},
      // GeniusPay routing / gateway selection
      payment_method,
      gateway,
      mmo_provider,
      // Redirect URLs (override defaults)
      success_url,
      error_url,
    } = body;

    // Step 3: Validate required fields
    if (!amount || Number(amount) < 200) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
        message: 'Amount must be at least 200 XOF',
      });
    }

    // Step 3bis: Idempotency-Key (RFC Stripe/GeniusPay convention).
    // Obligatoire côté client depuis le fix P0. Les clients legacy qui n'en
    // envoient pas passent en mode best-effort (sans dédup) — on loggue un
    // warning pour pouvoir tracer en CloudWatch combien de tentatives restent
    // non protégées. Une fois tous les clients migrés on pourra rendre le
    // header strictement requis.
    const idempotencyKeyHeaderRaw = String(
      req.headers['idempotency-key'] || req.headers['Idempotency-Key'] || '',
    ).trim();
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    idempotencyKey = uuidRe.test(idempotencyKeyHeaderRaw) ? idempotencyKeyHeaderRaw : null;

    // Auth optionnelle à ce stade (EventCheckout public ne l'envoie pas
    // toujours). Si présente, on scope l'idempotency au user_id.
    const authResult = await requireAuthenticatedUser(req);
    const idemUserId = 'error' in authResult ? null : authResult.userId;

    // Rate limit pour protéger GeniusPay et la DB d'un abus (replay massif,
    // brute-force d'idempotency keys, scrape phone numbers, etc.).
    // - Auth: 30 init / minute / user (largement au-dessus d'un usage humain
    //   normal — un client n'enchaîne pas 30 paiements en 60s).
    // - Public (EventCheckout): 15 init / minute / IP (plus strict car pas
    //   d'identité forte).
    // Fail-open : si Supabase répond une erreur, on laisse passer plutôt que
    // de bloquer tous les paiements pendant un incident.
    {
      const rlIdentity = idemUserId || `ip:${getClientIp(req.headers)}`;
      const rlLimit = idemUserId ? 30 : 15;
      const rl = await checkRateLimit({
        bucket: 'payments_initiate',
        identity: rlIdentity,
        limit: rlLimit,
        windowSeconds: 60,
      });
      if (!rl.allowed) {
        res.setHeader('Retry-After', String(rl.retryAfter));
        return res.status(429).json({
          success: false,
          error: 'Too many payment attempts',
          message: `Trop de tentatives. Réessayez dans ${rl.retryAfter}s.`,
          retry_after_seconds: rl.retryAfter,
        });
      }
    }

    if (idempotencyKey) {
      try {
        supabaseAdminForIdem = getSupabaseAdmin();
        const { data: existing } = await supabaseAdminForIdem
          .from('payment_attempts')
          .select('status, response')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (existing) {
          if (existing.status === 'succeeded' && existing.response) {
            console.log('[GeniusPay] Idempotency hit (succeeded):', idempotencyKey);
            return res.status(200).json(existing.response);
          }
          if (existing.status === 'in_flight') {
            console.log('[GeniusPay] Idempotency hit (in_flight):', idempotencyKey);
            return res.status(202).json({
              success: false,
              pending: true,
              error: 'Payment initiation already in progress for this key',
            });
          }
          // status='failed' → on laisse une nouvelle tentative reprendre
          // (le front aura généré une nouvelle clé au clic suivant).
        } else {
          await supabaseAdminForIdem.from('payment_attempts').insert({
            idempotency_key: idempotencyKey,
            user_id: idemUserId,
            order_id: order_id || null,
            ticket_purchase_id: ticket_purchase_id || null,
            request: body,
            status: 'in_flight',
          });
        }
      } catch (idemErr) {
        // Non-bloquant: si la table n'existe pas encore (migration pas
        // appliquée), on continue sans idempotency plutôt que de bloquer
        // tous les paiements.
        console.error('[GeniusPay] Idempotency check skipped:', idemErr);
        supabaseAdminForIdem = null;
      }
    } else {
      console.warn('[GeniusPay] POST /initiate without Idempotency-Key header — legacy client');
    }

    // Resolve customer fields (nested > flat)
    const customerObj = (customerInput && typeof customerInput === 'object') ? customerInput : {};
    const resolvedCustomer = {
      name: customerObj.name || customer_name || 'Client Restafy',
      email: customerObj.email || customer_email || undefined,
      phone: customerObj.phone || customer_phone || undefined,
      country: customerObj.country || customer_country || undefined,
    };

    // Step 3ter: Auto-detect customer country from phone prefix when not
    // provided. This is critical for PawaPay routing: GeniusPay needs the
    // country to route to the correct MMO provider.
    if (!resolvedCustomer.country && resolvedCustomer.phone) {
      const phone = resolvedCustomer.phone.replace(/\s+/g, '');
      if (phone.startsWith('+229') || phone.startsWith('229')) {
        resolvedCustomer.country = 'BJ';
      } else if (phone.startsWith('+225') || phone.startsWith('225')) {
        resolvedCustomer.country = 'CI';
      } else if (phone.startsWith('+221') || phone.startsWith('221')) {
        resolvedCustomer.country = 'SN';
      } else if (phone.startsWith('+237') || phone.startsWith('237')) {
        resolvedCustomer.country = 'CM';
      }
    }

    // Step 3quater: Payment routing per country.
    //
    // GeniusPay's valid payment_method values:
    //   wave, pawapay, paystack, orange_money, mtn_money, card
    //
    // GeniusPay's valid gateway values:
    //   wave, pawapay, orange_money, mtn_momo, moov_money
    //
    // IMPORTANT: 'moov_money' is a valid GATEWAY but NOT a valid
    // payment_method. Sending an invalid payment_method causes GeniusPay
    // to silently fall back to Wave redirect.
    //
    // For PawaPay routing, send payment_method='pawapay' + mmo_provider.
    // GeniusPay docs list 12 supported countries including Bénin (BJ):
    //   BJ: MTN_MOMO_BEN, MOOV_BEN
    //   CM: MTN_MOMO_CMR, ORANGE_CMR
    //   SN: FREE_SEN, ORANGE_SEN
    //   CI: MTN_MOMO_CIV, ORANGE_CIV
    //   CD: AIRTEL_COD, ORANGE_COD, VODACOM_MPESA_COD
    //   KE: MPESA_KEN
    //   UG: MTN_MOMO_UGA
    //   ZM: MTN_MOMO_ZMB
    //
    // See https://pay.genius.ci/docs/api — PawaPay providers table.

    // Countries routed through PawaPay (GeniusPay's PawaPay provider list)
    const PAWAPAY_COUNTRIES: Record<string, Record<string, string>> = {
      BJ: {
        mtn_money: 'MTN_MOMO_BEN',
        moov_money: 'MOOV_BEN',
      },
      CM: {
        mtn_money: 'MTN_MOMO_CMR',
        orange_money: 'ORANGE_CMR',
      },
      SN: {
        orange_money: 'ORANGE_SEN',
        free_money: 'FREE_SEN',
      },
      CI: {
        mtn_money: 'MTN_MOMO_CIV',
        orange_money: 'ORANGE_CIV',
      },
      CD: {
        mtn_money: 'MTN_MOMO_COD',
        orange_money: 'ORANGE_COD',
        airtel_money: 'AIRTEL_COD',
      },
      CG: {
        mtn_money: 'MTN_MOMO_COG',
        airtel_money: 'AIRTEL_COG',
      },
      UG: {
        mtn_money: 'MTN_MOMO_UGA',
        airtel_money: 'AIRTEL_UGA',
      },
      RW: {
        mtn_money: 'MTN_MOMO_RWA',
        airtel_money: 'AIRTEL_RWA',
      },
      KE: {
        mpesa: 'MPESA_KEN',
      },
    };

    let resolvedPaymentMethod = payment_method || undefined;
    let resolvedGateway = gateway || undefined;
    let resolvedMmoProvider = mmo_provider || undefined;

    // Operators whose name IS a valid GeniusPay payment_method and can be
    // sent directly without PawaPay indirection.
    const DIRECT_PAYMENT_METHODS = new Set(['mtn_money', 'orange_money']);

    // Map frontend operator names to the explicit GeniusPay gateway value.
    // Setting the gateway prevents GeniusPay from silently falling back
    // to Wave when PawaPay routing is ambiguous or not activated.
    const OPERATOR_TO_GATEWAY: Record<string, string> = {
      moov_money: 'moov_money',
      mtn_money: 'mtn_momo',
      orange_money: 'orange_money',
    };

    if (resolvedCustomer.country && payment_method && !mmo_provider) {
      const countryMap = PAWAPAY_COUNTRIES[resolvedCustomer.country];
      if (countryMap) {
        const providerCode = countryMap[payment_method];
        if (providerCode) {
          const directGateway = OPERATOR_TO_GATEWAY[payment_method];

          if (DIRECT_PAYMENT_METHODS.has(payment_method)) {
            // Operator has a valid direct payment_method (e.g. mtn_money).
            // Use it with the explicit gateway for reliable routing.
            resolvedPaymentMethod = payment_method;
            resolvedGateway = directGateway;
            resolvedMmoProvider = undefined;
          } else {
            // Operator has no valid payment_method (e.g. moov_money).
            // Route through PawaPay AND set the gateway explicitly so
            // GeniusPay does not silently fall back to Wave.
            resolvedPaymentMethod = 'pawapay';
            resolvedMmoProvider = providerCode;
            resolvedGateway = directGateway || 'pawapay';
          }

          console.log(
            `[GeniusPay] Routing: ${payment_method} in ${resolvedCustomer.country} → ` +
            `payment_method=${resolvedPaymentMethod}, gateway=${resolvedGateway}, ` +
            `mmo_provider=${resolvedMmoProvider || 'none'}`,
          );
        }
      }
    }

    console.log('[GeniusPay] Initiating payment:', {
      amount,
      currency,
      order_id,
      payment_method: resolvedPaymentMethod,
      gateway: resolvedGateway,
      mmo_provider: resolvedMmoProvider,
      customer_name: resolvedCustomer.name,
      customer_country: resolvedCustomer.country,
      original_payment_method: payment_method,
    });

    // Step 4: Build payment payload according to GeniusPay documentation
    const paymentPayload: Record<string, unknown> = {
      amount: Math.round(Number(amount)),
      currency,
      description,
      success_url: success_url || `${APP_URL}/payment/success`,
      error_url: error_url || `${APP_URL}/payment/cancel`,
      customer: {
        name: resolvedCustomer.name,
        ...(resolvedCustomer.email ? { email: resolvedCustomer.email } : {}),
        ...(resolvedCustomer.phone ? { phone: resolvedCustomer.phone } : {}),
        ...(resolvedCustomer.country ? { country: resolvedCustomer.country } : {}),
      },
      metadata: {
        ...(order_id ? { order_id } : {}),
        ...(restaurant_id ? { restaurant_id } : {}),
        ...(ticket_purchase_id ? { ticket_purchase_id } : {}),
        ...(ticket_order_id ? { ticket_order_id } : {}),
        ...metadata,
      },
    };

    if (resolvedPaymentMethod) paymentPayload.payment_method = resolvedPaymentMethod;
    if (resolvedGateway) paymentPayload.gateway = resolvedGateway;
    if (resolvedMmoProvider) paymentPayload.mmo_provider = resolvedMmoProvider;

    // Step 5: Call GeniusPay API with X-API-Key + X-API-Secret authentication
    //
    // IMPORTANT: aucun withRetry ici. POST /payments n'est PAS idempotent côté
    // GeniusPay (pas de support d'un header Idempotency-Key upstream à ce jour),
    // donc retenter sur 5xx/timeout/ECONNRESET peut créer un second paiement
    // si GeniusPay a déjà débité le client mais a raté la réponse. On laisse
    // le client (front + idempotency_key) décider explicitement d'un nouvel
    // essai via un clic utilisateur.
    console.log('[GeniusPay] Calling API:', `${GENIUSPAY_BASE_URL}/payments`);

    const response = await fetch(`${GENIUSPAY_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'X-API-Key': keys.publicKey,
        'X-API-Secret': keys.secretKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Restafy/1.0',
      },
      body: JSON.stringify(paymentPayload),
    });

    console.log('[GeniusPay] Response status:', response.status);

    // Step 6: Parse response
    const responseText = await response.text();
    let responseData: any = null;

    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch (e) {
      console.error('[GeniusPay] Failed to parse response:', responseText.substring(0, 200));
      responseData = null;
    }

    // Step 7: Handle API errors
    if (!response.ok) {
      console.error('[GeniusPay] API Error:', {
        status: response.status,
        response: responseText.substring(0, 500),
      });

      let errorMessage = 'Payment initiation failed';

      switch (response.status) {
        case 400:
          errorMessage = 'Invalid request parameters';
          break;
        case 401:
          errorMessage = 'Invalid API keys. Check GENIUSPAY_PUBLIC_KEY and GENIUSPAY_SECRET_KEY.';
          break;
        case 403:
          errorMessage = 'API key does not have permission for this action';
          break;
        case 404:
          errorMessage = 'Country or provider not supported by PawaPay';
          break;
        case 422:
          errorMessage = 'Validation failed: insufficient balance or limit exceeded';
          break;
        case 429:
          errorMessage = 'Too many requests. Please wait and try again.';
          break;
        case 500:
          errorMessage = 'GeniusPay server error. Please try again later.';
          break;
        default:
          if (responseData?.message) {
            errorMessage = responseData.message;
          } else if (responseData?.error) {
            errorMessage = responseData.error;
          }
      }

      // Marque l'attempt comme 'failed' pour libérer la clé d'idempotency
      // (sinon un rejeu concurrent avec la même clé resterait bloqué en 202
      // 'in_flight' jusqu'à la purge 14j).
      if (idempotencyKey && supabaseAdminForIdem) {
        try {
          await supabaseAdminForIdem
            .from('payment_attempts')
            .update({
              status: 'failed',
              response: {
                success: false,
                error: errorMessage,
                status: response.status,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('idempotency_key', idempotencyKey);
        } catch (err) {
          console.error('[GeniusPay] Failed to mark attempt failed:', err);
        }
      }

      return res.status(response.status).json({
        success: false,
        error: errorMessage,
        status: response.status,
        details: responseData,
      });
    }

    // Step 8: Extract payment data from response
    console.log('[GeniusPay] Success response:', JSON.stringify(responseData).substring(0, 300));

    const paymentData = responseData?.data?.payment || responseData?.data || responseData;
    const checkoutUrl = paymentData?.checkout_url || paymentData?.payment_url;
    const reference = paymentData?.reference;

    // Mode "direct" (option B) : quand le client envoie un payment_method
    // précis avec un customer_phone, GeniusPay déclenche l'USSD push
    // directement et peut renvoyer { reference, status: 'pending' } SANS
    // checkout_url. On accepte ce cas. Dans le cas contraire (mode redirect
    // classique), checkout_url reste obligatoire.
    //
    // GeniusPay can return gateway='wave' + checkout_url='pay.wave.com/...'
    // even when we request PawaPay routing (e.g. for BJ). This means the
    // USSD push was NOT triggered and the user must pay via Wave redirect.
    // Detect this and set mode='redirect' so the frontend redirects.
    const responseGateway = paymentData?.gateway;
    const isWaveFallback = responseGateway === 'wave' && checkoutUrl;
    const isDirectMode = Boolean(
      resolvedPaymentMethod &&
      resolvedCustomer.phone &&
      reference &&
      !isWaveFallback,
    );

    if (!checkoutUrl && !isDirectMode) {
      console.error('[GeniusPay] No checkout URL in response:', responseData);
      return res.status(502).json({
        success: false,
        error: 'Invalid response from payment gateway',
        message: 'No checkout URL provided',
        response: responseData,
      });
    }

    if (isWaveFallback) {
      console.error(
        `[GeniusPay] UNEXPECTED Wave fallback for ${resolvedCustomer.country}. ` +
        `Requested: payment_method=${resolvedPaymentMethod}, gateway=${resolvedGateway}, ` +
        `mmo_provider=${resolvedMmoProvider}. Response gateway: ${responseGateway}. ` +
        `This may indicate the gateway is not activated on the GeniusPay account. ` +
        `Switching to redirect mode.`,
      );
    }

    console.log('[GeniusPay] Payment initiated successfully:', {
      reference,
      checkout_url: checkoutUrl || '(direct mode, no checkout_url)',
      mode: isDirectMode ? 'direct' : 'redirect',
      response_gateway: responseGateway,
    });

    // Step 8bis: Link the GeniusPay reference back to the ticket_purchase
    // / order / ticket_order row so that the webhook (/api/webhooks?type=payment)
    // can find and auto-confirm it when payment.success arrives.
    // Without this link, the webhook query `.eq('payment_ref', reference)` never
    // matches and operators have to validate tickets manually.
    if (reference) {
      try {
        const adminForLink = getSupabaseAdmin();

        if (ticket_purchase_id) {
          await adminForLink
            .from('ticket_purchases')
            .update({ payment_ref: reference })
            .eq('id', ticket_purchase_id);
        }

        if (order_id) {
          await adminForLink
            .from('orders')
            .update({ payment_ref: reference })
            .eq('id', order_id);
        }

        // ticket_orders : la table n'a pas de colonne geniuspay_reference (cf.
        // scripts/091-ticket-orders-table.sql). La réf GeniusPay (MTX-*) est
        // propagée au webhook via metadata.ticket_order_id (ajoutée au payload
        // GeniusPay plus haut) ; le webhook matche alors sur .eq('id', ticket_order_id).
        // Aucun UPDATE nécessaire côté ticket_orders ici.
      } catch (linkErr) {
        // Non-bloquant : si le link échoue, le paiement peut quand même aboutir,
        // le webhook tombera en fallback sur metadata.ticket_purchase_id / order_id.
        console.error('[GeniusPay] Failed to link reference back to DB row:', linkErr);
      }
    }

    // Step 9: Return success response
    const successResponse = {
      success: true,
      mode: isDirectMode ? 'direct' : 'redirect',
      checkout_url: checkoutUrl,
      payment_url: paymentData?.payment_url || checkoutUrl,
      reference,
      payment_id: paymentData?.id,
      status: paymentData?.status || 'pending',
      amount: paymentData?.amount,
      fees: paymentData?.fees,
      net_amount: paymentData?.net_amount,
      gateway: paymentData?.gateway,
      environment: paymentData?.environment,
      order_id,
    };

    // Persist for idempotency: le rejeu avec la même clé renverra
    // exactement cette réponse (incluant checkout_url) sans re-créer de
    // paiement GeniusPay.
    if (idempotencyKey && supabaseAdminForIdem) {
      try {
        await supabaseAdminForIdem
          .from('payment_attempts')
          .update({
            status: 'succeeded',
            response: successResponse,
            updated_at: new Date().toISOString(),
          })
          .eq('idempotency_key', idempotencyKey);
      } catch (err) {
        console.error('[GeniusPay] Failed to persist idempotency response:', err);
      }
    }

    return res.status(200).json(successResponse);

  } catch (error) {
    // Step 10: Handle unexpected errors
    console.error('[GeniusPay] Unexpected error:', error);

    // Marque l'attempt comme 'failed' pour libérer la clé d'idempotency
    // (sinon un rejeu concurrent avec la même clé resterait bloqué en 202
    // 'in_flight' jusqu'à la purge 14j).
    if (idempotencyKey && supabaseAdminForIdem) {
      try {
        await supabaseAdminForIdem
          .from('payment_attempts')
          .update({
            status: 'failed',
            response: {
              success: false,
              error: 'Internal server error',
              message: error instanceof Error ? error.message : 'Unknown error occurred',
            },
            updated_at: new Date().toISOString(),
          })
          .eq('idempotency_key', idempotencyKey);
      } catch (err) {
        console.error('[GeniusPay] Failed to mark attempt failed:', err);
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}
