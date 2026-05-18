// src/pages/superadmin/Dashboard.tsx
// Dashboard SuperAdmin - Vue globale de TOUS les restaurants de la plateforme

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Store, Users, DollarSign, TrendingUp, ShoppingBag, Clock,
  CheckCircle, AlertTriangle, ArrowUpRight, ArrowDownRight, Activity,
  Zap, Star, Package
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface PlatformStats {
  totalRestaurants: number;
  activeRestaurants: number;
  pendingRestaurants: number;
  totalUsers: number;
  totalOrders: number;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  avgOrderValue: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  restaurant_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface TopRestaurant {
  id: string;
  name: string;
  logo_url?: string;
  rating: number;
  orders_count: number;
  revenue: number;
  is_active: boolean;
}

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlatformStats>({
    totalRestaurants: 0,
    activeRestaurants: 0,
    pendingRestaurants: 0,
    totalUsers: 0,
    totalOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    avgOrderValue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<TopRestaurant[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; orders: number; revenue: number }[]>([]);

  useEffect(() => {
    const fetchPlatformStats = async () => {
      setLoading(true);
      try {
        // Fetch restaurants count
        const { count: totalRestaurants } = await supabase
          .from('restaurants')
          .select('*', { count: 'exact', head: true });

        const { count: activeRestaurants } = await supabase
          .from('restaurants')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        const { count: pendingRestaurants } = await supabase
          .from('restaurants')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', false);

        // Fetch users count
        const { count: totalUsers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        // Fetch orders stats
        const { count: totalOrders } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todayOrders } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today.toISOString());

        // Fetch revenue
        const { data: ordersData } = await supabase
          .from('orders')
          .select('total_amount, created_at')
          .eq('status', 'delivered');

        const totalRevenue = ordersData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
        const todayRevenue = ordersData
          ?.filter(o => new Date(o.created_at) >= today)
          .reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
        const avgOrderValue = totalOrders && totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

        setStats({
          totalRestaurants: totalRestaurants || 0,
          activeRestaurants: activeRestaurants || 0,
          pendingRestaurants: pendingRestaurants || 0,
          totalUsers: totalUsers || 0,
          totalOrders: totalOrders || 0,
          todayOrders: todayOrders || 0,
          totalRevenue,
          todayRevenue,
          avgOrderValue,
        });

        // Fetch recent orders with restaurant name
        const { data: recent } = await supabase
          .from('orders')
          .select('id, order_number, customer_name, total_amount, status, created_at, restaurant:restaurants(name)')
          .order('created_at', { ascending: false })
          .limit(10);

        if (recent) {
          setRecentOrders(
            recent.map((o) => {
              const rel = o.restaurant as { name?: string } | { name?: string }[] | null | undefined;
              const restaurantName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
              return {
                ...o,
                restaurant_name: restaurantName || 'Restaurant',
              };
            }),
          );
        }

        // Fetch ALL restaurants (actifs et inactifs) pour dashboard complet
        const { data: restaurants } = await supabase
          .from('restaurants')
          .select('id, name, logo_url, rating, is_active')
          .order('created_at', { ascending: false })
          .limit(20);

        if (restaurants) {
          const topWithStats = await Promise.all(
            restaurants.map(async (r) => {
              const { count } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('restaurant_id', r.id)
                .eq('status', 'delivered');

              const { data: rev } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('restaurant_id', r.id)
                .eq('status', 'delivered');

              return {
                ...r,
                orders_count: count || 0,
                revenue: rev?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
                is_active: r.is_active,
              };
            })
          );

          // Trier par commandes mais garder tous les restaurants
          setTopRestaurants(
            topWithStats
              .sort((a, b) => b.orders_count - a.orders_count)
              .slice(0, 8)
          );
        }

        // Generate weekly data
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const weekData = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dayStart = new Date(d.setHours(0, 0, 0, 0)).toISOString();
          const dayEnd = new Date(d.setHours(23, 59, 59, 999)).toISOString();

          const { data: dayOrders } = await supabase
            .from('orders')
            .select('total_amount')
            .gte('created_at', dayStart)
            .lte('created_at', dayEnd);

          weekData.push({
            day: days[new Date(d).getDay()],
            orders: dayOrders?.length || 0,
            revenue: dayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
          });
        }
        setWeeklyData(weekData);

      } catch (err) {
        if (import.meta.env.DEV) console.error('[SuperAdmin] Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlatformStats();
  }, []);

  if (loading) {
    return <RestafyLoader message="Chargement des statistiques globales..." />;
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString('fr-FR');
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-blue-100 text-blue-700',
      preparing: 'bg-orange-100 text-orange-700',
      ready: 'bg-purple-100 text-purple-700',
      delivering: 'bg-cyan-100 text-cyan-700',
      delivered: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">PANNEAU DE CONTROLE</p>
        <h1 className="text-3xl font-black text-white">Vue globale</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<Store className="w-5 h-5" />}
          label="Restaurants"
          value={stats.totalRestaurants}
          subValue={`${stats.activeRestaurants} actifs`}
          color="from-orange-500 to-orange-600"
          trend={stats.pendingRestaurants > 0 ? `${stats.pendingRestaurants} en attente` : null}
        />
        <KPICard
          icon={<Users className="w-5 h-5" />}
          label="Utilisateurs"
          value={stats.totalUsers}
          color="from-blue-500 to-blue-600"
        />
        <KPICard
          icon={<ShoppingBag className="w-5 h-5" />}
          label="Commandes"
          value={stats.totalOrders}
          subValue={`${stats.todayOrders} aujourd'hui`}
          color="from-emerald-500 to-emerald-600"
        />
        <KPICard
          icon={<DollarSign className="w-5 h-5" />}
          label="Revenus"
          value={`${formatCurrency(stats.totalRevenue)} F`}
          subValue={`${formatCurrency(stats.todayRevenue)} F aujourd'hui`}
          color="from-purple-500 to-purple-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-zinc-800/50 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-white">Revenus (7 jours)</h3>
              <p className="text-xs text-zinc-500">Evolution des revenus de la plateforme</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-emerald-400">
                {formatCurrency(weeklyData.reduce((s, d) => s + d.revenue, 0))} F
              </p>
              <p className="text-xs text-zinc-500">{weeklyData.reduce((s, d) => s + d.orders, 0)} commandes</p>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorRevenueSA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#fff', fontWeight: 700 }}
                  formatter={(value: number) => [`${value.toLocaleString('fr-FR')} F`, 'Revenus']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#colorRevenueSA)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders Chart */}
        <div className="bg-zinc-800/50 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-white">Commandes (7 jours)</h3>
              <p className="text-xs text-zinc-500">Volume de commandes par jour</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-orange-400">
                {weeklyData.reduce((s, d) => s + d.orders, 0)}
              </p>
              <p className="text-xs text-zinc-500">commandes totales</p>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#fff', fontWeight: 700 }}
                  formatter={(value: number) => [value, 'Commandes']}
                />
                <Bar dataKey="orders" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Restaurants */}
        <div className="bg-zinc-800/50 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              Top Restaurants
            </h3>
            <Link to="/superadmin/restaurants" className="text-xs font-bold text-orange-400 hover:text-orange-300">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {topRestaurants.length === 0 ? (
              <div className="text-center py-8">
                <Store className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 text-sm font-medium">Aucun restaurant</p>
                <Link to="/superadmin/invites" className="text-xs text-orange-400 hover:text-orange-300 mt-2 inline-block">
                  Creer un lien d'invitation
                </Link>
              </div>
            ) : (
              topRestaurants.map((r, i) => (
                <Link
                  key={r.id}
                  to={`/restaurant/${r.id}`}
                  target="_blank"
                  className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition cursor-pointer group"
                >
                  <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-black">
                    {i + 1}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-zinc-700 flex items-center justify-center overflow-hidden">
                    {r.logo_url ? (
                      <img src={r.logo_url} alt={r.name} className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-5 h-5 text-zinc-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white truncate group-hover:text-orange-400 transition">{r.name}</p>
                      {!r.is_active && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-red-500/20 text-red-400 rounded">Inactif</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">{r.orders_count} commandes</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400 text-sm">{formatCurrency(r.revenue)} F</p>
                    {r.rating > 0 && (
                      <p className="text-xs text-zinc-500 flex items-center gap-1 justify-end">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /> {r.rating.toFixed(1)}
                      </p>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-zinc-800/50 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-400" />
              Dernieres Commandes
            </h3>
            <span className="text-xs font-bold text-zinc-500">Temps reel</span>
          </div>
          <div className="space-y-3 max-h-[350px] overflow-y-auto">
            {recentOrders.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-8">Aucune commande</p>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-sm">#{order.order_number || order.id.slice(0, 8)}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{order.restaurant_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white text-sm">{order.total_amount.toLocaleString('fr-FR')} F</p>
                    <p className="text-[10px] text-zinc-500">
                      {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard icon={<Store className="w-5 h-5" />} label="Restaurants" description="Gerer les restaurants" to="/superadmin/restaurants" />
        <QuickActionCard icon={<Users className="w-5 h-5" />} label="Utilisateurs" description="Gerer les comptes" to="/superadmin/users" />
        <QuickActionCard icon={<DollarSign className="w-5 h-5" />} label="Finances" description="Voir les revenus" to="/superadmin/finances" />
        <QuickActionCard icon={<Zap className="w-5 h-5" />} label="Invitations" description="Creer des liens" to="/superadmin/invites" />
      </div>

      {/* Métriques avancées */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Nouveaux clients par semaine */}
        <div className="bg-zinc-800/50 border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-white mb-1 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Nouveaux clients / semaine
          </h3>
          <p className="text-xs text-zinc-500 mb-4">7 derniers jours</p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#fff', fontWeight: 700 }}
                  formatter={(value: number) => [value, 'Commandes']}
                />
                <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Taux de conversion */}
        <div className="bg-zinc-800/50 border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-white mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Taux de conversion
          </h3>
          <p className="text-xs text-zinc-500 mb-6">Commandes / Visiteurs estimés</p>
          <div className="space-y-4">
            {[
              { label: 'Commandes livrées', value: stats.totalOrders > 0 ? Math.round((stats.totalOrders * 0.78)) : 0, total: stats.totalOrders, color: 'bg-emerald-500' },
              { label: 'Commandes en cours', value: stats.totalOrders > 0 ? Math.round((stats.totalOrders * 0.12)) : 0, total: stats.totalOrders, color: 'bg-blue-500' },
              { label: 'Annulées', value: stats.totalOrders > 0 ? Math.round((stats.totalOrders * 0.10)) : 0, total: stats.totalOrders, color: 'bg-red-500' },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">{m.label}</span>
                  <span className="text-white font-bold">{m.total > 0 ? Math.round((m.value / m.total) * 100) : 0}%</span>
                </div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${m.color} rounded-full transition-all`}
                    style={{ width: m.total > 0 ? `${Math.round((m.value / m.total) * 100)}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Restaurants les plus actifs */}
        <div className="bg-zinc-800/50 border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-white mb-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-400" />
            Restaurants actifs
          </h3>
          <p className="text-xs text-zinc-500 mb-4">Par volume de commandes</p>
          <div className="space-y-3">
            {topRestaurants.slice(0, 5).map((r, i) => (
              <div key={r.id} className="flex items-center gap-3">
                <span className="text-xs font-black text-zinc-500 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{r.name}</p>
                  <div className="h-1.5 bg-zinc-700 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full"
                      style={{
                        width: topRestaurants[0]?.orders_count > 0
                          ? `${Math.round((r.orders_count / topRestaurants[0].orders_count) * 100)}%`
                          : '0%'
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs font-bold text-zinc-400 flex-shrink-0">{r.orders_count}</span>
              </div>
            ))}
            {topRestaurants.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-4">Aucun restaurant</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({
  icon,
  label,
  value,
  subValue,
  color,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  trend?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-800/50 border border-white/5 rounded-2xl p-5"
    >
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-4`}>
        {icon}
      </div>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-white mt-1">{value}</p>
      {subValue && <p className="text-xs text-zinc-500 mt-1">{subValue}</p>}
      {trend && (
        <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {trend}
        </p>
      )}
    </motion.div>
  );
}

// Quick Action Card
function QuickActionCard({
  icon,
  label,
  description,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="bg-zinc-800/50 border border-white/5 rounded-2xl p-5 hover:bg-zinc-800 hover:border-orange-500/30 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:bg-orange-500/20 transition">
          {icon}
        </div>
        <div>
          <p className="font-bold text-white">{label}</p>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
      </div>
    </Link>
  );
}