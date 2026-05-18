// supabase/functions/weekly-report/index.ts
// Rapport hebdomadaire automatique envoyé chaque lundi via WhatsApp
// Déclenché par pg_cron (script 065) ou manuellement
// Variables env :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Normaliser numéro ─────────────────────────────────────────────────────────
function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s()-]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (!p.startsWith('+')) p = '+229' + p;
  return p.replace(/^\+/, '');
}

// ── Envoyer message WhatsApp ───────────────────────────────────────────────────
async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId || !accessToken) return false;

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizePhone(to),
        type: 'text',
        text: { preview_url: false, body: message },
      }),
    },
  );
  return res.ok;
}

// ── Formater les chiffres ─────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

function delta(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? ' (🆕)' : '';
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return ` (+${pct}% ↑)`;
  if (pct < 0) return ` (${pct}% ↓)`;
  return ' (=)';
}

// ── Construire le rapport texte ───────────────────────────────────────────────
function buildReport(
  restaurantName: string,
  curr: {
    orders: number; revenue: number; views: number; menu_clicks: number;
  },
  prev: {
    orders: number; revenue: number; views: number; menu_clicks: number;
  },
): string {
  const weekStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return [
    `📊 *Rapport hebdomadaire Restafy*`,
    `🏪 ${restaurantName}`,
    `📅 Semaine du ${weekStr}`,
    '',
    `📦 *Commandes :* ${curr.orders}${delta(curr.orders, prev.orders)}`,
    `💰 *Revenus :* ${fmt(curr.revenue)} FCFA${delta(curr.revenue, prev.revenue)}`,
    `👁️ *Vues profil :* ${curr.views}${delta(curr.views, prev.views)}`,
    `🍽️ *Clics menu :* ${curr.menu_clicks}${delta(curr.menu_clicks, prev.menu_clicks)}`,
    '',
    `_Semaine précédente : ${prev.orders} cmdes · ${fmt(prev.revenue)} FCFA_`,
    '',
    `Bonne semaine ! 🚀`,
    `restafy.shop`,
  ].join('\n');
}

// ── Handler principal ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Récupérer les restaurants avec rapport activé ET numéro WhatsApp configuré
    const { data: configs } = await supabase
      .from('weekly_report_configs')
      .select('restaurant_id, whatsapp_phone')
      .eq('is_enabled', true)
      .not('whatsapp_phone', 'is', null);

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Aucun restaurant avec rapport activé', sent: 0 }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const results: { restaurant_id: string; success: boolean; error?: string }[] = [];

    for (const config of configs) {
      try {
        // 2. Récupérer les stats via RPC
        const { data: statsData } = await supabase
          .rpc('get_restaurant_weekly_stats', { p_restaurant_id: config.restaurant_id });

        if (!statsData) {
          results.push({ restaurant_id: config.restaurant_id, success: false, error: 'Stats non disponibles' });
          continue;
        }

        // 3. Récupérer le nom du restaurant
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', config.restaurant_id)
          .single();

        const restaurantName = restaurant?.name ?? 'Votre restaurant';

        const curr = statsData.this_week as { orders: number; revenue: number; views: number; menu_clicks: number };
        const prev = statsData.last_week as { orders: number; revenue: number; views: number; menu_clicks: number };

        // 4. Construire et envoyer le rapport
        const message = buildReport(restaurantName, curr, prev);
        const sent = await sendWhatsApp(config.whatsapp_phone, message);

        if (sent) {
          // 5. Mettre à jour la date d'envoi
          await supabase
            .from('weekly_report_configs')
            .update({ last_sent_at: new Date().toISOString() })
            .eq('restaurant_id', config.restaurant_id);
        }

        results.push({ restaurant_id: config.restaurant_id, success: sent });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur';
        results.push({ restaurant_id: config.restaurant_id, success: false, error: msg });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({
        message: `Rapports envoyés : ${successCount}/${configs.length}`,
        results,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});