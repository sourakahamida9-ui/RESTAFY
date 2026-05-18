// src/components/admin/LiveDashboard.tsx
// Dashboard Live - CA temps reel, commandes live, alertes

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, Clock, Users,
  Bell, AlertTriangle, CheckCircle2, Zap, Activity, ArrowUp, ArrowDown,
  Volume2, VolumeX, Eye, EyeOff, Maximize2, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { playNotificationSound } from '@/lib/notifications';

interface LiveStats {
  todayRevenue: number;
  todayOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  avgPrepTime: number;
  revenueChange: number;
  ordersChange: number;
  peakHour: string;
  activeCustomers: number;
}

interface LiveOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  type: string;
  customer_name?: string;
  items_count: number;
  elapsed_minutes: number;
  is_urgent: boolean;
}

interface Props {
  restaurantId: string;
  onOrderClick?: (orderId: string) => void;
}

export function LiveDashboard({ restaurantId, onOrderClick }: Props) {
  const [stats, setStats] = useState<LiveStats>({
    todayRevenue: 0,
    todayOrders: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    avgPrepTime: 0,
    revenueChange: 0,
    ordersChange: 0,
    peakHour: '--',
    activeCustomers: 0,
  });
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  const playOrderSound = useCallback(() => {
    if (soundEnabled) playNotificationSound('order');
  }, [soundEnabled]);

  // Charger les stats en temps reel
  const fetchStats = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Commandes du jour
    const { data: todayOrders } = await supabase
      .from('orders')
      .select('id, total_amount, status, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', today.toISOString());

    // Commandes d'hier (pour comparaison)
    const { data: yesterdayOrders } = await supabase
      .from('orders')
      .select('id, total_amount')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString());

    const todayTotal = todayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const yesterdayTotal = yesterdayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    
    const pendingCount = todayOrders?.filter(o => o.status === 'pending').length || 0;
    const preparingCount = todayOrders?.filter(o => ['preparing', 'accepted', 'confirmed'].includes(o.status)).length || 0;
    const readyCount = todayOrders?.filter(o => o.status === 'ready').length || 0;

    // Calculer le changement en pourcentage
    const revenueChange = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : 0;
    const ordersChange = yesterdayOrders?.length ? (((todayOrders?.length || 0) - yesterdayOrders.length) / yesterdayOrders.length) * 100 : 0;

    // Heure de pointe
    const hourCounts: Record<number, number> = {};
    todayOrders?.forEach(o => {
      const hour = new Date(o.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

    setStats({
      todayRevenue: todayTotal,
      todayOrders: todayOrders?.length || 0,
      pendingOrders: pendingCount,
      preparingOrders: preparingCount,
      readyOrders: readyCount,
      avgPrepTime: 18, // TODO: calculer depuis les donnees reelles
      revenueChange,
      ordersChange,
      peakHour: peakHour ? `${peakHour[0]}h` : '--',
      activeCustomers: new Set(todayOrders?.map(o => o.id)).size,
    });

    setLastUpdate(new Date());
  }, [restaurantId]);

  // Charger les commandes actives
  const fetchLiveOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, total_amount, created_at, type,
        customer:customer_id (full_name),
        order_items (id)
      `)
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'accepted', 'confirmed', 'preparing', 'ready', 'delivering'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      const orders: LiveOrder[] = data.map(o => {
        const elapsed = Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000);
        return {
          id: o.id,
          order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
          status: o.status,
          total_amount: o.total_amount || 0,
          created_at: o.created_at,
          type: o.type || 'delivery',
          customer_name: (o.customer as any)?.full_name || 'Client',
          items_count: o.order_items?.length || 0,
          elapsed_minutes: elapsed,
          is_urgent: elapsed > 20 && ['pending', 'preparing'].includes(o.status),
        };
      });
      setLiveOrders(orders);
    }
  }, [restaurantId]);

  // Subscription realtime
  useEffect(() => {
    fetchStats();
    fetchLiveOrders();

    const channel = supabase
      .channel(`live-dashboard-${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          playOrderSound();
          toast.success('Nouvelle commande!', { duration: 3000 });
        }
        fetchStats();
        fetchLiveOrders();
      })
      .subscribe();

    // Rafraichir toutes les 30 secondes
    const interval = setInterval(() => {
      fetchStats();
      fetchLiveOrders();
    }, 30000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [restaurantId, fetchStats, fetchLiveOrders, playOrderSound]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatCurrency = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return v.toLocaleString('fr-FR');
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'En attente', color: 'text-amber-600', bg: 'bg-amber-500' },
    accepted: { label: 'Acceptee', color: 'text-blue-600', bg: 'bg-blue-500' },
    confirmed: { label: 'Confirmee', color: 'text-blue-600', bg: 'bg-blue-500' },
    preparing: { label: 'En cuisine', color: 'text-orange-600', bg: 'bg-orange-500' },
    ready: { label: 'Prete', color: 'text-green-600', bg: 'bg-green-500' },
    delivering: { label: 'Livraison', color: 'text-purple-600', bg: 'bg-purple-500' },
  };

  return (
    <div ref={containerRef} className={`${isFullscreen ? 'bg-zinc-950 p-6' : ''}`}>
      {/* Header avec controles */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className="w-6 h-6 text-emerald-500" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black text-zinc-900">Dashboard Live</h2>
            <p className="text-xs text-zinc-400">
              Mis a jour: {lastUpdate.toLocaleTimeString('fr-FR')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchStats(); fetchLiveOrders(); }}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 transition-colors"
            title="Rafraichir"
          >
            <RefreshCw className="w-4 h-4 text-zinc-600" />
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl transition-colors ${soundEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}
            title={soundEnabled ? 'Desactiver le son' : 'Activer le son'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 transition-colors"
            title="Plein ecran"
          >
            <Maximize2 className="w-4 h-4 text-zinc-600" />
          </button>
        </div>
      </div>

      {/* KPIs en temps reel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* CA du jour */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10" />
          <DollarSign className="w-8 h-8 mb-2 opacity-80" />
          <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">CA Aujourd'hui</p>
          <p className="text-3xl font-black">{formatCurrency(stats.todayRevenue)} F</p>
          <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${stats.revenueChange >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
            {stats.revenueChange >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(stats.revenueChange).toFixed(1)}% vs hier
          </div>
        </motion.div>

        {/* Commandes du jour */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm"
        >
          <ShoppingBag className="w-8 h-8 mb-2 text-blue-500" />
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Commandes</p>
          <p className="text-3xl font-black text-zinc-900">{stats.todayOrders}</p>
          <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${stats.ordersChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {stats.ordersChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(stats.ordersChange).toFixed(0)}% vs hier
          </div>
        </motion.div>

        {/* En attente */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`rounded-2xl p-5 border shadow-sm ${stats.pendingOrders > 3 ? 'bg-amber-50 border-amber-200' : 'bg-white border-zinc-100'}`}
        >
          <Bell className={`w-8 h-8 mb-2 ${stats.pendingOrders > 3 ? 'text-amber-500 animate-bounce' : 'text-amber-400'}`} />
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">En attente</p>
          <p className={`text-3xl font-black ${stats.pendingOrders > 3 ? 'text-amber-600' : 'text-zinc-900'}`}>
            {stats.pendingOrders}
          </p>
          {stats.pendingOrders > 3 && (
            <p className="text-xs text-amber-600 font-bold mt-1">Attention!</p>
          )}
        </motion.div>

        {/* En cuisine */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm"
        >
          <Clock className="w-8 h-8 mb-2 text-orange-500" />
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">En cuisine</p>
          <p className="text-3xl font-black text-zinc-900">{stats.preparingOrders}</p>
          <p className="text-xs text-zinc-400 mt-1">~{stats.avgPrepTime} min moy.</p>
        </motion.div>
      </div>

      {/* File des commandes live */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-zinc-900">Commandes en cours</h3>
            <span className="px-2 py-0.5 bg-zinc-100 rounded-full text-xs font-bold text-zinc-600">
              {liveOrders.length}
            </span>
          </div>
        </div>

        <div className="divide-y divide-zinc-50 max-h-[400px] overflow-y-auto">
          <AnimatePresence>
            {liveOrders.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                <p className="text-zinc-400 font-medium">Aucune commande en cours</p>
              </div>
            ) : (
              liveOrders.map((order, i) => {
                const config = statusConfig[order.status] || statusConfig.pending;
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => onOrderClick?.(order.id)}
                    className={`px-5 py-4 hover:bg-zinc-50 cursor-pointer transition-colors ${order.is_urgent ? 'bg-red-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                          <span className="text-white text-xs font-black">
                            #{order.order_number.slice(-3)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-zinc-900">#{order.order_number}</p>
                            {order.is_urgent && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded">
                                URGENT
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">
                            {order.customer_name} - {order.items_count} article{order.items_count > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-zinc-900">{order.total_amount.toLocaleString('fr-FR')} F</p>
                        <p className={`text-xs font-bold ${order.elapsed_minutes > 15 ? 'text-red-500' : 'text-zinc-400'}`}>
                          {order.elapsed_minutes} min
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default LiveDashboard;
