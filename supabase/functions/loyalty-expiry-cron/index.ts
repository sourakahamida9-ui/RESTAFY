import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.26.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface ExpiryResult {
  expired_count: bigint;
  total_points_expired: number;
}

serve(async (req: Request) => {
  try {
    // Vérifier la clé secrète pour la sécurité
    const authHeader = req.headers.get('authorization');
    const secret = Deno.env.get('LOYALTY_CRON_SECRET');
    
    if (authHeader !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('[v0] Starting loyalty expiry cron job...');

    // 1. Générer les challenges hebdomadaires s'il en manque
    console.log('[v0] Generating weekly challenges...');
    const { data: generatedChallenges, error: challengeError } = await supabase
      .rpc('generate_weekly_challenges');

    if (challengeError) {
      console.error('[v0] Error generating challenges:', challengeError);
    } else {
      console.log('[v0] Weekly challenges generated successfully');
    }

    // 2. Exécuter l'expiration des points (90 jours)
    console.log('[v0] Expiring old points...');
    const { data: expiryResult, error: expiryError } = await supabase
      .rpc('expire_old_points') as { data: ExpiryResult; error: any };

    if (expiryError) {
      console.error('[v0] Error expiring points:', expiryError);
      return new Response(
        JSON.stringify({ success: false, error: expiryError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[v0] Points expired: ${expiryResult?.expired_count} transactions, ${expiryResult?.total_points_expired} total points`);

    // 3. Envoyer des notifications aux clients avec points expirés bientôt
    console.log('[v0] Checking for points expiring soon...');
    
    const threeweeksAgo = new Date();
    threeweeksAgo.setDate(threeweeksAgo.getDate() - 77); // 90 - 14 = 77 days
    
    const { data: soonExpiring, error: soonExpiringError } = await supabase
      .from('loyalty_transactions')
      .select('customer_id, points')
      .eq('type', 'earned')
      .lt('created_at', threeweeksAgo.toISOString())
      .is('redeemed_at', null)
      .neq('customer_id', null);

    if (soonExpiringError) {
      console.error('[v0] Error fetching soon-expiring points:', soonExpiringError);
    } else if (soonExpiring && soonExpiring.length > 0) {
      // Regrouper par customer_id
      const grouped = soonExpiring.reduce((acc: Record<string, number>, t) => {
        acc[t.customer_id] = (acc[t.customer_id] || 0) + t.points;
        return acc;
      }, {});

      // Créer des notifications
      for (const [customerId, points] of Object.entries(grouped)) {
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: customerId,
          type: 'loyalty_points_expiring',
          title: '⚠️ Points en danger!',
          message: `${points} points expirent dans 14 jours. Commandez maintenant!`,
          emoji: '⚠️',
          data: JSON.stringify({ points, expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }),
        });

        if (notifError) {
          console.error(`[v0] Error creating notification for ${customerId}:`, notifError);
        }
      }

      console.log(`[v0] Sent ${Object.keys(grouped).length} expiry notifications`);
    }

    // 4. Mettre à jour le leaderboard mensuel
    console.log('[v0] Updating monthly leaderboard...');
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Récupérer les top clients par restaurant pour le mois
    const { data: topCustomers, error: leaderboardError } = await supabase
      .from('orders')
      .select(
        `
        customer_id,
        restaurant_id,
        profiles(full_name),
        sum(total_amount)
      `,
        { count: 'exact' }
      )
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString())
      .eq('status', 'delivered');

    if (leaderboardError) {
      console.error('[v0] Error fetching leaderboard data:', leaderboardError);
    }

    console.log('[v0] Loyalty cron job completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Loyalty cron job completed',
        results: {
          challengesGenerated: true,
          pointsExpired: expiryResult,
          expiryNotificationsSent: soonExpiring ? Object.keys(soonExpiring).length : 0,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[v0] Cron job error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
