import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import {
  ArrowLeft, Database, AlertCircle, CheckCircle2,
  Clock, Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

type SupabaseErr = { message?: string; code?: string; details?: string; hint?: string } | null | undefined;

/** PostgREST / Supabase : table absente ou cache schéma pas à jour */
function isMissingTableError(err: SupabaseErr): boolean {
  if (!err) return false;
  const code = String(err.code ?? '');
  if (code === 'PGRST205' || code === '42P01') return true;
  const blob = [err.message, err.details, err.hint]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join(' | ');
  return (
    blob.includes('schema cache') ||
    blob.includes('could not find the table') ||
    (blob.includes('relation') && blob.includes('does not exist')) ||
    blob.includes('does not exist')
  );
}

interface RestaurantDataStats {
  id: string;
  name: string;
  totalOrders: number;
  daysOfData: number;
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  lastEventDate?: string;
}

export default function DataCenter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading } = useRoleGuard({
    requiredRoles: ['super_admin'],
    redirectTo: '/superadmin/login',
  });

  const [statsLoading, setStatsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [globalStats, setGlobalStats] = useState({
    totalOrderEvents: 0,
    totalDailySnapshots: 0,
    totalMenuViews: 0,
    totalStockAlerts: 0,
    totalRestaurants: 0,
  });

  const [restaurantStats, setRestaurantStats] = useState<RestaurantDataStats[]>([]);
  const [dataReadiness, setDataReadiness] = useState(0);
  const [aiThresholdDays] = useState(90);
  /** Si true, les compteurs « événements » viennent de `orders` (pas order_events) */
  const [usingOrdersFallback, setUsingOrdersFallback] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;

    const run = async () => {
      setStatsLoading(true);
      setFetchError(null);
      setUsingOrdersFallback(false);
      const errors: string[] = [];
      const missingTables = new Set<string>();

      const pushErr = (label: string, err: { message?: string; code?: string } | null) => {
        if (err?.message) errors.push(`${label}: ${err.message}`);
      };

      const noteMissing = (table: string, err: { message?: string; code?: string } | null | undefined) => {
        if (isMissingTableError(err)) missingTables.add(table);
      };

      try {
        // Sonde réelle : `head: true` + count a parfois un comportement différent ; évite N erreurs par restaurant.
        const probeOrderEvents = await supabase.from('order_events').select('id').limit(1);
        noteMissing('order_events', probeOrderEvents.error);
        let useOrdersForEventStats = isMissingTableError(probeOrderEvents.error);

        const [dailyRes, menuRes, stockRes, restRes] = await Promise.all([
          supabase.from('daily_restaurant_stats').select('id', { count: 'exact', head: true }),
          supabase.from('menu_views').select('id', { count: 'exact', head: true }),
          supabase.from('stock_alerts').select('id', { count: 'exact', head: true }),
          supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ]);

        noteMissing('daily_restaurant_stats', dailyRes.error);
        noteMissing('menu_views', menuRes.error);
        noteMissing('stock_alerts', stockRes.error);

        let orderEvents = 0;
        /** True si la table `order_events` manque mais le comptage via `orders` a réussi */
        let ordersFallbackSucceeded = false;

        if (!useOrdersForEventStats) {
          const orderRes = await supabase
            .from('order_events')
            .select('id', { count: 'exact', head: true });
          if (isMissingTableError(orderRes.error)) {
            useOrdersForEventStats = true;
            noteMissing('order_events', orderRes.error);
          } else if (orderRes.error) {
            pushErr('order_events', orderRes.error);
          } else {
            orderEvents = orderRes.count ?? 0;
          }
        }

        if (useOrdersForEventStats) {
          const { count: oc, error: oe } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true });
          if (!oe) {
            orderEvents = oc ?? 0;
            ordersFallbackSucceeded = true;
            if (!cancelled) setUsingOrdersFallback(true);
          } else {
            pushErr('orders (repli)', oe);
          }
        }

        const dailySnapshots = isMissingTableError(dailyRes.error) ? 0 : (dailyRes.count ?? 0);
        const menuViews = isMissingTableError(menuRes.error) ? 0 : (menuRes.count ?? 0);
        const stockAlerts = isMissingTableError(stockRes.error) ? 0 : (stockRes.count ?? 0);
        const restaurants = restRes.count ?? 0;

        if (!isMissingTableError(dailyRes.error)) pushErr('daily_restaurant_stats', dailyRes.error);
        if (!isMissingTableError(menuRes.error)) pushErr('menu_views', menuRes.error);
        if (!isMissingTableError(stockRes.error)) pushErr('stock_alerts', stockRes.error);
        pushErr('restaurants', restRes.error);

        const readiness = Math.min(100, Math.round((orderEvents / 1000) * 100));

        if (!cancelled) {
          setGlobalStats({
            totalOrderEvents: orderEvents,
            totalDailySnapshots: dailySnapshots,
            totalMenuViews: menuViews,
            totalStockAlerts: stockAlerts,
            totalRestaurants: restaurants,
          });
          setDataReadiness(readiness);
        }

        const { data: restaurantRows, error: listErr } = await supabase
          .from('restaurants')
          .select('id, name')
          .eq('is_active', true)
          .limit(50);

        pushErr('restaurants (liste)', listErr);

        if (cancelled) return;

        if (!restaurantRows?.length) {
          setRestaurantStats([]);
        } else {
          const batchSize = 6;
          const acc: RestaurantDataStats[] = [];
          for (let i = 0; i < restaurantRows.length; i += batchSize) {
            const chunk = restaurantRows.slice(i, i + batchSize);
            const part = await Promise.all(
              chunk.map(async (r) => {
                if (useOrdersForEventStats) {
                  const { count: orders, error: cErr } = await supabase
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('restaurant_id', r.id);
                  if (cErr) pushErr(`orders(${r.name})`, cErr);

                  const { data: bounds, error: bErr } = await supabase
                    .from('orders')
                    .select('created_at')
                    .eq('restaurant_id', r.id)
                    .order('created_at', { ascending: true })
                    .limit(1);

                  const { data: lastRows, error: lErr } = await supabase
                    .from('orders')
                    .select('created_at')
                    .eq('restaurant_id', r.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                  if (bErr) pushErr(`orders bounds(${r.name})`, bErr);
                  if (lErr) pushErr(`orders last(${r.name})`, lErr);

                  const firstAt = bounds?.[0]?.created_at;
                  const daysOfData = firstAt
                    ? Math.floor(
                        (Date.now() - new Date(firstAt).getTime()) / (1000 * 60 * 60 * 24),
                      )
                    : 0;

                  const n = orders ?? 0;
                  let quality: RestaurantDataStats['dataQuality'] = 'poor';
                  if (n >= 500) quality = 'excellent';
                  else if (n >= 200) quality = 'good';
                  else if (n >= 50) quality = 'fair';

                  return {
                    id: r.id,
                    name: r.name,
                    totalOrders: n,
                    daysOfData,
                    dataQuality: quality,
                    lastEventDate: lastRows?.[0]?.created_at,
                  };
                }

                const { count: orders, error: cErr } = await supabase
                  .from('order_events')
                  .select('id', { count: 'exact', head: true })
                  .eq('restaurant_id', r.id);
                if (cErr) pushErr(`order_events(${r.name})`, cErr);

                const { data: bounds, error: bErr } = await supabase
                  .from('order_events')
                  .select('created_at')
                  .eq('restaurant_id', r.id)
                  .order('created_at', { ascending: true })
                  .limit(1);
                if (bErr) pushErr(`order_events bounds(${r.name})`, bErr);

                const { data: lastRows, error: lErr } = await supabase
                  .from('order_events')
                  .select('created_at')
                  .eq('restaurant_id', r.id)
                  .order('created_at', { ascending: false })
                  .limit(1);
                if (lErr) pushErr(`order_events last(${r.name})`, lErr);

                const firstAt = bounds?.[0]?.created_at;
                const daysOfData = firstAt
                  ? Math.floor(
                      (Date.now() - new Date(firstAt).getTime()) / (1000 * 60 * 60 * 24),
                    )
                  : 0;

                const n = orders ?? 0;
                let quality: RestaurantDataStats['dataQuality'] = 'poor';
                if (n >= 500) quality = 'excellent';
                else if (n >= 200) quality = 'good';
                else if (n >= 50) quality = 'fair';

                return {
                  id: r.id,
                  name: r.name,
                  totalOrders: n,
                  daysOfData,
                  dataQuality: quality,
                  lastEventDate: lastRows?.[0]?.created_at,
                };
              }),
            );
            acc.push(...part);
          }
          if (!cancelled) {
            setRestaurantStats(acc.sort((a, b) => b.totalOrders - a.totalOrders));
          }
        }

        if (!cancelled) {
          const rlsHint = errors.some((e) =>
            e.includes('permission denied') || e.includes('42501') || e.includes('RLS'),
          )
            ? ' Vérifiez les droits (RLS) pour le compte super administrateur dans Supabase.'
            : '';

          /** Tables analytics optionnelles : affichage à 0, pas d’alerte bloquante */
          const optionalAnalyticsTables = new Set([
            'daily_restaurant_stats',
            'menu_views',
            'stock_alerts',
          ]);

          const orderEventsResolved =
            !missingTables.has('order_events') ||
            (useOrdersForEventStats && ordersFallbackSucceeded);

          const blockingMissing = new Set(missingTables);
          if (orderEventsResolved) blockingMissing.delete('order_events');
          for (const t of optionalAnalyticsTables) blockingMissing.delete(t);

          if (blockingMissing.size > 0) {
            setFetchError(
              `Certaines données ne sont pas accessibles : ${[...blockingMissing].join(', ')}. Vérifiez le projet Supabase ou contactez le support.${rlsHint}`,
            );
          } else if (errors.length > 0) {
            setFetchError(`${errors.slice(0, 3).join(' · ')}${errors.length > 3 ? '…' : ''}${rlsHint}`);
          } else {
            setFetchError(null);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[DataCenter] fetch error:', err);
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Erreur de chargement des statistiques.');
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  if (loading) return <RestafyLoader message="Data Center" />;

  const daysUntilAI = Math.max(0, aiThresholdDays - Math.floor(dataReadiness / 100 * aiThresholdDays));
  const aiThresholdReached = dataReadiness >= 80;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/superadmin')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <h1 className="text-4xl font-black text-gray-900">📊 Data Center</h1>
        <p className="text-gray-600 mt-2">Infrastructure de collecte de données pour l'IA prédictive</p>
      </div>

      {fetchError && (
        <div
          className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-bold">Données partiellement ou totalement inaccessibles</p>
          <p className="mt-1 text-amber-900/90">{fetchError}</p>
        </div>
      )}

      {statsLoading && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-orange-500" aria-hidden />
          <span className="font-medium">Chargement des métriques…</span>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Data Readiness Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200"
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-black text-gray-900">🧠 Data Readiness</h2>
              <p className="text-sm text-gray-600 mt-1">Progression vers seuil IA</p>
            </div>
            <Database className="w-6 h-6 text-blue-500" />
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-3xl font-black text-blue-600">{dataReadiness}%</span>
              <span className="text-sm text-gray-500">Cible: 80%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dataReadiness}%` }}
                transition={{ duration: 1 }}
                className={`h-full rounded-full transition-colors ${
                  dataReadiness >= 80 ? 'bg-green-500' : 'bg-blue-500'
                }`}
              />
            </div>
          </div>

          {/* Message */}
          <div className={`p-4 rounded-xl ${aiThresholdReached ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
            {aiThresholdReached ? (
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-green-900">🎉 IA activable!</p>
                  <p className="text-sm text-green-700 mt-1">Vous avez assez de données. Prêt pour entraînement IA.</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-900">Encore {daysUntilAI} jours</p>
                  <p className="text-sm text-blue-700 mt-1">Collecte en cours... L'IA sera activée automatiquement.</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Global Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200"
        >
          <h2 className="text-xl font-black text-gray-900 mb-6">📈 Volume Global</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <span className="text-gray-600 font-bold">
                Événements de commandes
                {usingOrdersFallback && (
                  <span className="block text-xs font-normal text-gray-400 mt-0.5">
                    Comptage sur les commandes réelles (orders)
                  </span>
                )}
              </span>
              <span className="text-2xl font-black text-orange-600">{globalStats.totalOrderEvents.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <span className="text-gray-600 font-bold">Snapshots quotidiens</span>
              <span className="text-2xl font-black text-blue-600">{globalStats.totalDailySnapshots.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <span className="text-gray-600 font-bold">Vues du menu</span>
              <span className="text-2xl font-black text-purple-600">{globalStats.totalMenuViews.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-bold">Alertes stock</span>
              <span className="text-2xl font-black text-red-600">{globalStats.totalStockAlerts.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Data Quality by Restaurant */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200"
      >
        <h2 className="text-xl font-black text-gray-900 mb-6">📊 Qualité par Restaurant</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-bold text-gray-600">Restaurant</th>
                <th className="text-right py-3 px-4 font-bold text-gray-600">Commandes</th>
                <th className="text-right py-3 px-4 font-bold text-gray-600">Jours de data</th>
                <th className="text-center py-3 px-4 font-bold text-gray-600">Qualité</th>
              </tr>
            </thead>
            <tbody>
              {restaurantStats.map((stat) => {
                const qualityColors = {
                  excellent: 'bg-green-100 text-green-700 border border-green-300',
                  good: 'bg-blue-100 text-blue-700 border border-blue-300',
                  fair: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
                  poor: 'bg-gray-100 text-gray-700 border border-gray-300',
                };

                return (
                  <motion.tr
                    key={stat.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-gray-100 hover:bg-gray-50 transition"
                  >
                    <td className="py-3 px-4 font-bold text-gray-900">{stat.name}</td>
                    <td className="text-right py-3 px-4 text-gray-600 font-bold">{stat.totalOrders.toLocaleString()}</td>
                    <td className="text-right py-3 px-4 text-gray-600 font-bold">{stat.daysOfData}</td>
                    <td className="text-center py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${qualityColors[stat.dataQuality]}`}>
                        {stat.dataQuality === 'excellent' && '✅ Excellent'}
                        {stat.dataQuality === 'good' && '👍 Bon'}
                        {stat.dataQuality === 'fair' && '⚠️ Acceptable'}
                        {stat.dataQuality === 'poor' && '❌ Faible'}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Info Footer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200"
      >
        <div className="flex gap-4">
          <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-black text-gray-900 mb-2">À propos du Data Center</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              Restafy collecte automatiquement les données de commandes, comportements clients et alertes stock.
              Une fois 80% du seuil atteint (~1000 commandes), l'IA de prédiction sera activée pour:
              <ul className="list-disc list-inside mt-3 space-y-1">
                <li>Prédire la demande par heure et jour</li>
                <li>Détecter les ruptures de stock imminentes</li>
                <li>Optimiser les ressources et la préparation</li>
              </ul>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
