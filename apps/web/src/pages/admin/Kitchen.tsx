// src/pages/admin/Kitchen.tsx
// Kitchen View — interface dédiée cuisine.
// Plein écran (sur tablette), grosses cartes, timer en gras, alerte retard.
// Statuts visibles : confirmed | preparing | ready (les commandes que la cuisine doit faire / vient de finir).
// Action principale : « Démarrer » (confirmed → preparing) puis « Marquer prête » (preparing → ready).
// Source de vérité statut : RPC change_order_status (cf. scripts/102-oms-state-machine.sql).

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Loader2, Clock, AlertTriangle, ChefHat, Bike, Utensils, ShoppingBag, RefreshCw, CheckCircle2, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { fetchRestaurantOrdersWithItems } from '@/lib/restaurantOrdersQuery';
import { changeOrderStatus } from '@/lib/changeOrderStatus';
import { useAdminRestaurantId } from '@/hooks/useAdminRestaurantId';
import { useOrderRealtime } from '@/hooks/useOrderRealtime';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  notes?: string | null;
}
interface KitchenOrder {
  id: string;
  order_number: string;
  status: 'confirmed' | 'accepted' | 'preparing' | 'ready';
  type: 'delivery' | 'dine_in' | 'takeaway';
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  customer_name?: string | null;
  items: OrderItem[];
}

const TYPE_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  delivery: { label: 'Livraison', Icon: Bike, color: 'text-purple-300' },
  dine_in: { label: 'Sur place', Icon: Utensils, color: 'text-emerald-300' },
  takeaway: { label: 'À emporter', Icon: ShoppingBag, color: 'text-blue-300' },
};

const KITCHEN_STATUSES = new Set(['confirmed', 'accepted', 'preparing', 'ready']);

function elapsedMin(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

/** Couleur urgence basée sur temps écoulé depuis création (en minutes). */
function urgencyTheme(min: number, status: string) {
  if (status === 'ready') {
    return {
      ring: 'ring-emerald-500/60',
      bg: 'bg-emerald-950/30',
      timeColor: 'text-emerald-300',
      badge: 'bg-emerald-500 text-emerald-950',
      label: 'PRÊTE',
    };
  }
  if (min >= 25) {
    return {
      ring: 'ring-red-500/80 animate-pulse',
      bg: 'bg-red-950/40',
      timeColor: 'text-red-300',
      badge: 'bg-red-500 text-white',
      label: 'EN RETARD',
    };
  }
  if (min >= 15) {
    return {
      ring: 'ring-amber-500/70',
      bg: 'bg-amber-950/30',
      timeColor: 'text-amber-300',
      badge: 'bg-amber-500 text-amber-950',
      label: 'À SURVEILLER',
    };
  }
  return {
    ring: 'ring-zinc-700/50',
    bg: 'bg-zinc-900/50',
    timeColor: 'text-zinc-200',
    badge: 'bg-zinc-700 text-zinc-100',
    label: 'EN COURS',
  };
}

export default function Kitchen() {
  const restaurantId = useAdminRestaurantId();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tickFlag, setTickFlag] = useState(0); // force re-render minute
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // Tick chaque 30 s pour rafraîchir le timer affiché
  useEffect(() => {
    const id = setInterval(() => setTickFlag((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const rows = await fetchRestaurantOrdersWithItems(restaurantId, 60);
      const filtered: KitchenOrder[] = (rows as unknown as KitchenOrder[])
        .filter((o) => KITCHEN_STATUSES.has(o.status))
        .map((o) => ({ ...o, items: Array.isArray(o.items) ? o.items : [] }));
      setOrders(filtered);
    } catch (err) {
      console.error('[kitchen] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    void fetchOrders();
    const iv = setInterval(fetchOrders, 30_000);
    return () => clearInterval(iv);
  }, [restaurantId, fetchOrders]);

  useOrderRealtime(
    restaurantId || null,
    useCallback(() => {
      void fetchOrders();
    }, [fetchOrders]),
    true, // sound on
    false,
  );

  const handleAction = useCallback(
    async (order: KitchenOrder, target: 'preparing' | 'ready') => {
      if (busy[order.id]) return;
      setBusy((b) => ({ ...b, [order.id]: true }));
      // optimistic UI
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: target as KitchenOrder['status'] } : o)),
      );
      const result = await changeOrderStatus(order.id, target, 'desktop');
      if (!result.ok) {
        await fetchOrders();
        if (result.error === 'invalid_transition') {
          toast.error('Cette action n\'est pas possible pour le moment. Actualisez la page.');
        } else {
          toast.error('Une erreur est survenue. Veuillez réessayer.');
        }
      } else {
        toast.success(target === 'preparing' ? 'Démarré en cuisine' : 'Marquée prête');
      }
      setBusy((b) => ({ ...b, [order.id]: false }));
    },
    [busy, fetchOrders],
  );

  const sorted = useMemo(() => {
    // ready en bas, à préparer en haut, plus vieilles d'abord (priorité)
    const order: Record<string, number> = { confirmed: 0, accepted: 0, preparing: 1, ready: 2 };
    return [...orders].sort((a, b) => {
      const so = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (so !== 0) return so;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [orders]);

  const counts = useMemo(() => {
    let toStart = 0, cooking = 0, ready = 0, late = 0;
    for (const o of orders) {
      const m = elapsedMin(o.created_at);
      if (o.status === 'ready') ready += 1;
      else if (o.status === 'preparing') cooking += 1;
      else toStart += 1;
      if (o.status !== 'ready' && m >= 25) late += 1;
    }
    return { toStart, cooking, ready, late };
  }, [orders]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RestafyLoader size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen -mx-3 sm:-mx-6 -mt-4 px-3 sm:px-6 pt-4 pb-24 bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Cuisine</h1>
            <p className="text-xs text-zinc-400">{orders.length} commande{orders.length > 1 ? 's' : ''} active{orders.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => void fetchOrders()}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          title="Rafraîchir"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-5">
        <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">À démarrer</div>
          <div className="text-2xl font-bold">{counts.toStart}</div>
        </div>
        <div className="rounded-xl bg-orange-950/30 border border-orange-900/50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-orange-400">En cuisine</div>
          <div className="text-2xl font-bold text-orange-300">{counts.cooking}</div>
        </div>
        <div className="rounded-xl bg-emerald-950/30 border border-emerald-900/50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400">Prêtes</div>
          <div className="text-2xl font-bold text-emerald-300">{counts.ready}</div>
        </div>
        <div className={`rounded-xl px-3 py-2 border ${counts.late > 0 ? 'bg-red-950/40 border-red-900/60' : 'bg-zinc-900/70 border-zinc-800'}`}>
          <div className={`text-[10px] uppercase tracking-wider ${counts.late > 0 ? 'text-red-400' : 'text-zinc-500'}`}>En retard</div>
          <div className={`text-2xl font-bold ${counts.late > 0 ? 'text-red-300' : ''}`}>{counts.late}</div>
        </div>
      </div>

      {/* Cards grid */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <ChefHat className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400">Aucune commande en cuisine. Le service est calme 🙏</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          <AnimatePresence>
            {sorted.map((o) => {
              const min = elapsedMin(o.created_at);
              const u = urgencyTheme(min, o.status);
              const TypeIcon = TYPE_META[o.type]?.Icon ?? Utensils;
              return (
                <motion.div
                  key={o.id + tickFlag}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  className={`relative rounded-2xl ring-2 ${u.ring} ${u.bg} p-4 flex flex-col gap-3`}
                >
                  {/* Header card */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TypeIcon className={`w-4 h-4 ${TYPE_META[o.type]?.color ?? 'text-zinc-300'}`} />
                      <span className="text-xs text-zinc-400 truncate">{TYPE_META[o.type]?.label ?? o.type}</span>
                    </div>
                    <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full ${u.badge}`}>
                      {u.label}
                    </span>
                  </div>

                  {/* Order # + Time */}
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="text-xs text-zinc-500 mb-0.5">N°</div>
                      <div className="text-2xl sm:text-3xl font-bold tracking-tight">#{o.order_number}</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {min >= 25 ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <Clock className="w-4 h-4 text-zinc-400" />}
                        <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${u.timeColor}`}>{min}</span>
                        <span className="text-sm text-zinc-500">min</span>
                      </div>
                    </div>
                  </div>

                  {/* Items list — gros texte cuisine */}
                  <div className="rounded-xl bg-zinc-950/50 border border-zinc-800 px-3 py-2 flex-1">
                    {o.items.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">Aucun article détaillé</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {o.items.map((it) => (
                          <li key={it.id} className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-bold text-orange-300 tabular-nums leading-none w-9 shrink-0">
                              {it.quantity}×
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-base sm:text-lg font-semibold text-zinc-100 leading-tight break-words">
                                {it.item_name}
                              </div>
                              {it.notes && (
                                <div className="text-xs text-amber-300 mt-0.5 italic">⚠ {it.notes}</div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Notes commande */}
                  {o.notes && (
                    <div className="rounded-lg bg-amber-950/40 border border-amber-900/50 px-2 py-1.5 text-xs text-amber-200">
                      📝 {o.notes}
                    </div>
                  )}

                  {/* Action button */}
                  {o.status === 'preparing' ? (
                    <button
                      disabled={busy[o.id]}
                      onClick={() => handleAction(o, 'ready')}
                      className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-base flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {busy[o.id] ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                      Marquer prête
                    </button>
                  ) : o.status === 'ready' ? (
                    <div className="w-full py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-sm text-center">
                      ✓ Prête à servir / livrer
                    </div>
                  ) : (
                    <button
                      disabled={busy[o.id]}
                      onClick={() => handleAction(o, 'preparing')}
                      className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-orange-950 font-bold text-base flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {busy[o.id] ? <Loader2 className="w-5 h-5 animate-spin" /> : <Flame className="w-5 h-5" />}
                      Démarrer
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
