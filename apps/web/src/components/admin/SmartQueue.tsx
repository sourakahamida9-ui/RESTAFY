// src/components/admin/SmartQueue.tsx
// Chrono + File d'attente intelligente avec priorite auto et alertes depassement

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Clock, AlertTriangle, CheckCircle2, ChefHat, Bike, Timer,
  Flame, Zap, GripVertical, Play, Pause, RotateCcw, Bell,
  ArrowRight, Package, Users, TrendingUp, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { playNotificationSound } from '@/lib/notifications';

interface QueueOrder {
  id: string;
  order_number: string;
  status: string;
  type: 'delivery' | 'dine_in' | 'takeaway';
  total_amount: number;
  created_at: string;
  items: { name: string; quantity: number }[];
  customer_name?: string;
  priority: number; // 1=urgent, 2=normal, 3=low
  elapsed_seconds: number;
  estimated_prep_time: number;
  is_overdue: boolean;
  chrono_running: boolean;
  chrono_started_at?: string;
}

interface Props {
  restaurantId: string;
  onOrderUpdate?: (orderId: string, newStatus: string) => void;
}

const PRIORITY_CONFIG = {
  1: { label: 'URGENT', color: 'bg-red-500', border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-700' },
  2: { label: 'NORMAL', color: 'bg-blue-500', border: 'border-blue-200', bg: 'bg-white', text: 'text-blue-600' },
  3: { label: 'BASSE', color: 'bg-zinc-400', border: 'border-zinc-200', bg: 'bg-zinc-50', text: 'text-zinc-600' },
};

const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered'];

export function SmartQueue({ restaurantId, onOrderUpdate }: Props) {
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ avgTime: 0, overdueCount: 0, totalActive: 0 });
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // Calculer la priorite automatique
  const calculatePriority = (order: any): number => {
    const elapsed = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);
    const itemCount = order.order_items?.length || 0;

    // URGENT: >15 min d'attente OU livraison avec >20 min
    if (elapsed > 15 || (order.type === 'delivery' && elapsed > 12)) return 1;
    
    // BASSE: Takeaway avec peu d'articles et <5 min
    if (order.type === 'takeaway' && itemCount <= 2 && elapsed < 5) return 3;
    
    // NORMAL: par defaut
    return 2;
  };

  // Estimer le temps de preparation
  const estimatePrepTime = (order: any): number => {
    const itemCount = order.order_items?.length || 1;
    const baseTime = 8; // 8 minutes de base
    return baseTime + (itemCount * 3); // +3 min par article
  };

  // Charger la file d'attente
  const fetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, type, total_amount, created_at,
        customer:customer_id (full_name),
        order_items (item_name, quantity)
      `)
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'accepted', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (data) {
      const orders: QueueOrder[] = data.map(o => {
        const elapsed = Math.round((Date.now() - new Date(o.created_at).getTime()) / 1000);
        const estimatedTime = estimatePrepTime(o);
        const priority = calculatePriority(o);
        
        return {
          id: o.id,
          order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
          status: o.status,
          type: o.type || 'delivery',
          total_amount: o.total_amount || 0,
          created_at: o.created_at,
          items: o.order_items?.map((i: any) => ({ name: i.item_name, quantity: i.quantity })) || [],
          customer_name: (o.customer as any)?.full_name || 'Client',
          priority,
          elapsed_seconds: elapsed,
          estimated_prep_time: estimatedTime,
          is_overdue: elapsed / 60 > estimatedTime,
          chrono_running: ['preparing'].includes(o.status),
          chrono_started_at: o.status === 'preparing' ? o.created_at : undefined,
        };
      });

      // Trier par priorite puis par temps d'attente
      orders.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.elapsed_seconds - a.elapsed_seconds;
      });

      setQueue(orders);
      
      // Stats
      const overdueCount = orders.filter(o => o.is_overdue).length;
      const avgTime = orders.length > 0 
        ? Math.round(orders.reduce((sum, o) => sum + o.elapsed_seconds, 0) / orders.length / 60)
        : 0;
      setStats({ avgTime, overdueCount, totalActive: orders.length });
    }
    setLoading(false);
  }, [restaurantId]);

  // Tick pour mettre a jour les chronos
  useEffect(() => {
    fetchQueue();

    tickRef.current = setInterval(() => {
      setQueue(prev => prev.map(o => ({
        ...o,
        elapsed_seconds: Math.round((Date.now() - new Date(o.created_at).getTime()) / 1000),
        is_overdue: (Date.now() - new Date(o.created_at).getTime()) / 60000 > o.estimated_prep_time,
      })));
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [fetchQueue]);

  // Subscription realtime
  useEffect(() => {
    const channel = supabase
      .channel(`smart-queue-${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [restaurantId, fetchQueue]);

  // Alerte sonore pour commandes en retard
  useEffect(() => {
    const overdueOrders = queue.filter(o => o.is_overdue && o.status !== 'ready');
    if (overdueOrders.length > 0) {
      // Jouer un son d'alerte toutes les 30 secondes pour les commandes en retard
      const shouldAlert = overdueOrders.some(o => o.elapsed_seconds % 30 < 2);
      if (shouldAlert) {
        playNotificationSound('alert');
      }
    }
  }, [queue]);

  // Changer le statut d'une commande
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      toast.error('Erreur lors de la mise a jour');
    } else {
      toast.success(`Commande ${newStatus === 'preparing' ? 'en cuisine' : newStatus === 'ready' ? 'prete' : 'mise a jour'}`);
      onOrderUpdate?.(orderId, newStatus);
      fetchQueue();
    }
  };

  // Formatter le temps
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Obtenir le prochain statut
  const getNextStatus = (current: string) => {
    const idx = STATUS_FLOW.indexOf(current);
    return idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  const getNextLabel = (current: string) => {
    const labels: Record<string, string> = {
      pending: 'Accepter',
      confirmed: 'Demarrer',
      preparing: 'Pret!',
      ready: 'Livrer',
    };
    return labels[current] || 'Suivant';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-zinc-900">{stats.totalActive}</p>
              <p className="text-xs text-zinc-400 font-medium">En file</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-zinc-900">{stats.avgTime}<span className="text-sm font-bold text-zinc-400">min</span></p>
              <p className="text-xs text-zinc-400 font-medium">Temps moyen</p>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl p-4 border shadow-sm ${stats.overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-zinc-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.overdueCount > 0 ? 'bg-red-100' : 'bg-zinc-100'}`}>
              <AlertTriangle className={`w-5 h-5 ${stats.overdueCount > 0 ? 'text-red-600 animate-pulse' : 'text-zinc-400'}`} />
            </div>
            <div>
              <p className={`text-2xl font-black ${stats.overdueCount > 0 ? 'text-red-600' : 'text-zinc-900'}`}>{stats.overdueCount}</p>
              <p className="text-xs text-zinc-400 font-medium">En retard</p>
            </div>
          </div>
        </div>
      </div>

      {/* Queue */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            <h3 className="font-black text-zinc-900">File d'attente intelligente</h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded-lg font-bold">
              <Flame className="w-3 h-3" /> Urgent
            </span>
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-600 rounded-lg font-bold">
              Normal
            </span>
            <span className="flex items-center gap-1 px-2 py-1 bg-zinc-100 text-zinc-500 rounded-lg font-bold">
              Basse
            </span>
          </div>
        </div>

        <div className="divide-y divide-zinc-50">
          <AnimatePresence>
            {queue.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-200 mx-auto mb-4" />
                <p className="text-zinc-400 font-medium text-lg">Aucune commande en attente</p>
                <p className="text-zinc-300 text-sm">Les nouvelles commandes apparaitront ici</p>
              </div>
            ) : (
              queue.map((order, index) => {
                const config = PRIORITY_CONFIG[order.priority as keyof typeof PRIORITY_CONFIG];
                const nextStatus = getNextStatus(order.status);
                const isSelected = selectedOrder === order.id;

                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: index * 0.05 }}
                    className={`relative ${config.bg} ${order.is_overdue ? 'bg-red-50' : ''}`}
                  >
                    {/* Priority indicator */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${config.color}`} />

                    <div 
                      className="px-5 py-4 pl-6 cursor-pointer hover:bg-black/5 transition-colors"
                      onClick={() => setSelectedOrder(isSelected ? null : order.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Position */}
                          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
                            <span className="text-white text-sm font-black">{index + 1}</span>
                          </div>

                          {/* Chrono */}
                          <div className={`min-w-[80px] text-center py-2 px-3 rounded-xl font-mono ${order.is_overdue ? 'bg-red-500 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
                            <div className="flex items-center justify-center gap-1">
                              <Timer className="w-4 h-4" />
                              <span className="text-lg font-black">
                                {formatTime(order.elapsed_seconds)}
                              </span>
                            </div>
                            {order.is_overdue && (
                              <p className="text-[10px] font-bold mt-0.5">EN RETARD</p>
                            )}
                          </div>

                          {/* Order info */}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-black text-zinc-900">#{order.order_number}</p>
                              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${config.color} text-white`}>
                                {config.label}
                              </span>
                              <span className="text-xs text-zinc-400">
                                {order.type === 'delivery' ? '🛵' : order.type === 'dine_in' ? '🍽️' : '🥡'}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {order.customer_name} - {order.items.length} article{order.items.length > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Status badge */}
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                            order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            order.status === 'preparing' ? 'bg-orange-100 text-orange-700' :
                            order.status === 'ready' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {order.status === 'pending' ? 'En attente' :
                             order.status === 'preparing' ? 'En cuisine' :
                             order.status === 'ready' ? 'Pret' : 'Confirme'}
                          </span>

                          {/* Prix */}
                          <p className="font-black text-zinc-900 min-w-[100px] text-right">
                            {order.total_amount.toLocaleString('fr-FR')} F
                          </p>

                          {/* Action button */}
                          {nextStatus && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateOrderStatus(order.id, nextStatus);
                              }}
                              className={`px-4 py-2 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 ${
                                order.status === 'pending' ? 'bg-emerald-500 hover:bg-emerald-600' :
                                order.status === 'preparing' ? 'bg-orange-500 hover:bg-orange-600' :
                                'bg-blue-500 hover:bg-blue-600'
                              }`}
                            >
                              {getNextLabel(order.status)}
                              <ArrowRight className="w-4 h-4 inline ml-1" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-4 pt-4 border-t border-zinc-100"
                          >
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Articles</p>
                                <div className="space-y-1">
                                  {order.items.map((item, i) => (
                                    <p key={i} className="text-sm text-zinc-600">
                                      <span className="font-bold">{item.quantity}x</span> {item.name}
                                    </p>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Temps estime</p>
                                <p className="text-lg font-black text-zinc-900">{order.estimated_prep_time} min</p>
                                <div className="mt-2 h-2 bg-zinc-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all ${order.is_overdue ? 'bg-red-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min((order.elapsed_seconds / 60 / order.estimated_prep_time) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
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

export default SmartQueue;
