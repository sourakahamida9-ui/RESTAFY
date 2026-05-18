import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote, CreditCard, TrendingUp, Receipt,
  RefreshCw, Search, CheckCircle2, Clock,
  X, User, Smartphone, AlertCircle,
  ShoppingBag, Utensils, Bike, ArrowUpRight, ArrowDownRight,
  Loader2, Printer, Download,
} from 'lucide-react';
import { useAdminRestaurantId } from '@/hooks/useAdminRestaurantId';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface CaisseOrder {
  id: string;
  order_number: string;
  status: string;
  type: string;
  total_amount: number;
  created_at: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  customer?: { full_name: string; phone: string } | null;
  order_items?: OrderItem[];
}

type TabId = 'overview' | 'pending' | 'completed';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  delivery: <Bike className="w-3.5 h-3.5" />,
  dine_in: <Utensils className="w-3.5 h-3.5" />,
  takeaway: <ShoppingBag className="w-3.5 h-3.5" />,
};

const TYPE_LABELS: Record<string, string> = {
  delivery: 'Livraison',
  dine_in: 'Sur place',
  takeaway: 'A emporter',
  pickup: 'A emporter',
};

function formatCFA(n: number): string {
  return n.toLocaleString('fr-FR');
}

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function CaissePOS() {
  const restaurantId = useAdminRestaurantId();
  const [orders, setOrders] = useState<CaisseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [search, setSearch] = useState('');
  const [confirmingCash, setConfirmingCash] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, type, total_amount, created_at, paid_at,
          payment_method, payment_ref,
          customer:profiles!orders_customer_id_fkey(full_name, phone),
          order_items(id, item_name, quantity, unit_price, subtotal)
        `)
        .eq('restaurant_id', restaurantId)
        .gte('created_at', todayStart())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as unknown as CaisseOrder[]) || []);
    } catch (err) {
      console.error('[Caisse] Error fetching orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchOrders();
    if (!restaurantId) return;
    const channel = supabase
      .channel('caisse-orders')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => { fetchOrders(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, fetchOrders]);

  const stats = useMemo(() => {
    const paid = orders.filter(o => ['confirmed', 'preparing', 'ready', 'delivering', 'delivered'].includes(o.status));
    const pending = orders.filter(o => o.status === 'pending');
    const cancelled = orders.filter(o => o.status === 'cancelled');

    const totalRevenue = paid.reduce((s, o) => s + (o.total_amount || 0), 0);
    const avgTicket = paid.length > 0 ? Math.round(totalRevenue / paid.length) : 0;
    const kkiapayRevenue = paid.filter(o => o.payment_ref).reduce((s, o) => s + (o.total_amount || 0), 0);
    const cashRevenue = totalRevenue - kkiapayRevenue;

    return {
      totalRevenue,
      avgTicket,
      paidCount: paid.length,
      pendingCount: pending.length,
      cancelledCount: cancelled.length,
      totalOrders: orders.length,
      kkiapayRevenue,
      cashRevenue,
    };
  }, [orders]);

  const pendingOrders = useMemo(() =>
    orders
      .filter(o => o.status === 'pending')
      .filter(o => !search || (o.customer?.full_name || '').toLowerCase().includes(search.toLowerCase()) || o.order_number?.toLowerCase().includes(search.toLowerCase())),
    [orders, search],
  );

  const completedOrders = useMemo(() =>
    orders
      .filter(o => ['confirmed', 'preparing', 'ready', 'delivering', 'delivered'].includes(o.status))
      .filter(o => !search || (o.customer?.full_name || '').toLowerCase().includes(search.toLowerCase()) || o.order_number?.toLowerCase().includes(search.toLowerCase())),
    [orders, search],
  );

  const handleConfirmCashPayment = async (orderId: string) => {
    setConfirmingCash(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          paid_at: new Date().toISOString(),
          payment_method: 'cash',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('status', 'pending');

      if (error) throw error;
      toast.success('Paiement en especes confirme');
      fetchOrders();
    } catch (err) {
      console.error('[Caisse] Error confirming cash payment:', err);
      toast.error('Erreur lors de la confirmation');
    } finally {
      setConfirmingCash(null);
    }
  };

  const handleExportCSV = () => {
    const paid = orders.filter(o => o.status !== 'cancelled' && o.status !== 'pending');
    if (paid.length === 0) { toast.info('Aucune transaction a exporter'); return; }

    const header = ['N°', 'Heure', 'Client', 'Type', 'Methode', 'Montant (FCFA)'];
    const rows = paid.map(o => {
      const time = new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return [
        o.order_number || o.id.slice(0, 8),
        time,
        o.customer?.full_name || 'Client',
        TYPE_LABELS[o.type] || o.type,
        o.payment_ref ? 'Kkiapay' : 'Especes',
        String(o.total_amount),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
    });

    const total = paid.reduce((s, o) => s + o.total_amount, 0);
    rows.push(['', '', '', '', 'TOTAL', String(total)].map(v => `"${v}"`));

    const csv = '\uFEFF' + [header.map(h => `"${h}"`), ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caisse_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV telecharge');
  };

  if (!restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md border border-zinc-100">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Restaurant non configure</h1>
          <p className="text-zinc-500">Votre profil n&apos;est pas associe a un restaurant.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="r-page-shell !max-w-none !px-0 !py-0">
      <div className="flex flex-col bg-zinc-50 min-h-[20rem] max-h-[calc(100dvh-7.5rem)] lg:max-h-[calc(100dvh-5.5rem)] overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-zinc-200 px-4 lg:px-6 py-3 lg:py-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-black">Caisse</h1>
              <p className="text-xs text-zinc-400">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="p-2 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition"
                title="Exporter CSV"
              >
                <Download className="w-4.5 h-4.5 text-zinc-600" />
              </button>
              <button
                onClick={() => { setRefreshing(true); fetchOrders(); }}
                disabled={refreshing}
                className="p-2 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition"
                title="Actualiser"
              >
                <RefreshCw className={cn("w-4.5 h-4.5 text-zinc-600", refreshing && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <StatCard
              label="Chiffre du jour"
              value={`${formatCFA(stats.totalRevenue)} F`}
              icon={<TrendingUp className="w-4 h-4" />}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <StatCard
              label="Commandes payees"
              value={String(stats.paidCount)}
              icon={<CheckCircle2 className="w-4 h-4" />}
              color="text-blue-600"
              bg="bg-blue-50"
              sub={`sur ${stats.totalOrders} total`}
            />
            <StatCard
              label="Ticket moyen"
              value={`${formatCFA(stats.avgTicket)} F`}
              icon={<Receipt className="w-4 h-4" />}
              color="text-orange-600"
              bg="bg-orange-50"
            />
            <StatCard
              label="En attente"
              value={String(stats.pendingCount)}
              icon={<Clock className="w-4 h-4" />}
              color={stats.pendingCount > 0 ? 'text-amber-600' : 'text-zinc-400'}
              bg={stats.pendingCount > 0 ? 'bg-amber-50' : 'bg-zinc-50'}
              pulse={stats.pendingCount > 0}
            />
          </div>

          {/* Revenue Breakdown */}
          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
              Kkiapay: <strong className="text-zinc-700">{formatCFA(stats.kkiapayRevenue)} F</strong>
            </span>
            <span className="flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5 text-blue-500" />
              Especes: <strong className="text-zinc-700">{formatCFA(stats.cashRevenue)} F</strong>
            </span>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 lg:px-6 pt-3 pb-1 shrink-0">
          {([
            { id: 'overview' as TabId, label: 'Apercu', count: stats.totalOrders },
            { id: 'pending' as TabId, label: 'A encaisser', count: stats.pendingCount },
            { id: 'completed' as TabId, label: 'Encaissees', count: stats.paidCount },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === tab.id
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-500 hover:bg-zinc-100 border border-zinc-200"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]",
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-400"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        {activeTab !== 'overview' && (
          <div className="px-4 lg:px-6 pt-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="search"
                placeholder="Rechercher par client ou n° commande..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-sm border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-3">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RestafyLoader fullscreen={false} message="Chargement de la caisse..." size="md" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <OverviewTab orders={orders} />
                </motion.div>
              )}
              {activeTab === 'pending' && (
                <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {pendingOrders.length === 0 ? (
                    <EmptyState message="Aucune commande en attente de paiement" icon={<CheckCircle2 className="w-10 h-10 text-emerald-400" />} />
                  ) : (
                    <div className="space-y-2">
                      {pendingOrders.map(order => (
                        <PendingOrderCard
                          key={order.id}
                          order={order}
                          onConfirmCash={handleConfirmCashPayment}
                          confirming={confirmingCash === order.id}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
              {activeTab === 'completed' && (
                <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {completedOrders.length === 0 ? (
                    <EmptyState message="Aucune transaction aujourd'hui" icon={<Receipt className="w-10 h-10 text-zinc-300" />} />
                  ) : (
                    <div className="space-y-2">
                      {completedOrders.map(order => (
                        <CompletedOrderCard key={order.id} order={order} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, bg, sub, pulse }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  sub?: string;
  pulse?: boolean;
}) {
  return (
    <div className={cn("rounded-xl p-3 border border-zinc-100", bg)}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">{label}</span>
        {pulse && <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />}
      </div>
      <p className={cn("text-lg font-black", color)}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">{icon}</div>
      <p className="text-sm text-zinc-400 font-medium">{message}</p>
    </div>
  );
}

function OverviewTab({ orders }: { orders: CaisseOrder[] }) {
  const recentOrders = orders.slice(0, 10);
  const byType = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    orders.filter(o => o.status !== 'cancelled').forEach(o => {
      const t = o.type || 'other';
      if (!map[t]) map[t] = { count: 0, revenue: 0 };
      map[t].count++;
      map[t].revenue += o.total_amount || 0;
    });
    return map;
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* Revenue by type */}
      <div>
        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wide mb-2">Repartition par type</h3>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(byType).map(([type, data]) => (
            <div key={type} className="bg-white rounded-xl p-3 border border-zinc-100">
              <div className="flex items-center gap-1.5 mb-1">
                {TYPE_ICONS[type] || <ShoppingBag className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-bold text-zinc-500">{TYPE_LABELS[type] || type}</span>
              </div>
              <p className="text-sm font-black text-zinc-800">{formatCFA(data.revenue)} F</p>
              <p className="text-[10px] text-zinc-400">{data.count} commande{data.count > 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wide mb-2">Activite recente</h3>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">Aucune commande aujourd&apos;hui</p>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-100 divide-y divide-zinc-50">
            {recentOrders.map(order => {
              const time = new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              const isPaid = ['confirmed', 'preparing', 'ready', 'delivering', 'delivered'].includes(order.status);
              const isCancelled = order.status === 'cancelled';
              return (
                <div key={order.id} className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      isCancelled ? "bg-red-50" : isPaid ? "bg-emerald-50" : "bg-amber-50"
                    )}>
                      {isCancelled
                        ? <X className="w-4 h-4 text-red-500" />
                        : isPaid
                          ? <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                          : <Clock className="w-4 h-4 text-amber-500" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-800 truncate">
                        {order.customer?.full_name || 'Client'}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {time} · {TYPE_LABELS[order.type] || order.type}
                        {order.payment_ref ? ' · Kkiapay' : ''}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-sm font-black shrink-0",
                    isCancelled ? "text-red-400 line-through" : isPaid ? "text-emerald-600" : "text-amber-600"
                  )}>
                    {isCancelled ? '-' : '+'}{formatCFA(order.total_amount)} F
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PendingOrderCard({ order, onConfirmCash, confirming }: {
  order: CaisseOrder;
  onConfirmCash: (id: string) => void;
  confirming: boolean;
}) {
  const time = new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const elapsed = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);

  return (
    <div className="bg-white rounded-xl border border-amber-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">
            EN ATTENTE
          </span>
          <span className="text-[10px] text-zinc-400 flex items-center gap-1">
            {TYPE_ICONS[order.type]} {TYPE_LABELS[order.type] || order.type}
          </span>
        </div>
        <span className="text-[10px] text-zinc-400">{time} · {elapsed} min</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div>
          <p className="text-sm font-bold">{order.customer?.full_name || 'Client'}</p>
          <p className="text-[10px] text-zinc-400">{order.customer?.phone || '-'}</p>
        </div>
      </div>

      {/* Items */}
      {order.order_items && order.order_items.length > 0 && (
        <div className="bg-zinc-50 rounded-lg p-2 mb-3 text-xs space-y-1">
          {order.order_items.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-zinc-600">{item.quantity}x {item.item_name}</span>
              <span className="font-bold">{formatCFA(item.subtotal)} F</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-lg font-black text-orange-600">{formatCFA(order.total_amount)} FCFA</span>
        <button
          onClick={() => onConfirmCash(order.id)}
          disabled={confirming}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition disabled:opacity-50"
        >
          {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
          Encaisser especes
        </button>
      </div>
    </div>
  );
}

function CompletedOrderCard({ order }: { order: CaisseOrder }) {
  const time = new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const isKkiapay = !!order.payment_ref;

  return (
    <div className="bg-white rounded-xl border border-zinc-100 p-3 flex items-center gap-3">
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
        isKkiapay ? "bg-emerald-50" : "bg-blue-50"
      )}>
        {isKkiapay ? <Smartphone className="w-4 h-4 text-emerald-600" /> : <Banknote className="w-4 h-4 text-blue-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{order.customer?.full_name || 'Client'}</p>
        <p className="text-[10px] text-zinc-400">
          {time} · {TYPE_LABELS[order.type] || order.type} · {isKkiapay ? 'Kkiapay' : 'Especes'}
        </p>
      </div>
      <span className="text-sm font-black text-emerald-600 shrink-0">
        {formatCFA(order.total_amount)} F
      </span>
    </div>
  );
}
