// src/pages/admin/Dashboard.tsx — Premium Dashboard v2
//
// Refonte 2026-05-04 : Design premium avec glassmorphism, mobile-first optimise
// - KPI cards elegantes avec icones et gradients subtils
// - Cartes avec effets de profondeur et bordures subtiles
// - Navigation mobile optimisee avec touch-friendly elements
// - Animations fluides et transitions douces
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantOrders, useRestaurantAnalytics } from '@/hooks/useRestaurantAdmin';
import {
  CheckCircle2, TrendingUp,
  AlertCircle, Home, RefreshCw, ChefHat,
  Bike, ArrowRight, ArrowUpRight, Clock,
  ShoppingBag, Users,
  Zap, Activity,
  Banknote, UtensilsCrossed, Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { pickAvailableDeliveryDriver } from '@/lib/deliveryAssign';
import { changeOrderStatus } from '@/lib/changeOrderStatus';

// ===== INTERFACES =====
interface OrderItemRow {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface OrderRow {
  id: string;
  order_number?: string;
  status: string;
  type: string;
  total_amount: number;
  total?: number;
  delivery_address?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  customer_id?: string | null;
  customer_name?: string;
  customer_phone?: string;
  driver_id?: string | null;
  order_items?: OrderItemRow[];
}

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  is_open: boolean;
  avg_rating: number;
  total_reviews: number;
  is_active: boolean;
  owner_id: string | null;
}

interface LivreurRow {
  id: string;
  name: string;
  phone: string;
  is_available: boolean;
}

interface TeamMemberRow {
  id: string;
  role: string;
  is_active: boolean;
  profile?: { full_name: string | null } | null;
}

const STATUS: Record<string, { label: string; dot: string; bg: string; text: string; border: string; borderColor: string }> = {
  pending:    { label: 'Nouvelle',   dot: 'bg-amber-400',  bg: 'bg-amber-500/15',  text: 'text-amber-200',  border: 'border-amber-500/25', borderColor: 'rgba(245,158,11,0.2)' },
  accepted:   { label: 'Acceptée',   dot: 'bg-sky-400',    bg: 'bg-sky-500/15',    text: 'text-sky-200',    border: 'border-sky-500/25',   borderColor: 'rgba(56,189,248,0.2)' },
  confirmed:  { label: 'Confirmée',  dot: 'bg-sky-400',    bg: 'bg-sky-500/15',    text: 'text-sky-200',    border: 'border-sky-500/25',   borderColor: 'rgba(56,189,248,0.2)' },
  preparing:  { label: 'En cuisine', dot: 'bg-orange-400', bg: 'bg-orange-500/15', text: 'text-orange-200', border: 'border-orange-500/25',borderColor: 'rgba(249,115,22,0.2)' },
  ready:      { label: 'Prête',      dot: 'bg-emerald-400',bg: 'bg-emerald-500/15',text: 'text-emerald-200',border: 'border-emerald-500/25',borderColor: 'rgba(52,211,153,0.2)'},
  delivering: { label: 'En route',   dot: 'bg-violet-400', bg: 'bg-violet-500/15', text: 'text-violet-200', border: 'border-violet-500/25',borderColor: 'rgba(167,139,250,0.2)'},
  delivered:  { label: 'Livrée',     dot: 'bg-zinc-400',   bg: 'bg-zinc-500/10',   text: 'text-zinc-300',   border: 'border-zinc-600',     borderColor: 'rgba(113,113,122,0.2)'},
  cancelled:  { label: 'Annulée',    dot: 'bg-red-400',    bg: 'bg-red-500/15',    text: 'text-red-300',    border: 'border-red-500/25',   borderColor: 'rgba(248,113,113,0.2)'},
};

const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed', confirmed: 'preparing', accepted: 'preparing',
  preparing: 'ready', ready: 'delivering', delivering: 'delivered',
};

const SHORT_ACTION: Record<string, string> = {
  pending: 'Accepter',
  confirmed: 'Démarrer',
  accepted: 'Démarrer',
  preparing: 'Prête',
  ready: 'Livrer',
  delivering: 'Livrée',
};

function statusBadgeClass(status: string) {
  switch (status) {
    case 'pending': return 'bg-orange-900/30 text-orange-300';
    case 'accepted': case 'confirmed': return 'bg-sky-900/30 text-sky-300';
    case 'preparing': return 'bg-blue-900/30 text-blue-300';
    case 'ready': return 'bg-green-900/30 text-green-300';
    case 'delivering': return 'bg-violet-900/30 text-violet-300';
    case 'delivered': return 'bg-zinc-700/30 text-zinc-400';
    case 'cancelled': return 'bg-red-900/30 text-red-300';
    default: return 'bg-zinc-700/30 text-zinc-400';
  }
}

function formatFCFA(v: number) {
  return v.toLocaleString('fr-FR') + ' F';
}

// ── Premium KPI Card ─────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, tone = 'neutral', pulse, trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'warn' | 'success' | 'accent';
  pulse?: boolean;
  trend?: { value: number; positive: boolean };
}) {
  const toneConfig = {
    neutral: { 
      iconBg: 'bg-zinc-500/10', 
      iconText: 'text-zinc-400',
      gradient: 'from-zinc-500/5 to-transparent',
      ring: 'ring-zinc-500/10',
    },
    warn: { 
      iconBg: 'bg-amber-500/15', 
      iconText: 'text-amber-500',
      gradient: 'from-amber-500/8 to-transparent',
      ring: 'ring-amber-500/20',
    },
    success: { 
      iconBg: 'bg-emerald-500/15', 
      iconText: 'text-emerald-500',
      gradient: 'from-emerald-500/8 to-transparent',
      ring: 'ring-emerald-500/20',
    },
    accent: { 
      iconBg: 'bg-orange-500/15', 
      iconText: 'text-orange-500',
      gradient: 'from-orange-500/8 to-transparent',
      ring: 'ring-orange-500/20',
    },
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: 'var(--restaurant-card)',
        border: '1px solid var(--restaurant-card-border)',
        boxShadow: 'var(--r-card-shadow)',
      }}
    >
      {/* Gradient accent */}
      <div className={`absolute inset-0 bg-gradient-to-br ${toneConfig.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--r-text-muted)' }}
          >
            {label}
          </p>
          <div className="flex items-baseline gap-2 mt-2">
            <p
              className="text-2xl sm:text-3xl font-black leading-none tracking-tight tabular-nums"
              style={{ color: 'var(--r-text)' }}
            >
              {value}
            </p>
            {trend && (
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${trend.positive ? 'text-emerald-500' : 'text-red-500'}`}>
                <TrendingUp className={`w-3 h-3 ${!trend.positive ? 'rotate-180' : ''}`} />
                {trend.value}%
              </span>
            )}
          </div>
          {sub && (
            <p className="mt-2 text-[11px] sm:text-xs leading-tight" style={{ color: 'var(--r-text-subtle)' }}>
              {sub}
            </p>
          )}
        </div>
        <div className={`relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl ${toneConfig.iconBg} ${toneConfig.iconText} ring-1 ${toneConfig.ring} transition-transform duration-300 group-hover:scale-110`}>
          {icon}
          {pulse && (
            <>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500" />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile, refreshProfile, user, staffInfo } = useAuth();
  const navigate = useNavigate();
  const [restaurantId, setRestaurantId] = useState<string | null>(
    () => profile?.restaurant_id ?? staffInfo?.restaurant_id ?? null,
  );
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [waitingForLink, setWaitingForLink] = useState(false);

  useEffect(() => {
    const findRestaurant = async () => {
      if (restaurantId) {
        setRestaurantLoading(true);
        const { data } = await supabase
          .from('restaurants')
          .select('id,name,slug,logo_url,is_open,avg_rating,total_reviews,is_active,owner_id')
          .eq('id', restaurantId)
          .single();
        if (data) { setRestaurant(data); setIsOpen(data.is_open ?? false); }
        setRestaurantLoading(false);
        return;
      }
      if (profile?.restaurant_id) {
        setRestaurantId(profile.restaurant_id);
        return;
      }
      if (staffInfo?.restaurant_id && user?.id) {
        await supabase.from('profiles').update({ restaurant_id: staffInfo.restaurant_id }).eq('id', user.id);
        setRestaurantId(staffInfo.restaurant_id);
        refreshProfile();
        return;
      }
      if (!user?.id || !profile) return;

      const { data: owned } = await supabase.from('restaurants').select('id').eq('owner_id', user.id).maybeSingle();
      if (owned) {
        await supabase.from('profiles').update({ restaurant_id: owned.id }).eq('id', user.id);
        setRestaurantId(owned.id); refreshProfile(); return;
      }
      const { data: staffRows } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      const staffRid = staffRows?.[0]?.restaurant_id;
      if (staffRid) {
        await supabase.from('profiles').update({ restaurant_id: staffRid }).eq('id', user.id);
        setRestaurantId(staffRid); refreshProfile(); return;
      }
      setWaitingForLink(true);
      setRestaurantLoading(false);
    };
    findRestaurant();
  }, [user?.id, profile?.restaurant_id, staffInfo?.restaurant_id, restaurantId, refreshProfile]);

  useEffect(() => {
    if (!restaurant?.id || !user?.id) return;
    if (restaurant.is_active !== false) return;
    const linkedAsOwner =
      restaurant.owner_id === user.id ||
      (profile?.role === 'restaurant_owner' && profile?.restaurant_id === restaurant.id);
    if (!linkedAsOwner) return;
    let cancelled = false;
    void (async () => {
      const now = new Date().toISOString();
      let error: { message: string } | null = null;
      if (restaurant.owner_id === user.id) {
        const r = await supabase
          .from('restaurants')
          .update({ is_active: true, updated_at: now })
          .eq('id', restaurant.id)
          .eq('owner_id', user.id);
        error = r.error;
      } else if (restaurant.owner_id == null) {
        const r = await supabase
          .from('restaurants')
          .update({ is_active: true, owner_id: user.id, updated_at: now })
          .eq('id', restaurant.id)
          .is('owner_id', null);
        error = r.error;
      } else {
        return;
      }
      if (cancelled) return;
      if (error) {
        toast.error("Impossible d'activer l'établissement : " + error.message);
        return;
      }
      setRestaurant((r) =>
        r ? { ...r, is_active: true, owner_id: r.owner_id ?? user.id } : r,
      );
      toast.success('Établissement activé — commandes disponibles.');
    })();
    return () => {
      cancelled = true;
    };
  }, [
    restaurant?.id,
    restaurant?.is_active,
    restaurant?.owner_id,
    user?.id,
    profile?.role,
    profile?.restaurant_id,
  ]);

  const [isOpen, setIsOpen] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [team, setTeam] = useState<TeamMemberRow[]>([]);
  const [livreurs, setLivreurs] = useState<LivreurRow[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; revenue: number; orders: number }[]>([]);
  const [driverNameById, setDriverNameById] = useState<Record<string, string>>({});
  const [menuStats, setMenuStats] = useState({ itemCount: 0, categoryCount: 0, categories: [] as string[] });

  const { orders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useRestaurantOrders(restaurantId);
  const { stats } = useRestaurantAnalytics(restaurantId);

  useEffect(() => {
    if (!restaurantId) return;
    const ids = [...new Set(orders.map((o) => (o as OrderRow).driver_id).filter(Boolean))] as string[];
    if (ids.length === 0) {
      setDriverNameById({});
      return;
    }
    supabase
      .from('delivery_drivers')
      .select('id,name')
      .in('id', ids)
      .then(({ data }) => {
        if (data) setDriverNameById(Object.fromEntries(data.map((d) => [d.id, d.name])));
      });
  }, [restaurantId, orders]);

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      supabase.from('restaurant_staff').select('*, profile:profiles(full_name)').eq('restaurant_id', restaurantId).eq('is_active', true).limit(4),
      supabase.from('delivery_drivers').select('id,name,phone,is_available').eq('restaurant_id', restaurantId).limit(3),
      supabase.from('orders').select('total_amount, created_at').eq('restaurant_id', restaurantId).eq('status', 'delivered').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]).then(([staffRes, livRes, ordersRes]) => {
      if (staffRes.data) setTeam(staffRes.data as unknown as TeamMemberRow[]);
      if (livRes.data) setLivreurs(livRes.data as unknown as LivreurRow[]);
      if (ordersRes.data) {
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const today = new Date();
        setWeeklyData(Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today); d.setDate(d.getDate() - (6 - i));
          const s = new Date(d).setHours(0,0,0,0), e = new Date(d).setHours(23,59,59,999);
          const dayOrders = ordersRes.data!.filter(o => { const t = new Date(o.created_at).getTime(); return t >= s && t <= e; });
          return { day: days[d.getDay()], revenue: dayOrders.reduce((a, o) => a + (o.total_amount || 0), 0), orders: dayOrders.length };
        }));
      }
    });

    supabase
      .from('items')
      .select('id, category_id, categories ( name )')
      .eq('restaurant_id', restaurantId)
      .then(({ data }) => {
        if (data) {
          const cats = [...new Set(data.map((i) => {
            const c = (i as unknown as { categories?: { name: string } | { name: string }[] }).categories;
            if (Array.isArray(c)) return c[0]?.name;
            return c?.name;
          }).filter(Boolean))];
          setMenuStats({
            itemCount: data.length,
            categoryCount: cats.length,
            categories: cats as string[],
          });
        }
      });
  }, [restaurantId]);

  useEffect(() => {
    const t = setTimeout(() => { if (restaurantLoading && !restaurant) { setRestaurantLoading(false); if (!restaurantId) setWaitingForLink(true); } }, 10000);
    return () => clearTimeout(t);
  }, [restaurantLoading, restaurant, restaurantId]);

  const handleUpdateStatus = useCallback(
    async (orderId: string, newStatus: string) => {
      const order = orders.find((o) => o.id === orderId) as OrderRow | undefined;
      let assignedDriver: string | null = null;

      // Driver assignment: pré-update non-status fields uniquement (le state
      // machine trigger n'autorise pas de mixer status + autres champs côté
      // RLS, et la RPC change_order_status ne touche que status).
      if (newStatus === 'delivering' && order?.type === 'delivery' && restaurantId && !order.driver_id) {
        const picked = await pickAvailableDeliveryDriver(restaurantId);
        if (picked) {
          const { error: drvErr } = await supabase
            .from('orders')
            .update({ driver_id: picked.id, driver_assigned_at: new Date().toISOString() })
            .eq('id', orderId);
          if (drvErr) {
            toast.error('Erreur assignation livreur: ' + drvErr.message);
            return;
          }
          assignedDriver = picked.name;
          setDriverNameById((prev) => ({ ...prev, [picked.id]: picked.name }));
        } else {
          toast.message(
            'Aucun livreur « disponible » dans delivery_drivers. Ajoutez-en dans Équipe → livreurs ou assignez depuis la page Commandes.',
            { duration: 7000 },
          );
        }
      }

      try {
        const result = await changeOrderStatus(orderId, newStatus, 'desktop');
        if (!result.ok) {
          if (result.error === 'invalid_transition') {
            toast.error(`Transition impossible: ${result.from} → ${result.to}`);
          } else {
            toast.error('Erreur: ' + (result.error ?? 'unknown'));
          }
          return;
        }
        if (assignedDriver) toast.success(`En livraison — ${assignedDriver} assigné automatiquement`);
        else toast.success('Statut mis à jour');
      } catch (err: unknown) {
        toast.error('Erreur: ' + (err instanceof Error ? err.message : String(err)));
      }
    },
    [orders, restaurantId],
  );

  const handleToggleOpen = async () => {
    if (!restaurant) return;
    setTogglingOpen(true);
    const newVal = !isOpen;
    const { error } = await supabase.from('restaurants').update({ is_open: newVal }).eq('id', restaurant.id);
    if (!error) setIsOpen(newVal);
    else toast.error('Erreur mise à jour statut');
    setTogglingOpen(false);
  };

  // Loading state
  if (restaurantLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <RestafyLoader fullscreen={false} message="Chargement du tableau de bord…" size="md" />
      </div>
    );
  }

  // No restaurant linked
  if (!restaurantId || !restaurant) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 text-center space-y-4" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <div className="w-14 h-14 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/25">
            <AlertCircle className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">{waitingForLink ? 'Aucun restaurant trouvé' : 'Restaurant non lié'}</h1>
            <p className="text-sm text-zinc-500 mt-1">Votre compte n'est pas encore lié à un restaurant.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} className="flex-1 py-2.5 border border-zinc-700 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/5">↻ Rafraîchir</button>
            <button onClick={() => navigate('/')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600"><Home className="w-3.5 h-3.5" /> Accueil</button>
          </div>
        </div>
      </div>
    );
  }

  // Calculations
  const pending = orders.filter(o => o.status === 'pending').length;
  const preparing = orders.filter(o => ['accepted', 'confirmed', 'preparing', 'delivering'].includes(o.status)).length;
  const ready = orders.filter(o => o.status === 'ready').length;
  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const todayRevenue = stats?.todayRevenue ?? 0;
  const todayOrders = stats?.todayOrders ?? 0;
  const urgentCount = orders.filter(o => Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000) > 20 && ['pending', 'accepted', 'confirmed', 'preparing'].includes(o.status)).length;

  return (
    <div className="min-h-full w-full min-w-0 space-y-5 sm:space-y-6 pb-8">

      {/* ── Banner: restaurant fermé (1 seule source de vérité côté page) ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl px-4 py-3 sm:px-5 sm:py-4"
            style={{
              background: 'var(--restaurant-card)',
              border: '1px solid var(--restaurant-card-border)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-500/10 text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--r-text)' }}>
                  Restaurant fermé
                </p>
                <p className="text-xs" style={{ color: 'var(--r-text-subtle)' }}>
                  Les clients ne peuvent pas commander tant qu'il n'est pas ouvert.
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleOpen}
              disabled={togglingOpen}
              className="self-stretch sm:self-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-60"
            >
              {togglingOpen ? '…' : 'Ouvrir maintenant'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Urgent alert ── */}
      <AnimatePresence>
        {urgentCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl bg-red-500/10 border border-red-500/20"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 text-red-400 flex-shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium text-red-300">
              {urgentCount} commande{urgentCount > 1 ? 's' : ''} en attente depuis plus de 20 minutes
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Premium KPI Grid ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="En attente"
          value={pending}
          sub={pending > 0 ? `${pending} commande${pending > 1 ? 's' : ''} à traiter` : 'Aucune commande en attente'}
          icon={<ShoppingBag className="w-5 h-5" />}
          tone="warn"
          pulse={pending > 0}
        />
        <KpiCard
          label="En cuisine"
          value={preparing}
          sub={preparing > 0 ? `${preparing} en préparation` : 'Cuisine au repos'}
          icon={<ChefHat className="w-5 h-5" />}
          tone="accent"
        />
        <KpiCard
          label="Prêtes"
          value={ready}
          sub={ready > 0 ? `${ready} à servir / livrer` : 'Aucune prête'}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="success"
        />
        <KpiCard
          label="CA du jour"
          value={formatFCFA(todayRevenue)}
          sub={`${todayOrders} commande${todayOrders > 1 ? 's' : ''} livrée${todayOrders > 1 ? 's' : ''}`}
          icon={<Banknote className="w-5 h-5" />}
          tone="neutral"
        />
      </div>

      {/* ── Premium Revenue Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative overflow-hidden rounded-2xl p-4 sm:p-6"
        style={{
          background: 'var(--restaurant-card)',
          border: '1px solid var(--restaurant-card-border)',
          boxShadow: 'var(--r-card-shadow)',
        }}
      >
        {/* Decorative gradient orb */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500 ring-1 ring-orange-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold" style={{ color: 'var(--r-text)' }}>
                Performance hebdomadaire
              </h3>
              <p className="text-[11px] sm:text-xs mt-0.5" style={{ color: 'var(--r-text-subtle)' }}>
                Revenus des 7 derniers jours
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--r-text-muted)' }}>
                Total
              </p>
              <p className="text-xl sm:text-2xl font-black tabular-nums tracking-tight mt-0.5" style={{ color: 'var(--r-text)' }}>
                {formatFCFA(weeklyData.reduce((a, d) => a + d.revenue, 0))}
              </p>
            </div>
            <div className="h-8 w-px" style={{ background: 'var(--restaurant-card-border)' }} />
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--r-text-muted)' }}>
                Commandes
              </p>
              <p className="text-xl sm:text-2xl font-black tabular-nums tracking-tight mt-0.5" style={{ color: 'var(--r-text)' }}>
                {weeklyData.reduce((a, d) => a + d.orders, 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="h-36 sm:h-44 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.35} />
                  <stop offset="50%" stopColor="#F97316" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: 'var(--r-text-subtle)' }}
                dy={8}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--restaurant-card)',
                  border: '1px solid var(--restaurant-card-border)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
                labelStyle={{ color: 'var(--r-text)', fontWeight: 700, marginBottom: 4 }}
                itemStyle={{ color: 'var(--r-text-muted)' }}
                formatter={(value: number) => [formatFCFA(value), 'Revenus']}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#F97316" 
                strokeWidth={2.5} 
                fill="url(#weeklyGrad)" 
                dot={false}
                activeDot={{ r: 6, fill: '#F97316', stroke: 'var(--restaurant-card)', strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Premium Orders & Stats Grid ── */}
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-3">

        {/* Active orders (2/3) */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="xl:col-span-2"
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'var(--restaurant-card)',
              border: '1px solid var(--restaurant-card-border)',
              boxShadow: 'var(--r-card-shadow)',
            }}
          >
            <div
              className="px-4 sm:px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--restaurant-card-border)' }}
            >
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-500">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold" style={{ color: 'var(--r-text)' }}>
                    Commandes actives
                  </h2>
                  <p className="text-[10px] sm:text-[11px] hidden sm:block" style={{ color: 'var(--r-text-subtle)' }}>
                    Suivi en temps reel
                  </p>
                </div>
                {activeOrders.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-6 px-2 rounded-full text-[11px] font-bold bg-orange-500 text-white shadow-lg shadow-orange-500/25">
                    {activeOrders.length}
                  </span>
                )}
              </div>
              <Link
                to="/restaurant/dashboard/orders"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 transition-all"
              >
                Tout voir <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Error alert */}
            {ordersError && (
              <div className="m-4 flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 hidden sm:block" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-red-200 text-sm">Erreur de chargement</p>
                  <p className="text-red-300/70 text-xs mt-0.5">Cliquez sur Réessayer.</p>
                </div>
                <button
                  type="button"
                  onClick={() => refetchOrders()}
                  disabled={ordersLoading}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-200 text-xs font-semibold hover:bg-red-500/30 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
                  Réessayer
                </button>
              </div>
            )}
            {profile?.role && ['restaurant'].includes(profile.role as string) && (
              <div className="m-4 flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-amber-200/80 text-xs">
                  Votre compte utilise une ancienne configuration. Contactez le support Restafy.
                </p>
              </div>
            )}

            {/* Orders list */}
            <div className="p-4 sm:p-5">
              {ordersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="relative w-8 h-8">
                    <div className="absolute inset-0 border-[3px] border-orange-500/20 rounded-full" />
                    <div className="absolute inset-0 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                </div>
              ) : activeOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: 'var(--r-surface)', border: '1px solid var(--restaurant-card-border)' }}
                  >
                    <ShoppingBag className="w-6 h-6" style={{ color: 'var(--r-text-subtle)' }} />
                  </div>
                  <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--r-text)' }}>
                    Aucune commande active
                  </h3>
                  <p className="text-xs max-w-xs" style={{ color: 'var(--r-text-subtle)' }}>
                    {isOpen ? 'Les nouvelles commandes apparaîtront ici en temps réel.' : 'Votre restaurant est fermé.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeOrders
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .slice(0, 5)
                    .map((order, idx) => {
                      const ord = order as OrderRow;
                      const s = STATUS[ord.status] || STATUS.pending;
                      const next = NEXT_STATUS[ord.status];
                      const typeLabel =
                        ord.type === 'delivery' ? 'Livraison' : ord.type === 'dine_in' ? 'Sur place' : 'À emporter';
                      const elapsed = Math.round((Date.now() - new Date(ord.created_at).getTime()) / 60000);
                      const elapsedLabel =
                        elapsed < 60 ? `${elapsed} min` : `${Math.floor(elapsed / 60)}h${String(elapsed % 60).padStart(2, '0')}`;
                      const isUrgent = elapsed > 20 && ['pending', 'accepted', 'confirmed', 'preparing'].includes(ord.status);
                      return (
                        <motion.div
                          key={ord.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="group relative rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                          style={{
                            border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.3)' : 'var(--restaurant-card-border)'}`,
                            background: isUrgent ? 'rgba(239,68,68,0.05)' : 'var(--r-surface)',
                          }}
                        >
                          {/* Status indicator bar */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.dot}`} />
                          
                          <div className="flex items-center justify-between gap-3 pl-4 pr-3 py-3 sm:py-3.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm sm:text-base font-bold tabular-nums" style={{ color: 'var(--r-text)' }}>
                                  #{ord.order_number || ord.id.slice(0, 6).toUpperCase()}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] sm:text-[11px] font-bold ${s.bg} ${s.text}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${ord.status === 'pending' ? 'animate-pulse' : ''}`} />
                                  {s.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs" style={{ color: 'var(--r-text-muted)' }}>
                                  {ord.type === 'delivery' && <Bike className="w-3 h-3" />}
                                  {typeLabel}
                                </span>
                                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--r-text-subtle)' }} />
                                <span className="text-[11px] sm:text-xs font-medium" style={{ color: 'var(--r-text)' }}>
                                  {ord.customer_name || 'Client'}
                                </span>
                                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--r-text-subtle)' }} />
                                <span className="text-[11px] sm:text-xs font-bold tabular-nums text-orange-500">
                                  {formatFCFA(ord.total_amount || ord.total || 0)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold ${isUrgent ? 'bg-red-500/15 text-red-400' : ''}`} style={!isUrgent ? { background: 'var(--r-surface)', color: 'var(--r-text-subtle)' } : undefined}>
                                <Clock className="w-3 h-3" />
                                {elapsedLabel}
                              </div>
                              {next && (
                                <button
                                  className="shrink-0 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                                  onClick={() => handleUpdateStatus(ord.id, next)}
                                >
                                  {SHORT_ACTION[ord.status] || 'Action'}
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right column: Menu + Équipe - Premium Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4"
        >

          {/* Menu summary - Premium */}
          <div
            className="group rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            style={{
              background: 'var(--restaurant-card)',
              border: '1px solid var(--restaurant-card-border)',
              boxShadow: 'var(--r-card-shadow)',
            }}
          >
            <div
              className="px-4 sm:px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--restaurant-card-border)' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-500">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--r-text)' }}>
                  Menu
                </h3>
              </div>
              <Link
                to="/restaurant/dashboard/menu"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 transition-all"
              >
                Gérer <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                  className="rounded-xl px-3 py-3 transition-colors"
                  style={{ background: 'var(--r-surface)' }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--r-text-muted)' }}>
                    Plats
                  </p>
                  <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-1" style={{ color: 'var(--r-text)' }}>
                    {menuStats.itemCount}
                  </p>
                </div>
                <div
                  className="rounded-xl px-3 py-3 transition-colors"
                  style={{ background: 'var(--r-surface)' }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--r-text-muted)' }}>
                    Catégories
                  </p>
                  <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-1" style={{ color: 'var(--r-text)' }}>
                    {menuStats.categoryCount}
                  </p>
                </div>
              </div>
              {menuStats.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {menuStats.categories.slice(0, 6).map((cat) => (
                    <span
                      key={cat}
                      className="rounded-lg px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold transition-colors hover:bg-orange-500/10"
                      style={{
                        background: 'var(--r-surface)',
                        color: 'var(--r-text-muted)',
                        border: '1px solid var(--restaurant-card-border)',
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Team summary - Premium */}
          <div
            className="group rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            style={{
              background: 'var(--restaurant-card)',
              border: '1px solid var(--restaurant-card-border)',
              boxShadow: 'var(--r-card-shadow)',
            }}
          >
            <div
              className="px-4 sm:px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--restaurant-card-border)' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-500">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--r-text)' }}>
                  Équipe
                </h3>
              </div>
              <Link
                to="/restaurant/dashboard/team"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-sky-500 bg-sky-500/10 hover:bg-sky-500/20 transition-all"
              >
                Gérer <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="p-4 sm:p-5">
              {team.length === 0 && livreurs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: 'var(--r-surface)', border: '1px solid var(--restaurant-card-border)' }}
                  >
                    <Users className="w-6 h-6" style={{ color: 'var(--r-text-subtle)' }} />
                  </div>
                  <p className="text-xs font-medium" style={{ color: 'var(--r-text-subtle)' }}>
                    Aucun membre dans l'équipe
                  </p>
                  <Link
                    to="/restaurant/dashboard/team"
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-sky-500 bg-sky-500/10 hover:bg-sky-500/20 transition-all"
                  >
                    + Inviter un membre
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {team.slice(0, 3).map((m) => (
                    <div
                      key={m.id}
                      className="group/member flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 hover:bg-[var(--r-surface)]"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold bg-sky-500/15 text-sky-500 ring-1 ring-sky-500/20">
                        {(m.profile?.full_name || 'M')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold leading-tight" style={{ color: 'var(--r-text)' }}>
                          {m.profile?.full_name || 'Membre'}
                        </p>
                        <p className="text-[10px] sm:text-[11px] capitalize mt-0.5 font-medium" style={{ color: 'var(--r-text-subtle)' }}>
                          {m.role}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.is_active ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-zinc-500/50'}`} />
                        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: m.is_active ? 'rgb(16 185 129)' : 'var(--r-text-subtle)' }}>
                          {m.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {livreurs.slice(0, 2).map((l) => (
                    <div
                      key={l.id}
                      className="group/member flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 hover:bg-[var(--r-surface)]"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500 ring-1 ring-violet-500/20">
                        <Bike className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold leading-tight" style={{ color: 'var(--r-text)' }}>
                          {l.name || 'Livreur'}
                        </p>
                        <p className="text-[10px] sm:text-[11px] mt-0.5 font-medium" style={{ color: 'var(--r-text-subtle)' }}>
                          {l.phone || 'Pas de téléphone'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${l.is_available ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-500 shadow-sm shadow-amber-500/50'}`} />
                        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: l.is_available ? 'rgb(16 185 129)' : 'rgb(245 158 11)' }}>
                          {l.is_available ? 'Dispo' : 'Occupé'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
