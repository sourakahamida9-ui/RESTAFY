/**
 * Kkiapay Payment Verification Endpoint
 *
 * POST /api/payments/verify
 *
 * After the Kkiapay widget returns a transactionId to the frontend,
 * this endpoint verifies the transaction server-side using the Kkiapay
 * Node.js Admin SDK, then confirms the order/ticket in the database.
 *
 * Required env vars:
 *   KKIAPAY_PUBLIC_KEY
 *   KKIAPAY_PRIVATE_KEY
 *   KKIAPAY_SECRET_KEY
 *   KKIAPAY_SANDBOX=true|false (optional, defaults to false)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyCors } from '../_shared/cors';

const APP_URL = process.env.APP_URL || 'https://app.restafy.shop';


function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAuthenticatedUser(req: VercelRequest): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }
  const accessToken = authHeader.slice(7);
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await (supabase.auth as any).getUser(accessToken);
    if (error || !data?.user?.id) {
      return { error: 'Invalid token', status: 401 };
    }
    return { userId: data.user.id };
  } catch (err) {
    console.error('[Kkiapay] Auth check failed:', err);
    return { error: 'Authentication check failed', status: 500 };
  }
}

function getKkiapayKeys() {
  const publicKey = process.env.KKIAPAY_PUBLIC_KEY || '';
  const privateKey = process.env.KKIAPAY_PRIVATE_KEY || '';
  const secretKey = process.env.KKIAPAY_SECRET_KEY || '';
  if (!publicKey || !privateKey || !secretKey) return null;
  return { publicKey, privateKey, secretKey };
}

/**
 * Verify a Kkiapay transaction using the REST API.
 * Uses the same endpoint as the Node.js SDK internally:
 *   GET https://api.kkiapay.me/api/v1/transactions/status
 *   Headers: X-API-KEY, X-PRIVATE-KEY, X-SECRET-KEY
 */
async function verifyKkiapayTransaction(
  transactionId: string,
  keys: { publicKey: string; privateKey: string; secretKey: string },
  sandbox: boolean,
) {
  const baseUrl = sandbox
    ? 'https://api-sandbox.kkiapay.me'
    : 'https://api.kkiapay.me';

  const response = await fetch(`${baseUrl}/api/v1/transactions/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': keys.publicKey,
      'X-PRIVATE-KEY': keys.privateKey,
      'X-SECRET-KEY': keys.secretKey,
    },
    body: JSON.stringify({ transactionId }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Kkiapay] Verify API error:', { status: response.status, body: text.substring(0, 500) });
    throw new Error(`Kkiapay verification failed: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Confirm payment in database: update orders, ticket_purchases, payments tables.
 * Uses the existing confirm_payment RPC when available, with fallbacks.
 */
async function confirmPaymentInDatabase(
  transactionId: string,
  transactionData: {
    amount: number;
    fees: number;
    status: string;
    source: string;
    client?: { fullname?: string; phone?: string; email?: string };
  },
  metadata: {
    order_id?: string;
    restaurant_id?: string;
    ticket_purchase_id?: string;
    ticket_order_id?: string;
  },
) {
  const supabase = getSupabaseAdmin();
  const reference = transactionId;

  // Resolve IDs from metadata or by looking up by reference
  let orderId = metadata.order_id || null;
  let ticketPurchaseId = metadata.ticket_purchase_id || null;
  let ticketOrderId = metadata.ticket_order_id || null;
  let restaurantId = metadata.restaurant_id || null;

  // Fallback: find order by payment_ref
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

  // Fallback: find ticket_purchase by payment_ref
  if (!ticketPurchaseId && reference) {
    const { data: ticketRow } = await supabase
      .from('ticket_purchases')
      .select('id')
      .eq('payment_ref', reference)
      .eq('status', 'pending')
      .maybeSingle();
    if (ticketRow) {
      ticketPurchaseId = ticketRow.id;
    }
  }

  // Try the existing confirm_payment RPC first
  const rpcArgs = {
    p_reference: reference,
    p_amount: transactionData.amount,
    p_currency: 'XOF',
    p_provider_response: transactionData,
    p_order_id: orderId,
    p_ticket_purchase_id: ticketPurchaseId,
    p_ticket_order_id: ticketOrderId,
    p_restaurant_id: restaurantId,
  };

  const { error: rpcError } = await supabase.rpc('confirm_payment', rpcArgs);

  if (rpcError) {
    console.warn('[Kkiapay] confirm_payment RPC error, using fallback:', rpcError.message);

    // Fallback: update tables directly
    if (orderId) {
      await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          payment_ref: reference,
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
    }

    if (ticketPurchaseId) {
      await supabase
        .from('ticket_purchases')
        .update({
          status: 'confirmed',
          payment_ref: reference,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketPurchaseId);
    }

    if (ticketOrderId) {
      await supabase
        .from('ticket_orders')
        .update({
          status: 'confirmed',
          payment_ref: reference,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketOrderId);
    }

    // Upsert payment record
    await supabase.from('payments').upsert(
      {
        transaction_ref: reference,
        amount: transactionData.amount,
        currency: 'XOF',
        status: 'confirmed',
        provider: 'kkiapay',
        provider_response: transactionData,
        order_id: orderId,
        ticket_purchase_id: ticketPurchaseId,
        restaurant_id: restaurantId,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'transaction_ref' },
    );
  }

  // Credit restaurant balance — with double-credit guard.
  // Check if a transaction with this reference was already recorded to avoid
  // crediting the restaurant twice (e.g. when verify + webhook both fire).
  if (restaurantId && transactionData.amount > 0) {
    const grossAmount = transactionData.amount;
    const fees = transactionData.fees || 0;
    const netAmount = grossAmount - fees;

    if (netAmount > 0) {
      const { data: existingTx } = await supabase
        .from('restaurant_transactions')
        .select('id')
        .eq('reference', reference)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (existingTx) {
        console.log('[Kkiapay] Balance already credited for:', reference);
      } else {
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

          await supabase.from('restaurant_transactions').insert({
            restaurant_id: restaurantId,
            type: 'payment_received',
            amount: netAmount,
            currency: 'XOF',
            reference,
            description: `Paiement Kkiapay confirmé — brut: ${grossAmount}, frais: ${fees}`,
            metadata: { gross_amount: grossAmount, fees, source: 'kkiapay', transaction_id: transactionId },
          });
        }
      }
    }
  }

  return { orderId, ticketPurchaseId, ticketOrderId };
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate user
  const authResult = await requireAuthenticatedUser(req);
  if ('error' in authResult) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  const { transaction_id, order_id, restaurant_id, ticket_purchase_id, ticket_order_id } = req.body || {};

  if (!transaction_id) {
    return res.status(400).json({ error: 'transaction_id is required' });
  }

  // Get Kkiapay keys
  const keys = getKkiapayKeys();
  if (!keys) {
    console.error('[Kkiapay] Missing API keys');
    return res.status(500).json({
      error: 'Le service de paiement n\'est pas configuré. Contactez le support.',
    });
  }

  const sandbox = process.env.KKIAPAY_SANDBOX === 'true';
  const supabase = getSupabaseAdmin();

  try {
    // Step 0: Idempotency — if this transaction was already confirmed, return
    // the cached result immediately. Prevents double balance credits when the
    // frontend retries or the network replays the call.
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status, order_id, ticket_purchase_id, amount')
      .eq('transaction_ref', transaction_id)
      .maybeSingle();

    if (existingPayment?.status === 'confirmed') {
      console.log('[Kkiapay] Transaction already confirmed (idempotent):', transaction_id);
      return res.status(200).json({
        success: true,
        transactionId: transaction_id,
        status: 'confirmed',
        amount: existingPayment.amount,
        orderId: existingPayment.order_id,
        idempotent: true,
      });
    }

    // Step 1: Verify transaction with Kkiapay
    console.log('[Kkiapay] Verifying transaction:', transaction_id);
    const txData = await verifyKkiapayTransaction(transaction_id, keys, sandbox);
    console.log('[Kkiapay] Transaction data:', JSON.stringify(txData).substring(0, 500));

    // Check transaction status
    const status = String(txData.status || '').toUpperCase();
    if (status !== 'SUCCESS') {
      console.warn('[Kkiapay] Transaction not successful:', status);
      return res.status(400).json({
        success: false,
        error: `Paiement non confirmé. Statut: ${status}`,
        status: txData.status,
        failureCode: txData.failureCode,
        failureMessage: txData.failureMessage,
      });
    }

    // Step 1b: Amount verification — ensure the amount paid matches the
    // expected order/ticket amount to prevent underpayment attacks.
    const paidAmount = Number(txData.amount || 0);
    if (order_id) {
      const { data: orderRow } = await supabase
        .from('orders')
        .select('total')
        .eq('id', order_id)
        .maybeSingle();
      if (orderRow && orderRow.total > 0 && paidAmount < orderRow.total) {
        console.error('[Kkiapay] Amount mismatch:', { paid: paidAmount, expected: orderRow.total, order_id });
        return res.status(400).json({
          success: false,
          error: `Montant payé (${paidAmount} FCFA) inférieur au montant attendu (${orderRow.total} FCFA).`,
        });
      }
    }
    if (ticket_purchase_id) {
      const { data: ticketRow } = await supabase
        .from('ticket_purchases')
        .select('total_price')
        .eq('id', ticket_purchase_id)
        .maybeSingle();
      if (ticketRow && ticketRow.total_price > 0 && paidAmount < ticketRow.total_price) {
        console.error('[Kkiapay] Amount mismatch:', { paid: paidAmount, expected: ticketRow.total_price, ticket_purchase_id });
        return res.status(400).json({
          success: false,
          error: `Montant payé (${paidAmount} FCFA) inférieur au montant attendu (${ticketRow.total_price} FCFA).`,
        });
      }
    }

    // Step 2: Confirm in database
    const confirmed = await confirmPaymentInDatabase(
      transaction_id,
      {
        amount: paidAmount,
        fees: txData.fees || 0,
        status: txData.status,
        source: txData.source || 'MOBILE_MONEY',
        client: txData.client,
      },
      { order_id, restaurant_id, ticket_purchase_id, ticket_order_id },
    );

    console.log('[Kkiapay] Payment confirmed:', {
      transactionId: transaction_id,
      amount: paidAmount,
      orderId: confirmed.orderId,
    });

    return res.status(200).json({
      success: true,
      transactionId: transaction_id,
      status: 'confirmed',
      amount: paidAmount,
      fees: txData.fees,
      source: txData.source,
      orderId: confirmed.orderId,
    });

  } catch (err) {
    console.error('[Kkiapay] Verification error:', err);
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
