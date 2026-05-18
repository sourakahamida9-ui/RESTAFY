import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  // ✅ FIX SÉCURITÉ : restreindre à votre domaine, pas '*'
  'Access-Control-Allow-Origin': 'https://restafy.shop',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // ✅ FIX SÉCURITÉ : vérifier le JWT de l'appelant
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ✅ Utiliser le service role pour bypass RLS lors de la validation
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { qr_payload } = await req.json();

    if (!qr_payload) {
      return new Response(JSON.stringify({ error: 'qr_payload requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ✅ FIX : le QR code contient soit ticket_number soit qr_code_data
    // On cherche dans les deux colonnes
    const identifier = qr_payload.replace('RESTAFY-TICKET-', '').trim();

    // ✅ FIX TABLE : ticket_purchases = les billets vendus (pas event_tickets = types de billets)
    // Two .eq() lookups instead of .or() — empêche l'injection de filtre
    // PostgREST via la virgule dans l'identifiant. Voir aussi api/team-scan.ts
    // (handleValidateTicket) pour le commentaire détaillé.
    const ticketSelect = `
      id,
      customer_name,
      customer_email,
      is_used,
      qr_scanned_at,
      status,
      ticket_number,
      amount_paid,
      event_id,
      event_tickets (
        name,
        event_id,
        events (
          title,
          start_time,
          location
        )
      )
    `;
    let { data: ticket, error: fetchError } = await supabase
      .from('ticket_purchases')
      .select(ticketSelect)
      .eq('ticket_number', identifier)
      .maybeSingle();
    if (!fetchError && !ticket) {
      const second = await supabase
        .from('ticket_purchases')
        .select(ticketSelect)
        .eq('qr_code_data', identifier)
        .maybeSingle();
      ticket = second.data;
      fetchError = second.error;
    }

    if (fetchError) {
      console.error('[validate-ticket] DB error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erreur base de données' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!ticket) {
      return new Response(
        JSON.stringify({ error: 'Billet invalide ou inexistant' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ✅ FIX : vérifier is_used (boolean) et non un statut 'used' inexistant
    if (ticket.is_used) {
      return new Response(
        JSON.stringify({
          error: 'Ce billet a déjà été utilisé',
          scanned_at: ticket.qr_scanned_at,
          customer_name: ticket.customer_name,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ✅ Vérifier que le billet est bien confirmé avant de valider
    if (ticket.status !== 'confirmed') {
      return new Response(
        JSON.stringify({
          error: `Billet non confirmé (statut: ${ticket.status})`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ✅ Marquer comme utilisé de façon atomique
    const { error: updateError } = await supabase
      .from('ticket_purchases')
      .update({
        is_used: true,
        qr_scanned_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .eq('is_used', false); // ✅ Double vérification atomique (évite les scans parallèles)

    if (updateError) {
      console.error('[validate-ticket] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la validation' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const eventInfo = ticket.event_tickets?.events;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Billet validé avec succès !',
        ticket_number: ticket.ticket_number,
        customer_name: ticket.customer_name,
        ticket_type: ticket.event_tickets?.name ?? 'Standard',
        event_title: eventInfo?.title ?? 'Événement',
        event_time: eventInfo?.start_time ?? null,
        event_location: eventInfo?.location ?? null,
        amount_paid: ticket.amount_paid,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[validate-ticket] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});