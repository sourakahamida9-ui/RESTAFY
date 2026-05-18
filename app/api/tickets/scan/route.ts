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

    const body = await request.json();
    const { ticket_number, scanned_by, location } = body;

    if (!ticket_number || !scanned_by || !location) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify role
    const token = authorization.slice(7);
    const { data: user, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid auth' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single();

    if (!profile || !['organizer', 'admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: ticket, error: getError } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('ticket_number', ticket_number)
      .single();

    if (getError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.status === 'used') {
      return NextResponse.json({ error: 'Ticket already used' }, { status: 400 });
    }

    if (ticket.status !== 'confirmed') {
      return NextResponse.json({ error: 'Invalid ticket status' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({
        status: 'used',
        scanned_at: new Date().toISOString(),
        scanned_by,
        scan_location: location,
      })
      .eq('id', ticket.id)
      .select('ticket_number, holder_name, status, scanned_at')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, name')
      .eq('id', ticket.event_id)
      .single();

    const { data: ticketType } = await supabaseAdmin
      .from('ticket_types')
      .select('id, name')
      .eq('id', ticket.ticket_type_id)
      .single();

    return NextResponse.json({
      ticket_number: updated.ticket_number,
      holder_name: updated.holder_name,
      status: updated.status,
      scanned_at: updated.scanned_at,
      event: event || {},
      ticket_type: ticketType || {},
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}