/**
 * Cron Vercel unifié : nettoyage réservations + rappels commandes + réconciliation paiements + rapports hebdomadaires.
 * Config : vercel.json → path /api/cron
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin';
import { withRetry } from '../_shared/withRetry';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const GENIUSPAY_BASE_URL = process.env.GENIUSPAY_BASE_URL || 'https://pay.genius.ci/api/v1/merchant';

function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function buildReminderEmail(params: {
  restaurantName: string;
  orderNumber: string;
  totalAmount: number;
  createdAt: string;
  dashboardUrl: string;
}) {
  const createdAt = new Date(params.createdAt).toLocaleString('fr-FR');
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #eee;padding:24px">
      <h2 style="margin:0 0 12px;color:#111">Commande en attente de confirmation</h2>
      <p style="margin:0 0 14px;color:#333">
        Vous avez une commande qui attend votre validation depuis plus d'une minute.
      </p>
      <p style="margin:0 0 14px;color:#333">
        <strong>Restaurant:</strong> ${params.restaurantName}<br/>
        <strong>Commande:</strong> #${params.orderNumber}<br/>
        <strong>Montant:</strong> ${params.totalAmount.toLocaleString('fr-FR')} FCFA<br/>
        <strong>Reçue le:</strong> ${createdAt}
      </p>
      <a href="${params.dashboardUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">
        Ouvrir le dashboard commandes
      </a>
      <p style="font-size:12px;color:#777;margin-top:16px">Restafy Notifications</p>
    </div>
  `;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn('[CRON] RESEND_API_KEY not configured - skipping email');
    return false;
  }
  
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Restafy <noreply@app.restafy.shop>',
        to: [to],
        subject,
        html,
      }),
    });
    
    if (!resp.ok) {
      const error = await resp.text().catch(() => 'unknown');
      console.error('[CRON] Email failed:', resp.status, error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[CRON] Email error:', err instanceof Error ? err.message : err);
    return false;
  }
}

// NOTE: Supabase v2 infers `never` for un-generic-typed queries, which
// propagates into `.map(o => o.id)` and breaks strict type-checking. Until we
// wire in a generated `Database` type (see audit §3.2), these helpers take a
// loosely typed client. Runtime behaviour is unchanged.
async function runCleanup(supabase: any) {
  const { data: cleanupData, error: cleanupError } = await supabase.rpc('cleanup_expired_reservations');
  const { data: soldoutData, error: soldoutError } = await supabase.rpc('update_soldout_events');
  // Purge des events de rate-limit > 24h. Best-effort : si la RPC n'existe
  // pas encore (script 100 pas exécuté), on n'échoue pas le cron complet.
  let purged: number | null = null;
  try {
    const { data: purgedData, error: purgeError } = await supabase.rpc('purge_old_rate_limit_events');
    if (purgeError) {
      console.warn('[cron/cleanup] purge_old_rate_limit_events failed:', purgeError.message);
    } else {
      purged = typeof purgedData === 'number' ? purgedData : null;
    }
  } catch (err) {
    console.warn('[cron/cleanup] purge_old_rate_limit_events threw:', err);
  }
  if (cleanupError || soldoutError) throw new Error(cleanupError?.message || soldoutError?.message);
  return { cleaned: cleanupData, updated: soldoutData, rateLimitPurged: purged };
}

async function runReminders(supabase: any, appUrl: string) {
  const cutoffIso = new Date(Date.now() - 60_000).toISOString();
  const { data: pendingOrders, error } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, created_at, restaurant_id, status')
    .eq('status', 'pending')
    .lte('created_at', cutoffIso)
    .limit(100);

  if (error) throw error;
  if (!pendingOrders || pendingOrders.length === 0) return { scanned: 0, notified: 0 };

  const orderIds = pendingOrders.map((o) => o.id);
  const { data: alreadySent } = await supabase
    .from('order_confirmation_reminder_logs')
    .select('order_id')
    .in('order_id', orderIds);
  const sentSet = new Set((alreadySent || []).map((x) => x.order_id));

  const restaurantIds = Array.from(new Set(pendingOrders.map((o) => o.restaurant_id).filter(Boolean)));
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name, owner_id')
    .in('id', restaurantIds);
  const restMap = new Map((restaurants || []).map((r) => [r.id, r]));
  const owners = (restaurants || []).map((r) => r.owner_id).filter(Boolean) as string[];

  const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('id', owners);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  let notified = 0;
  for (const order of pendingOrders) {
    if (sentSet.has(order.id)) continue;
    const rest = restMap.get(order.restaurant_id) as any;
    const owner = rest?.owner_id ? profileMap.get(rest.owner_id) as any : undefined;
    if (!rest || !owner?.email) continue;

    const html = buildReminderEmail({
      restaurantName: rest.name || 'Restaurant',
      orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
      totalAmount: Number(order.total_amount || 0),
      createdAt: order.created_at,
      dashboardUrl: `${appUrl}/admin/orders`,
    });

    const ok = await sendEmail(
      owner.email,
      `Action requise: commande #${order.order_number || order.id.slice(0, 8)} en attente`,
      html,
    );
    if (!ok) continue;

    notified += 1;
    await supabase.from('order_confirmation_reminder_logs').insert({
      order_id: order.id,
      restaurant_id: order.restaurant_id,
      reminded_at: new Date().toISOString(),
    });
  }

  return { scanned: pendingOrders.length, notified };
}

/**
 * Réconciliation paiements: filet de sécurité si le webhook GeniusPay n'arrive
 * pas (réseau, signature mismatch, dashboard pas configuré, etc.).
 *
 * Schedule actuel: DAILY à 02:30 UTC (cf. vercel.json). Limitation plan
 * Vercel Hobby (daily min). Côté code on reste compatible avec une
 * fréquence plus élevée (cutoff 90s, limite 100 rows/run) pour que le
 * passage en plan Pro + schedule "star-slash-5 * * * *" (toutes les 5 min)
 * ou similaire se fasse sans changement de code — il suffit de mettre à
 * jour vercel.json.
 *
 * Tant qu'on reste en daily, le filet côté client (polling PaymentSuccess)
 * reste le 1er recours pour les users qui ne ferment pas l'onglet, et ce
 * cron attrape tout ce qui aurait glissé entre les mailles pendant la
 * journée écoulée (webhook raté + onglet fermé).
 *
 * Stratégie:
 *   1. On liste les commandes + billets en status='pending' qui ont un
 *      payment_ref (donc une tentative de paiement a eu lieu) et qui datent
 *      de plus de 90 secondes.
 *   2. Pour chaque référence, on interroge GeniusPay `GET /payments/{ref}`.
 *   3. Si le statut upstream mappe sur 'completed', on appelle la RPC
 *      `confirm_payment` (atomique, migration 094) — même chemin que le
 *      webhook, donc guarded-update + notifications = pas de doublon.
 *   4. Si 'failed'/'cancelled'/'expired', on reflète le statut dans la DB.
 *
 * On borne à 100 enregistrements par run pour rester dans les 10 s de
 * Vercel Hobby. À fort trafic, remonter la fréquence ou augmenter le plan.
 */
function mapGeniusPayStatus(raw: any): 'completed' | 'pending' | 'failed' | 'cancelled' {
  const s = String(raw || '').toLowerCase();
  if (s === 'completed' || s === 'success' || s === 'successful' || s === 'paid' || s === 'confirmed') return 'completed';
  if (s === 'failed' || s === 'error' || s === 'declined' || s === 'rejected') return 'failed';
  if (s === 'cancelled' || s === 'canceled' || s === 'expired' || s === 'timeout' || s === 'refunded') return 'cancelled';
  return 'pending';
}

function getGeniusPayKeys(): { publicKey: string; secretKey: string } | null {
  const publicKey = process.env.GENIUSPAY_PUBLIC_KEY || process.env.GENIUSPAY_API_KEY || '';
  const secretKey = process.env.GENIUSPAY_SECRET_KEY || '';
  if (!publicKey || !secretKey) return null;
  return { publicKey, secretKey };
}

type ReconcileItem = {
  kind: 'order' | 'ticket_purchase';
  id: string;
  payment_ref: string;
  restaurant_id: string | null;
};

async function runReconcilePayments(supabase: any) {
  const keys = getGeniusPayKeys();
  if (!keys) {
    // Mode Kkiapay-only : la réconciliation upstream GP est sautée. Les
    // webhooks Kkiapay (transaction.success / transaction.failed) sont
    // désormais la source de vérité pour confirmer une ligne en DB.
    // Un pending > 90 s sans webhook signalera un problème à investiguer
    // manuellement (dashboard Kkiapay ou logs Vercel).
    return {
      skipped: true,
      reason: 'Kkiapay-only mode — upstream reconciliation not needed (webhook is source of truth)',
    };
  }

  const cutoff = new Date(Date.now() - 90_000).toISOString();

  // Collect items to check (orders + ticket_purchases).
  const { data: pendingOrders } = await supabase
    .from('orders')
    .select('id, payment_ref, restaurant_id')
    .eq('status', 'pending')
    .not('payment_ref', 'is', null)
    .lt('created_at', cutoff)
    .limit(60);

  const { data: pendingTickets } = await supabase
    .from('ticket_purchases')
    .select('id, payment_ref')
    .eq('status', 'pending')
    .not('payment_ref', 'is', null)
    .lt('created_at', cutoff)
    .limit(40);

  const items: ReconcileItem[] = [
    ...((pendingOrders as any[]) || []).map((o) => ({
      kind: 'order' as const,
      id: o.id as string,
      payment_ref: o.payment_ref as string,
      restaurant_id: (o.restaurant_id as string | null) ?? null,
    })),
    ...((pendingTickets as any[]) || []).map((t) => ({
      kind: 'ticket_purchase' as const,
      id: t.id as string,
      payment_ref: t.payment_ref as string,
      restaurant_id: null,
    })),
  ];

  // Dedup par payment_ref (une même ref peut couvrir à la fois order et
  // ticket_purchase via metadata — on garde les deux items, mais on ne fait
  // qu'un appel upstream par ref).
  const byRef = new Map<string, ReconcileItem[]>();
  for (const it of items) {
    const arr = byRef.get(it.payment_ref) || [];
    arr.push(it);
    byRef.set(it.payment_ref, arr);
  }

  let confirmed = 0;
  let failed = 0;
  let stillPending = 0;
  let errors = 0;

  for (const [ref, group] of byRef.entries()) {
    try {
      const upstream = await withRetry(
        () =>
          fetch(`${GENIUSPAY_BASE_URL}/payments/${encodeURIComponent(ref)}`, {
            method: 'GET',
            headers: {
              'X-API-Key': keys.publicKey,
              'X-API-Secret': keys.secretKey,
              Accept: 'application/json',
              'User-Agent': 'Restafy-Cron/1.0',
            },
          }),
        { attempts: 2, label: 'reconcile GET payment' },
      );

      if (!upstream.ok) {
        // 404 = GeniusPay ne connaît pas la ref (sandbox typique) → skip
        if (upstream.status === 404) { stillPending += 1; continue; }
        errors += 1; continue;
      }

      const data: any = await upstream.json().catch(() => null);
      const payment = data?.data?.payment ?? data?.data ?? data;
      const status = mapGeniusPayStatus(payment?.status);

      if (status === 'completed') {
        // Un seul appel RPC suffit; la RPC met à jour toutes les tables liées.
        // On passe les ids connus pour que la RPC puisse guarded-update chaque
        // table cible.
        const orderItem = group.find((g) => g.kind === 'order') ?? null;
        const ticketItem = group.find((g) => g.kind === 'ticket_purchase') ?? null;

        const { error: rpcError } = await supabase.rpc('confirm_payment', {
          p_reference: ref,
          p_amount: Number(payment?.amount ?? 0),
          p_currency: String(payment?.currency ?? 'XOF'),
          p_provider_response: payment ?? {},
          p_order_id: orderItem?.id ?? null,
          p_ticket_purchase_id: ticketItem?.id ?? null,
          p_ticket_order_id: null,
          p_restaurant_id: orderItem?.restaurant_id ?? null,
        });

        if (rpcError) {
          console.error('[cron reconcile] confirm_payment RPC failed:', rpcError);
          errors += 1;
        } else {
          confirmed += 1;
        }
      } else if (status === 'failed' || status === 'cancelled') {
        // On reflète l'échec côté DB. On tente 'payment_failed' d'abord (ENUM
        // étendu par migration 094), avec fallback 'cancelled' si le schema
        // cache n'a pas encore rechargé.
        const orderItem = group.find((g) => g.kind === 'order');
        if (orderItem) {
          const up1 = await supabase
            .from('orders')
            .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
            .eq('id', orderItem.id)
            .eq('status', 'pending');
          if (up1.error && (up1.error.code === '22P02' || /invalid input value for enum/i.test(String(up1.error.message)))) {
            await supabase
              .from('orders')
              .update({ status: 'cancelled', updated_at: new Date().toISOString() })
              .eq('id', orderItem.id)
              .eq('status', 'pending');
          }
        }
        const ticketItem = group.find((g) => g.kind === 'ticket_purchase');
        if (ticketItem) {
          await supabase
            .from('ticket_purchases')
            .update({ status: 'cancelled' })
            .eq('id', ticketItem.id)
            .eq('status', 'pending');
        }
        failed += 1;
      } else {
        stillPending += 1;
      }
    } catch (err) {
      console.error('[cron reconcile] error for ref', ref, err);
      errors += 1;
    }
  }

  return {
    skipped: false,
    scanned: items.length,
    unique_refs: byRef.size,
    confirmed,
    failed,
    stillPending,
    errors,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET manquant' });
  }

  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return res.status(500).json({ error: 'Supabase non configuré' });
  }
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://app.restafy.shop';
  const job = String(req.query.job || 'all');

  try {
    const results: Record<string, unknown> = {};

    if (job === 'all' || job === 'cleanup') {
      results.cleanup = await runCleanup(supabase);
      // Purge payment_attempts > 14j et webhook_events > 30j (fonction créée
      // par la migration 094). Silencieux si la fonction n'existe pas encore.
      try {
        const { data: deleted } = await supabase.rpc('cleanup_payment_attempts');
        results.payment_attempts_purged = deleted ?? 0;
      } catch (err) {
        console.warn('[cron cleanup] cleanup_payment_attempts not available yet');
      }
    }
    if (job === 'all' || job === 'reminders') {
      results.reminders = await runReminders(supabase, appUrl);
    }
    if (job === 'all' || job === 'reconcile_payments') {
      results.reconcile_payments = await runReconcilePayments(supabase);
    }
    if (job === 'all' || job === 'archive_notifications') {
      // Archive les notifications > 30 jours pour garder le centre rapide
      // côté restaurateurs. La fonction est idempotente — silencieuse si
      // la migration 099 n'a pas encore tourné.
      try {
        const { data: archived, error: archiveErr } = await supabase.rpc(
          'archive_old_notifications',
          { days_old: 30 },
        );
        if (archiveErr) {
          console.warn('[cron archive_notifications] RPC error:', archiveErr.message);
          results.notifications_archived = 0;
        } else {
          results.notifications_archived = archived ?? 0;
        }
      } catch (err) {
        console.warn('[cron archive_notifications] archive_old_notifications not available yet');
        results.notifications_archived = 0;
      }
    }
    if (job === 'all' || job === 'weekly_report') {
      results.weekly_report = await runWeeklyReport(supabase, appUrl);
    }
// =====================================================================
    // RAPPORT HEBDOMADAIRE - Statistiques & plan du restaurant
    // =====================================================================
    
    /**
     * Envoie un email de rapport hebdomadaire à chaque restaurateur.
     * Contient: CA, nombre commandes, plats populaires, suggestions IA.
     */
    async function runWeeklyReport(supabase: any, appUrl: string) {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      // Récupérer tous les restaurants avec leur owner
      const { data: restaurants, error: restError } = await supabase
        .from('restaurants')
        .select('id, name, owner_id, is_open')
        .eq('is_open', true);
      
      if (restError || !restaurants) {
        return { sent: 0, error: restError?.message };
      }
      
      // Récupérer les owners
      const ownerIds = restaurants.map((r: any) => r.owner_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', ownerIds);
      
      const emailMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
      
      let sent = 0;
      
      for (const restaurant of restaurants as any[]) {
        const owner = emailMap.get(restaurant.owner_id) as any;
        if (!owner?.email) continue;
        
        // Stats de la semaine
        const { data: weekOrders } = await supabase
          .from('orders')
          .select('id, total_amount, status, order_items(item_name, quantity)')
          .eq('restaurant_id', restaurant.id)
          .gte('created_at', oneWeekAgo)
          .in('status', ['delivered', 'completed']);
        
        if (!weekOrders || weekOrders.length === 0) continue;
        
        const totalRevenue = weekOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
        const orderCount = weekOrders.length;
        const averageOrder = Math.round(totalRevenue / orderCount);
        
        // Top articles
        const itemCounts: Record<string, number> = {};
        weekOrders.forEach((order: any) => {
          (order.order_items || []).forEach((item: any) => {
            itemCounts[item.item_name] = (itemCounts[item.item_name] || 0) + item.quantity;
          });
        });
        
        const topItems = Object.entries(itemCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, qty]) => `${name} (${qty})`)
          .join(', ');
        
        // Générer l'email
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #eee;padding:24px">
            <h2 style="margin:0 0 12px;color:#111">📊 Rapport hebdomadaire — ${restaurant.name}</h2>
            <p style="margin:0 0 14px;color:#333">Voici le résumé de votre semaine:</p>
            
            <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <div><strong style="color:#111">Chiffre d'affaires</strong><br/><span style="font-size:24px;font-weight:bold">${totalRevenue.toLocaleString()} F</span></div>
                <div><strong style="color:#111">Commandes</strong><br/><span style="font-size:24px;font-weight:bold">${orderCount}</span></div>
                <div><strong style="color:#111">Panier moyen</strong><br/><span style="font-size:24px;font-weight:bold">${averageOrder.toLocaleString()} F</span></div>
              </div>
            </div>
            
            <h3 style="margin:16px 0 8px;color:#111">⭐ Articles populaires</h3>
            <p style="color:#333">${topItems || 'Aucune donnée'}</p>
            
            <h3 style="margin:16px 0 8px;color:#111">💡 Suggestions</h3>
            <ul style="color:#333">
              <li>Considérez créer un plat du jour pour augmenter les ventes</li>
              <li>Ajoutez des offres fidélité pour fidéliser vos clients</li>
              <li>Pseudo optimisez vos horaires selon les heures de pointe</li>
            </ul>
            
            <a href="${appUrl}/admin/restaurant/${restaurant.id}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700;margin-top:16px">
              Voir le dashboard
            </a>
          </div>
        `;
        
        const ok = await sendEmail(
          owner.email,
          `📊 Rapport hebdo — ${restaurant.name} (${totalRevenue.toLocaleString()} F)`,
          html
        );
        
        if (ok) sent++;
      }
      
      return { sent };
    }

    return res.status(200).json({ success: true, ...results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron]', err);
    return res.status(500).json({ error: msg });
  }
}
