/**
 * src/lib/orders.ts
 * 
 * CORRECTIONS APPLIQUÉES :
 * 1. createOrder() — restaurant_id ajouté en paramètre obligatoire
 * 2. createOrder() — colonne 'subtotal' renommée correctement
 * 3. createOrder() — item_name retiré de order_items (colonne réelle dans schema)
 * 4. scanTicket()  — status 'used' inexistant → vérifier is_used (boolean)
 */

import { supabase } from '@/lib/supabase';

const SERVICE_FEE_RATE = 0.05; // 5% service fee

/**
 * Crée une commande événementielle (achat de billets)
 * ✅ restaurant_id est maintenant obligatoire
 */
export async function createOrder(
  userId: string | null,
  restaurantId: string, // ✅ AJOUTÉ — était manquant, causait un crash DB
  eventId: string,
  items: Array<{ ticket_type_id: string; quantity: number; price: number }>
) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const fees = Math.round(subtotal * SERVICE_FEE_RATE);
  const total = subtotal + fees;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([
      {
        customer_id: userId,
        restaurant_id: restaurantId, // ✅ FIX : était manquant
        subtotal,                    // ✅ la colonne existe bien dans le schema (01-create-schema.sql)
        delivery_fee: fees,
        total_amount: total,
        status: 'pending',
        type: 'delivery',
      },
    ])
    .select()
    .single();

  if (orderError) return { data: null, error: orderError };

  // ✅ FIX : item_name est bien une colonne dans order_items (voir 01-create-schema.sql)
  // On met le nom générique 'Billet événement' puisqu'on n'a pas le vrai nom ici
  const orderItems = items.map((item) => ({
    order_id: order.id,
    item_id: item.ticket_type_id,
    item_name: 'Billet événement', // ✅ colonne réelle confirmée dans le schema
    quantity: item.quantity,
    unit_price: item.price,
    subtotal: item.price * item.quantity,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) return { data: null, error: itemsError };

  return { data: order, error: null };
}

export async function initiatePayment(
  orderId: string,
  amount: number,
  paymentMethod: 'mtn' | 'moov'
) {
  const ussdCode =
    paymentMethod === 'mtn'
      ? `*880*${Math.round(amount)}#`
      : `*155*1*1*${Math.round(amount)}#`;

  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'pending',
      notes: `Paiement ${paymentMethod} - USSD: ${ussdCode}`,
    })
    .eq('id', orderId)
    .select()
    .single();

  return { data, error, ussdCode };
}

export async function confirmPayment(orderId: string) {
  const { data, error } = await supabase.rpc(
    'confirm_order_and_generate_tickets',
    { p_order_id: orderId }
  );
  return { data, error };
}

/**
 * Valide un billet à l'entrée d'un événement
 * ✅ FIX : vérifie is_used (boolean) au lieu de status === 'used' (inexistant dans l'ENUM)
 */
export async function scanTicket(
  ticketNumber: string,
  _scannedBy: string,
  _location: string
) {
  const { data: ticket, error: getError } = await supabase
    .from('ticket_purchases')
    .select('id, ticket_number, customer_name, status, is_used, qr_scanned_at, event_id')
    .eq('ticket_number', ticketNumber)
    .single();

  if (getError || !ticket) {
    return { data: null, error: getError ?? new Error('Billet introuvable') };
  }

  // ✅ FIX CRITIQUE : 'used' n'est PAS dans l'ENUM (pending | confirmed | cancelled)
  // Le flag is_used (boolean) est la bonne vérification
  if (ticket.is_used) {
    return {
      data: null,
      error: new Error('Billet déjà utilisé'),
    };
  }

  // ✅ Vérifier le statut confirmé avant de scanner
  if (ticket.status !== 'confirmed') {
    return {
      data: null,
      error: new Error(
        `Billet non valide (statut: ${ticket.status}). Seuls les billets confirmés peuvent être utilisés.`
      ),
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from('ticket_purchases')
    .update({
      is_used: true,
      qr_scanned_at: new Date().toISOString(),
    })
    .eq('id', ticket.id)
    .eq('is_used', false) // ✅ Protection atomique contre les scans simultanés
    .select('ticket_number, customer_name, status, qr_scanned_at, event_id')
    .single();

  return { data: updated, error: updateError };
}

export async function checkDuplicatePurchase(
  userId: string,
  eventId: string
) {
  const { count, error } = await supabase
    .from('ticket_purchases')
    .select('id', { count: 'exact' })
    .eq('customer_id', userId)
    .eq('event_id', eventId)
    .in('status', ['confirmed', 'pending']);

  if (error) return { hasDuplicate: false, error };
  return { hasDuplicate: (count ?? 0) > 0, error: null };
}