import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { authorization } = request.headers;
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FIX CRITIQUE : Vérification de signature JWT via Supabase Auth
    // Avant : JSON.parse(Buffer.from(token, 'base64url')) → aucune vérification de signature
    // Après : supabaseAdmin.auth.getUser(token) → validation cryptographique complète
    const token = authorization.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 });
    }

    const body = await request.json();
    const { reservation_token, user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'User required' }, { status: 401 });
    }

    // Vérification que l'utilisateur du JWT correspond au user_id du body
    if (user.id !== user_id) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    // Décodage du reservation_token (token de réservation, distinct du JWT auth)
    if (!reservation_token) {
      return NextResponse.json({ error: 'Reservation token required' }, { status: 400 });
    }

    let parsed: { reservation_ids: string[]; event_id: string; ts: number };
    try {
      parsed = JSON.parse(Buffer.from(reservation_token, 'base64url').toString());
    } catch {
      return NextResponse.json({ error: 'Invalid reservation token' }, { status: 400 });
    }

    if (Date.now() - parsed.ts > 15 * 60 * 1000) {
      return NextResponse.json({ error: 'Reservation token expired' }, { status: 400 });
    }

    const { data: hasDuplicate, error: dupError } = await supabaseAdmin.rpc(
      'check_duplicate_purchase',
      {
        p_user_id: user_id,
        p_event_id: parsed.event_id,
      }
    );

    if (dupError || hasDuplicate) {
      return NextResponse.json({ error: 'Already purchased' }, { status: 400 });
    }

    const { data: reservations, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .in('id', parsed.reservation_ids)
      .eq('status', 'active');

    if (resError || !reservations || reservations.length === 0) {
      return NextResponse.json({ error: 'Invalid reservations' }, { status: 400 });
    }

    const total = reservations.reduce((sum: number, r: any) => sum + r.price, 0);

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([
        {
          user_id,
          event_id: parsed.event_id,
          total,
          payment_status: 'pending',
        },
      ])
      .select()
      .single();

    // FIX MOYEN : message d'erreur générique (ne pas exposer les détails Supabase au client)
    if (orderError) {
      console.error('Order insert error:', orderError);
      return NextResponse.json({ error: 'Erreur création commande' }, { status: 500 });
    }

    // FIX FAIBLE : vérification de l'erreur sur la MAJ des réservations
    // Avant : await sans vérification → échec silencieux possible
    // Après : erreur loggée (la commande est déjà créée, on ne bloque pas la réponse)
    const { error: updateResError } = await supabaseAdmin
      .from('reservations')
      .update({ status: 'converted' })
      .in('id', parsed.reservation_ids);

    if (updateResError) {
      console.error('Reservation update error (order already created):', updateResError);
    }

    return NextResponse.json({
      order_id: order.id,
      order_number: order.order_number || `ORD-${order.id.slice(0, 8)}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}