import React, { useState } from 'react';
import {
  DollarSign, ShoppingBag, Activity,
  ArrowUpRight, RefreshCw, Users, Utensils,
  Timer, ChefHat, XCircle, Hourglass,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '../../lib/utils';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';

function formatFCFA(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M FCFA`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k FCFA`;
  return `${v} FCFA`;
}

function formatTrend(growth: number | null | undefined) {
  if (growth == null) return null;
  return growth >= 0 ? `+${growth}%` : `${growth}%`;
}

function formatDuration(sec: number | null) {
  if (sec == null) return '—';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

function formatPercent(p: number) {
  return `${(p * 100).toFixed(1)}%`;
}

export default function Analytics() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id;
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');
  
  const { data, loading, error } = useAnalyticsData(
    restaurantId, 
    timeRange === '7d' ? 7 : 30
  );

  if (loading) return <RestafyLoader message="Analyse des performances..." />;

  const stats = [
    {
      label: 'Revenu Total',
      value: formatFCFA(data?.revenue || 0),
      icon: DollarSign,
      trend: formatTrend(data?.revenueGrowth),
      positive: (data?.revenueGrowth ?? 0) >= 0,
      color: 'text-orange-500',
    },
    {
      label: 'Commandes',
      value: data?.orders || 0,
      icon: ShoppingBag,
      trend: formatTrend(data?.ordersGrowth),
      positive: (data?.ordersGrowth ?? 0) >= 0,
      color: 'text-blue-500',
    },
    {
      label: 'Panier Moyen',
      value: formatFCFA(data?.avgOrderValue || 0),
      icon: Activity,
      trend: null,
      positive: true,
      color: 'text-emerald-500',
    },
    {
      label: 'Clients Uniques',
      value: data?.customersCount || 0,
      icon: Users,
      trend: null,
      positive: true,
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Analytique</h1>
          <p className="text-zinc-500 text-sm">Suivez les performances de votre restaurant</p>
        </div>
        
        <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 self-start">
          {(['7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                timeRange === r ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {r === '7d' ? '7 Jours' : '30 Jours'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-sm flex items-center gap-3">
          <Activity className="w-5 h-5" />
          {error.message || 'Erreur lors du chargement des données'}
        </div>
      )}

      {/* OMS metrics — opérationnel cuisine */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
          Performance opérationnelle
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: 'Délai accept.',
              value: formatDuration(data?.avgAcceptLagSec ?? null),
              hint: data?.avgAcceptLagSec == null ? 'Pas assez de data' : 'pending → acceptée',
              icon: Hourglass,
              tone: 'text-amber-400 bg-amber-500/15',
            },
            {
              label: 'Temps prep.',
              value: formatDuration(data?.avgPrepTimeSec ?? null),
              hint: data?.avgPrepTimeSec == null ? 'Pas assez de data' : 'preparing → ready',
              icon: ChefHat,
              tone: 'text-orange-400 bg-orange-500/15',
            },
            {
              label: 'Taux annulation',
              value: data ? formatPercent(data.cancelRate) : '—',
              hint: data ? `${data.cancelledCount} annulée${data.cancelledCount > 1 ? 's' : ''}` : '',
              icon: XCircle,
              tone: (data?.cancelRate ?? 0) > 0.1 ? 'text-red-400 bg-red-500/15' : 'text-zinc-300 bg-zinc-700/30',
            },
            {
              label: 'Tendance CA',
              value: formatTrend(data?.revenueGrowth) ?? '—',
              hint: data?.revenueGrowth == null
                ? 'vs période précédente'
                : (data.revenueGrowth >= 0 ? 'vs période précédente' : 'à surveiller'),
              icon: Timer,
              tone: (data?.revenueGrowth ?? 0) >= 0 ? 'text-emerald-400 bg-emerald-500/15' : 'text-red-400 bg-red-500/15',
            },
          ].map((m) => (
            <div key={m.label} className="r-admin-card p-4 flex items-start gap-3">
              <div className={cn('p-2 rounded-xl shrink-0', m.tone)}>
                <m.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 truncate">{m.label}</div>
                <div className="text-lg sm:text-xl font-black text-zinc-100 leading-tight tabular-nums">{m.value}</div>
                {m.hint && <div className="text-[10px] text-zinc-500 truncate">{m.hint}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="r-admin-card p-5 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
              <s.icon className={cn("w-12 h-12", s.color)} />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("p-2 rounded-xl bg-opacity-10", s.color.replace('text', 'bg'))}>
                <s.icon className={cn("w-4 h-4", s.color)} />
              </div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{s.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-zinc-100">{s.value}</span>
              {s.trend && (
                <span className={cn(
                  "text-[10px] font-bold flex items-center",
                  s.positive ? 'text-emerald-500' : 'text-red-400'
                )}>
                  <ArrowUpRight className="w-3 h-3" /> {s.trend}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 r-admin-card p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-black text-zinc-100 uppercase tracking-wider">Évolution des Revenus</h3>
              <p className="text-xs text-zinc-500 mt-1">Revenus quotidiens sur la période</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-zinc-500 uppercase">Total Période</p>
              <p className="text-xl font-black text-orange-500">{formatFCFA(data?.revenue || 0)}</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.periodSales || []}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F27D26" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F27D26" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(v) => v.split('-').slice(1).reverse().join('/')}
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(v) => formatFCFA(v)}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#F27D26', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#F27D26" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Items */}
        <div className="r-admin-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Utensils className="w-5 h-5 text-orange-500" />
            <h3 className="text-sm font-black text-zinc-100 uppercase tracking-wider">Top 5 Articles</h3>
          </div>
          
          <div className="space-y-5">
            {data?.topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-4 group">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 group-hover:bg-zinc-700 transition-colors">
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-200 truncate group-hover:text-orange-400 transition-colors">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.revenue / (data?.topItems[0]?.revenue || 1)) * 100}%` }}
                        className="h-full bg-orange-500 rounded-full"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 whitespace-nowrap">
                      {item.quantity} vendus
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-zinc-100">{formatFCFA(item.revenue)}</p>
                </div>
              </div>
            ))}

            {(!data?.topItems || data.topItems.length === 0) && (
              <div className="py-10 text-center">
                <p className="text-zinc-500 text-sm italic">Aucune donnée de vente</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
