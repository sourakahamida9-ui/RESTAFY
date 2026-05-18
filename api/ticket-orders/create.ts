/**
 * API Vercel Serverless - Création d'ordre de billets
 * Converti depuis Next.js vers Vercel serverless
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

function getEnv() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

function getClients() {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceKey } = getEnv();
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error(
      'Configuration serveur incomplète (SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY requis).'
    );
  }
  return {
    supabase: createClient(supabaseUrl, supabaseAnonKey),
    supabaseAdmin: createClient(supabaseUrl, supabaseServiceKey),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const {
      event_id,
      ticket_type_id,
      quantity,
      customer_name,
      customer_email,
      customer_phone,
      user_id,
    } = body;

    // Validation
    if (!event_id || !ticket_type_id || !quantity || !customer_name) {
      return res.status(400).json({
        error: 'Missing required fields: event_id, ticket_type_id, quantity, customer_name'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const { supabase, supabaseAdmin } = getClients();

    // Get ticket type details
    const { data: ticketType, error: ticketTypeError } = await supabase
      .from('event_tickets')
      .select('*')
      .eq('id', ticket_type_id)
      .eq('event_id', event_id)
      .single();

    if (ticketTypeError || !ticketType) {
      return res.status(404).json({ error: 'Ticket type not found' });
    }

    // Check availability
    if (ticketType.quantity_available < ticketType.quantity_sold + quantity) {
      return res.status(400).json({ error: 'Not enough tickets available' });
    }

    // Calculate total
    const unit_price = ticketType.price;
    const total_amount = unit_price * quantity;

    // Generate payment reference
    const payment_reference = `TKT-${Date.now()}-${randomUUID().slice(0, 8)}`;

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('ticket_orders')
      .insert({
        event_id,
        customer_id: user_id || null,
        customer_name,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        ticket_type_id,
        quantity,
        unit_price,
        total_amount,
        status: 'pending',
        payment_reference,
      })
      .select()
      .single();

    if (orderError) {
      console.error('[Ticket Orders] Order creation error:', orderError);
      return res.status(500).json({ error: 'Failed to create order' });
    }

    return res.status(200).json({
      order_id: order.id,
      payment_reference: order.payment_reference,
      total_amount: order.total_amount,
      status: order.status,
    });

  } catch (err: any) {
    console.error('[Ticket Orders] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
