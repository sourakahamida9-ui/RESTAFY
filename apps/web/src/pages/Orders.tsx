import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, ChevronRight, Clock, CheckCircle2, Bike, ChefHat, XCircle } from 'lucide-react';

type OrderStatus = string;

type Order = {
  id: string;
  order_number: string;
  status: OrderStatus;
  created_at: string;
  estimated_delivery: string | null;
  total_amount: number;
  restaurant?: { name: string };
  order_items?: { item_name: string; quantity: number }[];
};

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pending: { label: 'En attente', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  accepted: { label: 'Acceptée', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  preparing: { label: 'Préparation', icon: ChefHat, color: 'text-blue-600', bg: 'bg-blue-50' },
  ready: { label: 'Prête', icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50' },
  // 'delivering' removed (not in DB schema)
  delivered: { label: 'Livrée', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cancelled: { label: 'Annulée', icon: XCircle, color: 'text-zinc-400', bg: 'bg-zinc-100' },
};

export default function Orders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'history'>('active');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            restaurant:restaurants!restaurant_id (name),
            order_items (item_name, quantity)
          `)
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!cancelled) setOrders(data || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOrders();

    // Real-time subscription
    const subscription = supabase
      .channel(`orders:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setOrders(prev =>
              prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o)
            );
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [user]);

  const { active, history, displayed } = useMemo(() => {
    const active = orders.filter((o) => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status));
    const history = orders.filter((o) => ['delivered', 'cancelled'].includes(o.status));
    return { active, history, displayed: tab === 'active' ? active : history };
  }, [orders, tab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="px-4 pt-8 pb-4">
        <h1 className="text-3xl font-bold mb-1">My Orders</h1>
        <p className="text-sm text-gray-500">Track all your orders in real-time</p>
      </header>

      {/* Tabs */}
      <div className="px-4 mb-6">
        <div className="bg-gray-200 p-1 rounded-lg flex gap-1">
          {(['active', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded text-sm font-bold transition-all ${tab === t ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
                }`}
            >
              {t === 'active' ? `Active (${active.length})` : `History (${history.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="font-bold text-lg mb-1">
              {tab === 'active' ? 'No active orders' : 'No order history'}
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              {tab === 'active' ? 'Order now!' : 'Your past orders will appear here.'}
            </p>
            {tab === 'active' && (
              <button
                onClick={() => navigate('/')}
                className="bg-orange-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-orange-700"
              >
                Order Now
              </button>
            )}
          </div>
        ) : (
          displayed.map((order) => {
            const cfg = statusConfig[order.status] || statusConfig.pending;
            const Icon = cfg.icon;
            const restaurantName = (order as any).restaurant?.name || 'Restaurant';
            const itemsList = Array.isArray((order as any).order_items)
              ? (order as any).order_items.map((item: any) => `${item.item_name} x${item.quantity}`).join(' • ')
              : 'Order items';

            return (
              <motion.div
                key={order.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => order.status !== 'cancelled' && navigate(`/track/${order.id}`)}
                className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm">Order #{order.order_number}</span>
                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {restaurantName} • {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {order.estimated_delivery && (
                    <div className="text-right text-xs">
                      <p className="text-gray-400">ETA</p>
                      <p className="font-bold text-orange-600">
                        {new Date(order.estimated_delivery).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-600 mb-4 line-clamp-2">{itemsList}</p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="font-bold text-orange-600 text-lg">
                    {order.total_amount.toLocaleString()}₣
                  </span>
                  {order.status !== 'cancelled' && (
                    <button className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700">
                      View <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}