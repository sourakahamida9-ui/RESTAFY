import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;

    // FIX CRITIQUE : CRON_SECRET obligatoire — si absent, l'endpoint est non configuré
    // Avant : if (cronSecret) { ... } → la vérification était ignorée si la variable était absente
    // Après : on bloque systématiquement si CRON_SECRET n'est pas défini
    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json({ error: 'Endpoint non configuré' }, { status: 500 });
    }

    const { authorization } = request.headers;
    if (authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: cleanupData, error: cleanupError } = await supabaseAdmin.rpc(
      'cleanup_expired_reservations'
    );

    if (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    const { data: soldoutData, error: soldoutError } = await supabaseAdmin.rpc(
      'update_soldout_events'
    );

    if (soldoutError) {
      console.error('Soldout update error:', soldoutError);
    }

    // FIX MOYEN : propager les erreurs au lieu de retourner toujours success: true
    // Avant : return { success: true } même en cas d'erreur → échec masqué
    // Après : retour 500 avec détail si une des deux RPC a échoué
    if (cleanupError || soldoutError) {
      return NextResponse.json(
        {
          success: false,
          error: cleanupError?.message || soldoutError?.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cleaned: cleanupData,
      updated: soldoutData,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}