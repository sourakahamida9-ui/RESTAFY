import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticket_type_id, quantity, user_id, session_id } = body;

    if (!ticket_type_id || !quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: reservations, error } = await supabaseAdmin.rpc('reserve_tickets', {
      p_ticket_type_id: ticket_type_id,
      p_quantity: quantity,
      p_user_id: user_id || null,
      p_session_id: session_id || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const token = Buffer.from(
      JSON.stringify({
        reservation_ids: reservations.map((r: any) => r.id),
        event_id: reservations[0]?.event_id,
        ts: Date.now(),
      })
    ).toString('base64url');

    return NextResponse.json({
      reservation_token: token,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      reservation_count: reservations.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
