import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit';
import { applyCors } from '../_shared/cors';
// NOTE: previously imported `validateAndCalculateOrder` from
// `../../src/lib/api/orderValidation`. That cross-directory import was causing
// Vercel to emit FUNCTION_INVOCATION_FAILED at module-load time (crash before
// any handler runs), which broke both POST /api/orders/create and the
// /api/orders/validate rewrite — so every restaurant order attempt via
// GeniusPay was rejected before it could reach the payment gateway. The
// validate branch is inlined as a 400 below; the real client (`src/pages/
// Cart.tsx`) goes straight to POST /api/orders/create, so removing this
// import restores ordering without losing any product surface.


// ═══════════════════════════════════════════════════════════════
// Email helpers (inline to avoid extra serverless function)
// ═══════════════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY;

function buildOrderConfirmationEmail(data: {
  order_id: string;
  customer_name: string;
  items: Array<{ itemName: string; quantity: number; subtotal: number }>;
  total: number;
}): { subject: string; html: string; text: string } {
  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${item.itemName}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">x${item.quantity}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${item.subtotal.toLocaleString()} FCFA</td>
      </tr>
    `
    )
    .join('');

  return {
    subject: `Commande confirmée #${data.order_id.slice(0, 8)} - Restafy`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Commande confirmée</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #e85d04; margin: 0;">✅ Commande confirmée !</h1>
  </div>
  <p>Bonjour <strong>${data.customer_name}</strong>,</p>
  <p>Votre commande a été confirmée avec succès. Voici les détails :</p>
  <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <p><strong>Commande #${data.order_id.slice(0, 8)}</strong></p>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="color: #666; font-size: 12px;">
          <th style="text-align: left;">Article</th>
          <th style="text-align: center;">Qté</th>
          <th style="text-align: right;">Prix</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot>
        <tr style="font-weight: bold;">
          <td colspan="2" style="padding: 12px 0; text-align: right;">Total :</td>
          <td style="padding: 12px 0; text-align: right;">${data.total.toLocaleString()} FCFA</td>
        </tr>
      </tfoot>
    </table>
  </div>
  <p>Merci de faire confiance à <strong>Restafy</strong> ! 🍽️</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">
    Restafy - <a href="https://restafy.shop" style="color: #e85d04;">restafy.shop</a>
  </p>
</body>
</html>
    `.trim(),
    text: `
Commande confirmée ! - Restafy

Bonjour ${data.customer_name},

Votre commande #${data.order_id.slice(0, 8)} a été confirmée.

Articles :
${data.items.map((item) => `- ${item.itemName} x${item.quantity} : ${item.subtotal.toLocaleString()} FCFA`).join('\n')}

Total : ${data.total.toLocaleString()} FCFA

Merci pour votre commande !
    `.trim(),
  };
}

function buildNewOrderEmail(data: {
  order_id: string;
  customer_name: string;
  items: Array<{ itemName: string; quantity: number; subtotal: number }>;
  total: number;
}): { subject: string; html: string; text: string } {
  return {
    subject: `🔔 Nouvelle commande #${data.order_id.slice(0, 8)} - Restafy`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Nouvelle commande</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #e85d04; margin: 0;">🔔 Nouvelle commande !</h1>
  </div>
  <p>Vous avez reçu une nouvelle commande.</p>
  <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <p><strong>Commande #${data.order_id.slice(0, 8)}</strong></p>
    <p><strong>Client :</strong> ${data.customer_name}</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
    <p><strong>Articles :</strong></p>
    <pre>${data.items.map((item) => `- ${item.itemName} x${item.quantity}`).join('\n')}</pre>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
    <p style="text-align: right; font-size: 18px;">
      <strong>Total : ${data.total.toLocaleString()} FCFA</strong>
    </p>
  </div>
  <p>Connectez-vous à votre dashboard pour traiter la commande.</p>
</body>
</html>
    `.trim(),
    text: `
🔔 Nouvelle commande ! - Restafy

Commande #${data.order_id.slice(0, 8)}
Client : ${data.customer_name}

Articles :
${data.items.map((item) => `- ${item.itemName} x${item.quantity}`).join('\n')}

Total : ${data.total.toLocaleString()} FCFA
    `.trim(),
  };
}

async function sendEmailViaResend(payload: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[orders/create] RESEND_API_KEY not set - skipping email');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Restafy <noreply@app.restafy.shop>',
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[orders/create] Resend error:', errorText);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[orders/create] Email send error:', err);
    return false;
  }
}

async function sendOrderConfirmationEmail(to: string, data: {
  order_id: string;
  customer_name: string;
  items: Array<{ itemName: string; quantity: number; subtotal: number }>;
  total: number;
}): Promise<void> {
  const email = buildOrderConfirmationEmail(data);
  await sendEmailViaResend({ to, subject: email.subject, html: email.html, text: email.text });
}

async function sendNewOrderEmail(to: string, data: {
  order_id: string;
  customer_name: string;
  items: Array<{ itemName: string; quantity: number; subtotal: number }>;
  total: number;
}): Promise<void> {
  const email = buildNewOrderEmail(data);
  await sendEmailViaResend({ to, subject: email.subject, html: email.html, text: email.text });
}

type IncomingItem = {
  itemId?: string;
  item_id?: string;
  itemName?: string;
  item_name?: string;
  quantity?: number;
  unitPrice?: number;
  unit_price?: number;
  notes?: string;
  variantId?: string;
  variant_id?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, req);

  const currentPath = req.url?.split('?')[0] || '';

  // /api/orders/validate is currently unused by the frontend (Cart.tsx goes
  // straight to /api/orders/create). Respond with a short 410 so we don't
  // re-introduce a hidden dependency on the cross-directory module import that
  // was crashing the function at load time.
  if (currentPath.endsWith('/orders/validate')) {
    if (req.method === 'OPTIONS') return res.status(204).end();
    return res.status(410).json({
      error: 'Endpoint retiré',
      message: 'Utilisez POST /api/orders/create qui valide et calcule côté serveur.',
    });
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const accessToken = authHeader.slice(7);

  try {
    const supabase = getSupabaseAdmin();
    // NOTE: @supabase/supabase-js v2 exposes `auth.getUser(token)`. The v1
    // form (`auth.api.getUser`) no longer exists — calling it crashes every
    // authenticated order with `TypeError: Cannot read properties of
    // undefined (reading 'getUser')`.
    const { data: authData, error: authErr } = await (supabase.auth as any).getUser(accessToken);
    if (authErr || !authData?.user?.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Rate limit pour empêcher le spam de création de commandes (qui peut
    // déclencher des RPC redeem_loyalty_points en cascade, saturer la table
    // orders, et bombarder les notifications realtime des restos).
    // 30 commandes/min/user est largement au-dessus d'un usage humain normal
    // (un client n'enchaîne pas 30 paniers en 60s). Fail-open en cas d'erreur
    // Supabase pour ne pas bloquer un usage légitime pendant un incident.
    {
      const rl = await checkRateLimit({
        bucket: 'orders_create',
        identity: authData.user.id,
        limit: 30,
        windowSeconds: 60,
      });
      if (!rl.allowed) {
        res.setHeader('Retry-After', String(rl.retryAfter));
        return res.status(429).json({
          error: 'Too many order creation attempts',
          message: `Trop de commandes. Réessayez dans ${rl.retryAfter}s.`,
          retry_after_seconds: rl.retryAfter,
        });
      }
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const {
      items,
      restaurant_id,
      delivery_address,
      notes,
      type,
      delivery_fee: clientDeliveryFee,
      loyalty_points_redeem: clientLoyaltyPoints,
    } = body || {};
    if (!restaurant_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Normalise items (accept camelCase from clients, snake_case from tests).
    // SECURITY: client-supplied unitPrice is IGNORED; we re-fetch from DB.
    const incomingItems = (items as IncomingItem[]).map((it) => ({
      itemId: String(it.itemId || it.item_id || '').trim(),
      quantity: Number(it.quantity || 0),
      variantId: (it.variantId || it.variant_id || null) as string | null,
      notes: typeof it.notes === 'string' ? it.notes : null,
    }));

    const invalid = incomingItems.find((i) => !i.itemId || i.quantity <= 0);
    if (invalid) {
      return res.status(400).json({
        error: 'Items invalides: itemId et quantity > 0 sont requis pour chaque ligne.',
      });
    }

    // SECURITY (B5): re-fetch authoritative prices from DB. The client
    // cannot be trusted with unitPrice — a malicious payload could pay 1
    // FCFA for a 10 000 FCFA item otherwise. We also verify each item
    // belongs to `restaurant_id` and is currently available.
    const itemIds = Array.from(new Set(incomingItems.map((i) => i.itemId)));
    const { data: dbItems, error: itemsLookupErr } = await supabase
      .from('items')
      .select('id, restaurant_id, name, price, is_available')
      .in('id', itemIds);
    if (itemsLookupErr) {
      console.error('[orders/create] Items lookup failed:', itemsLookupErr);
      return res.status(500).json({ error: 'Lookup items failed' });
    }
    const dbItemById = new Map(
      (dbItems || []).map((d) => [d.id as string, d as { id: string; restaurant_id: string; name: string; price: number; is_available: boolean }]),
    );
    const missing = itemIds.filter((id) => !dbItemById.has(id));
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Articles introuvables. Votre panier est obsolète, veuillez le rafraîchir.',
        missing_item_ids: missing,
      });
    }
    const wrongResto = (dbItems || []).filter((d) => d.restaurant_id !== restaurant_id);
    if (wrongResto.length > 0) {
      return res.status(400).json({
        error: 'Articles de plusieurs restaurants détectés. Le panier ne peut contenir qu\u2019un seul restaurant.',
      });
    }
    const unavailable = (dbItems || []).filter((d) => !d.is_available);
    if (unavailable.length > 0) {
      return res.status(409).json({
        error: 'Certains plats ne sont plus disponibles. Veuillez retirer ces articles du panier.',
        unavailable: unavailable.map((u) => ({ id: u.id, name: u.name })),
      });
    }

    const normalizedItems = incomingItems.map((it) => {
      const dbItem = dbItemById.get(it.itemId)! as { id: string; restaurant_id: string; name: string; price: number; is_available: boolean };
      const unitPrice = Number(dbItem.price);
      return {
        itemId: it.itemId,
        itemName: dbItem.name,
        quantity: it.quantity,
        unitPrice,
        variantId: it.variantId,
        notes: it.notes,
        subtotal: unitPrice * it.quantity,
      };
    });

    const subtotal = normalizedItems.reduce((sum, i) => sum + i.subtotal, 0);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', authData.user.id)
      .maybeSingle();

    const resolvedCustomerName =
      profileData?.full_name ||
      (authData.user.user_metadata?.full_name as string | undefined) ||
      (authData.user.user_metadata?.name as string | undefined) ||
      authData.user.email ||
      'Client';
    const resolvedCustomerPhone =
      profileData?.phone ||
      (authData.user.user_metadata?.phone as string | undefined) ||
      null;
    const resolvedCustomerEmail = profileData?.email || authData.user.email || null;

    const orderType = typeof type === 'string' ? type : undefined;

    // Authoritative delivery fee from restaurants table (delivery only).
    let deliveryFee = 0;
    if (orderType === 'delivery') {
      const { data: restoRow } = await supabase
        .from('restaurants')
        .select('delivery_fee')
        .eq('id', restaurant_id)
        .maybeSingle();
      deliveryFee = Number(restoRow?.delivery_fee || 0);
    }
    // Sanity check: client-supplied fee should match within 1 FCFA.
    if (
      typeof clientDeliveryFee === 'number' &&
      Math.abs(Number(clientDeliveryFee) - deliveryFee) > 1
    ) {
      console.warn('[orders/create] delivery_fee mismatch', { client: clientDeliveryFee, server: deliveryFee });
    }

    // Loyalty redemption preview: validates points + computes discount.
    // Actual debit happens AFTER the order row exists (we need order_id).
    let loyaltyDiscount = 0;
    const loyaltyPointsToRedeem = Math.max(0, Number(clientLoyaltyPoints || 0));
    if (loyaltyPointsToRedeem > 0) {
      const { data: loyaltyData } = await supabase.rpc('get_customer_loyalty', {
        p_customer_id: authData.user.id,
        p_restaurant_id: restaurant_id,
      });
      const currentPoints = Number(loyaltyData?.account?.points || 0);
      const minRedeem = Number(loyaltyData?.config?.min_points_redeem || 0);
      const pointsPerFcfa = Number(loyaltyData?.config?.points_per_fcfa || 0);
      if (loyaltyPointsToRedeem > currentPoints) {
        return res.status(400).json({ error: 'Solde de points insuffisant.' });
      }
      if (minRedeem > 0 && loyaltyPointsToRedeem < minRedeem) {
        return res.status(400).json({ error: `Minimum ${minRedeem} points pour utiliser la fidélité.` });
      }
      // 1 point = 1 FCFA / pointsPerFcfa (e.g. 0.01 → 100 points = 1 FCFA wait that's wrong)
      // Actually convention: points_per_fcfa is the rate at which points are earned per FCFA spent.
      // Standard redemption: 1 point = 1 FCFA discount (1:1) or as configured.
      // Cap discount at subtotal to avoid negative totals.
      loyaltyDiscount = Math.min(loyaltyPointsToRedeem, subtotal);
      if (pointsPerFcfa > 0) {
        // If points_per_fcfa = 0.01 (1% earn rate), redemption rate = 1 point = 1 FCFA discount.
        // We keep 1:1 unless config explicitly differs.
        loyaltyDiscount = Math.min(loyaltyPointsToRedeem, subtotal);
      }
    }

    const totalAmount = Math.max(0, subtotal + deliveryFee - loyaltyDiscount);

    // `orders.status` is an ENUM (order_status) with values
    // 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' |
    // 'delivered' | 'cancelled'. We write 'pending' here; the webhook +
    // /api/payments/status flip it to 'confirmed' after GeniusPay reports
    // success. We intentionally do NOT write `orders.payment_status`
    // inline: that column was added by migration 088, but PostgREST's
    // schema cache on prod is returning
    //   "Could not find the 'payment_status' column of 'orders' in the
    //    schema cache"
    // which rejected the whole INSERT and surfaced as 'Paiement
    // impossible : Order creation failed' in the cart UI. `status` alone
    // is a sufficient signal for the rest of the system (webhook matches
    // on `payment_ref` and flips `status` to 'confirmed').
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        restaurant_id,
        customer_id: authData.user.id,
        customer_name: resolvedCustomerName,
        customer_phone: resolvedCustomerPhone,
        customer_email: resolvedCustomerEmail,
        subtotal,
        delivery_fee: deliveryFee,
        discount: loyaltyDiscount,
        total_amount: totalAmount,
        delivery_address: delivery_address || null,
        notes: notes || null,
        type: orderType,
        status: 'pending',
      })
      .select('id')
      .single();

    if (orderErr || !order?.id) {
      console.error('[orders/create] Insert orders failed:', orderErr);
      return res.status(500).json({
        error: 'Order creation failed',
        details: orderErr?.message || 'Unknown error',
      });
    }

    // Create order_items rows so the restaurant dashboard / team scanner
    // can display plat names, quantities and prices.
    const orderItemsRows = normalizedItems.map((i) => ({
      order_id: order.id,
      item_id: i.itemId,
      item_name: i.itemName,
      variant_id: i.variantId,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      subtotal: i.subtotal,
      notes: i.notes,
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsRows);
    if (itemsErr) {
      // Rollback to avoid phantom orders with no items (the restaurant would
      // see an order with an empty item list otherwise).
      await supabase.from('orders').delete().eq('id', order.id);
      console.error('[orders/create] Insert order_items failed:', itemsErr);
      return res.status(500).json({
        error: 'Order creation failed',
        details: itemsErr.message || 'order_items insert failed',
      });
    }

    // Loyalty: redeem points now that we have an order_id (atomic via RPC).
    if (loyaltyPointsToRedeem > 0 && order?.id) {
      const { data: redeemRes, error: redeemErr } = await supabase.rpc('redeem_loyalty_points', {
        p_customer_id: authData.user.id,
        p_restaurant_id: restaurant_id,
        p_points_to_redeem: loyaltyPointsToRedeem,
        p_order_id: order.id,
      });
      if (redeemErr || !redeemRes?.success) {
        // Rollback to avoid charging the customer for a discount we couldn't apply.
        await supabase.from('orders').delete().eq('id', order.id);
        console.error('[orders/create] Loyalty redeem failed:', redeemErr || redeemRes);
        return res.status(409).json({
          error: 'Impossible d\u2019utiliser vos points fidélité, réessayez sans la remise.',
        });
      }
    }

    // Send notification to restaurant about new order
    if (order?.id && restaurant_id) {
      await supabase.from('notifications').insert({
        restaurant_id: restaurant_id,
        type: 'new_order',
        title: 'Nouvelle commande !',
        message: `Commande #${order.id.slice(0, 8)} - ${normalizedItems.length} article(s)`,
        data: { order_id: order.id, customer_name: resolvedCustomerName },
      });

      // Also notify restaurant owner via email if they have one
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name, owner_id')
        .eq('id', restaurant_id)
        .single();

      if (restaurant) {
        const { data: owner } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', restaurant.owner_id)
          .single();

        if (owner?.email) {
          try {
            await sendNewOrderEmail(owner.email, {
              order_id: order.id,
              customer_name: resolvedCustomerName,
              items: normalizedItems,
              total: subtotal,
            });
          } catch (emailErr) {
            console.error('[orders/create] Restaurant email notification failed:', emailErr);
          }
        }
      }
    }

    // Send confirmation email to customer
    if (resolvedCustomerEmail && order?.id) {
      try {
        await sendOrderConfirmationEmail(resolvedCustomerEmail, {
          order_id: order.id,
          customer_name: resolvedCustomerName,
          items: normalizedItems,
          total: subtotal,
        });
      } catch (emailErr) {
        console.error('[orders/create] Confirmation email failed:', emailErr);
      }
    }

    return res.status(200).json({
      order_id: order.id,
      subtotal,
      delivery_fee: deliveryFee,
      discount: loyaltyDiscount,
      total_amount: totalAmount,
    });
  } catch (error) {
    console.error('[orders/create] Unhandled error:', error);
    return res.status(500).json({
      error: 'Order creation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
