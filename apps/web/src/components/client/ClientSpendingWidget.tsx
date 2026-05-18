/**
 * =====================================================================
 * CLIENT SPENDING HISTORY - Suivi des dépenses client
 * =====================================================================
 * 
 *收集 Collecte et affiche l'historique des dépenses d'un client.
 * Inclut les informations de paiement (MTN, Moov, etc.)
 * 
 * @author Restafy Team
 * @date 2025-05-05
 * =====================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, TrendingDown, Wallet, CreditCard,
  Receipt, Calendar, Clock, ArrowUpRight,
  Pizza, Coffee, Utensils, ShoppingBag
} from 'lucide-react';

/** Type pour un article dans une commande */
interface OrderItem {
  item_name: string;
  quantity: number;
  unit_price: number;
}

/** Type pour une commande */
interface ClientOrder {
  id: string;
  order_number: string;
  status: string;
  type: 'delivery' | 'dine_in' | 'takeaway';
  total_amount: number;
  payment_method: string | null;
  created_at: string;
  restaurant_id: string;
  restaurants?: { name: string };
  order_items?: OrderItem[];
}

/** Stats résumées */
interface SpendingStats {
  totalSpent: number;
  totalOrders: number;
  averageOrder: number;
  favoriteRestaurant: string | null;
  lastOrderDate: string | null;
  mostUsedPayment: string | null;
}

/**
 * Hook pour récupérer l'historique des commandes client
 */
export function useClientSpendingHistory() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!user?.id) return;
    
    async function fetchOrders() {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, type, total_amount, 
          payment_method, created_at, restaurant_id,
          restaurants(name),
          order_items(item_name, quantity, unit_price)
        `)
        .eq('customer_id', user.id)
        .in('status', ['delivered', 'completed'])
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('[spending] fetch error:', error);
      } else {
        setOrders(data as unknown as ClientOrder[]);
      }
      setLoading(false);
    }
    
    fetchOrders();
  }, [user?.id]);
  
  /** Calcul des stats */
  const stats: SpendingStats = useMemo(() => {
    if (orders.length === 0) {
      return {
        totalSpent: 0,
        totalOrders: 0,
        averageOrder: 0,
        favoriteRestaurant: null,
        lastOrderDate: null,
        mostUsedPayment: null,
      };
    }
    
    const totalSpent = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const paymentCounts: Record<string, number> = {};
    const restaurantCounts: Record<string, number> = {};
    
    orders.forEach(order => {
      // Payment method
      const pm = order.payment_method || 'inconnu';
      paymentCounts[pm] = (paymentCounts[pm] || 0) + 1;
      
      // Restaurant
      const rName = order.restaurants?.name || 'Inconnu';
      restaurantCounts[rName] = (restaurantCounts[rName] || 0) + 1;
    });
    
    // Most used payment
    const mostUsedPayment = Object.entries(paymentCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    
    // Favorite restaurant
    const favoriteRestaurant = Object.entries(restaurantCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    
    return {
      totalSpent,
      totalOrders: orders.length,
      averageOrder: Math.round(totalSpent / orders.length),
      favoriteRestaurant,
      lastOrderDate: orders[0]?.created_at || null,
      mostUsedPayment,
    };
  }, [orders]);
  
  return { orders, stats, loading };
}

/**
 * Composant d'affichage des dépenses client
 */
export function ClientSpendingWidget() {
  const { orders, stats, loading } = useClientSpendingHistory();
  const [expanded, setExpanded] = useState(false);
  
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-zinc-100">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-100 rounded-full" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-zinc-100 rounded" />
            <div className="h-3 w-16 bg-zinc-100 rounded" />
          </div>
        </div>
      </div>
    );
  }
  
  if (stats.totalOrders === 0) {
    return (
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <Utensils className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="font-semibold text-zinc-800">Pas encore de commandes</p>
            <p className="text-sm text-zinc-500">Découvrez nos restaurants!</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
      {/* Header Always Visible */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-zinc-800">
              {stats.totalSpent.toLocaleString('fr-FR')} F
            </p>
            <p className="text-sm text-zinc-500">
              {stats.totalOrders} commande{stats.totalOrders > 1 ? 's' : ''} • Moyenne {stats.averageOrder.toLocaleString()} F
            </p>
          </div>
        </div>
        
        {expanded ? (
          <TrendingUp className="w-5 h-5 text-zinc-400" />
        ) : (
          <TrendingDown className="w-5 h-5 text-zinc-400" />
        )}
      </div>
      
      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-50 pt-3">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-50 rounded-xl p-3">
              <p className="text-xs text-zinc-500">Restaurant favori</p>
              <p className="font-semibold text-zinc-800 truncate">
                {stats.favoriteRestaurant || '—'}
              </p>
            </div>
            <div className="bg-zinc-50 rounded-xl p-3">
              <p className="text-xs text-zinc-500">Paiement</p>
              <p className="font-semibold text-zinc-800">
                {stats.mostUsedPayment === 'mtn' ? 'MTN' : 
                 stats.mostUsedPayment === 'moov' ? 'Moov' :
                 stats.mostUsedPayment || '—'}
              </p>
            </div>
          </div>
          
          {/* Recent Orders */}
          {orders.slice(0, 5).map(order => (
            <div 
              key={order.id}
              className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Receipt className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                <span className="text-sm text-zinc-600 truncate">
                  {order.restaurants?.name || 'Restaurant'}
                </span>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-zinc-800">
                  {order.total_amount?.toLocaleString() || 0} F
                </p>
                <p className="text-xs text-zinc-400">
                  {new Date(order.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          ))}
          
          {/* View All Link */}
          <button className="w-full py-2 text-center text-sm text-orange-600 font-semibold">
            Voir tout l'historique →
          </button>
        </div>
      )}
    </div>
  );
}