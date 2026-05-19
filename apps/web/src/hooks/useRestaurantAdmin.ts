// src/hooks/useRestaurantAdmin.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import {
  fetchRestaurantOrdersWithItems,
  type OrderItemLine,
  type OrderWithItems,
} from '@/lib/restaurantOrdersQuery';
import { formatSupabaseErr } from '@/lib/formatSupabaseError';

type Order = Database['public']['Tables']['orders']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];

export type { OrderItemLine, OrderWithItems };

interface OrderCustomer {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
}

const ANALYTICS_TIMEOUT_MS = 35_000;

const withTimeout = <T>(promise: PromiseLike<T>, ms: number): Promise<T> =>
  Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Requête trop longue')), ms)
    ),
  ]);

// ─── useRestaurantOrders (Admin) ───────────────────────────────────────────────

export function useRestaurantOrders(restaurantId: string | null | undefined) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  const refetch = useCallback(() => {
    setError(null);
    setLoading(true);
    setRefetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!restaurantId) {
      if (import.meta.env.DEV) console.warn('[useRestaurantOrders] restaurantId est null — aucune commande ne sera chargée. Vérifiez que le profil a un restaurant_id.');
      setOrders([]);
      setLoading(false);
      setError(null);
      return;
    }

    let mounted = true;
    setLoading(true);

    const fetchOrders = async () => {
      try {
        setError(null);
        const list = await fetchRestaurantOrdersWithItems(restaurantId, 100);
        if (import.meta.env.DEV) console.log(`[useRestaurantOrders] ${list.length} commande(s) pour ${restaurantId}`);
        if (mounted) setOrders(list);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[useRestaurantOrders] Erreur chargement commandes:', err, '— restaurantId:', restaurantId);
        if (mounted) setError(new Error(formatSupabaseErr(err)));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchOrders();

    const subscription = supabase
      .channel(`orders:${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        if (!mounted) return;
        if (payload.eventType === 'INSERT') {
          setOrders((prev) => [{ ...(payload.new as Order), order_items: [] }, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === (payload.new as Order).id ? { ...o, ...(payload.new as Order) } : o,
            ),
          );
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [restaurantId, refetchKey]);

  return { orders, loading, error, refetch };
}

// ─── useRestaurantAnalytics ────────────────────────────────────────────────────

export function useRestaurantAnalytics(restaurantId: string | null | undefined) {
  const [stats, setStats] = useState({
    /** Commandes livrées (tout historique) — pour tendance / marge */
    totalOrdersDelivered: 0,
    totalRevenueAllTime: 0,
    avgTicketDelivered: 0,
    /** Uniquement aujourd’hui (minuit → maintenant), statuts livrés */
    todayOrders: 0,
    todayRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchAnalytics = async () => {
      try {
        const { data, error: err } = await withTimeout(
          supabase
            .from('orders')
            .select('total_amount, created_at')
            .eq('restaurant_id', restaurantId)
            .in('status', ['delivered', 'completed']),
          ANALYTICS_TIMEOUT_MS,
        );

        if (err) throw err;

        const list = data || [];
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayList = list.filter((o) => new Date(o.created_at) >= todayStart);
        const todayRevenue = todayList.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
        const totalRevenueAllTime = list.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

        if (mounted) {
          setStats({
            totalOrdersDelivered: list.length,
            totalRevenueAllTime,
            avgTicketDelivered: list.length ? Math.round(totalRevenueAllTime / list.length) : 0,
            todayOrders: todayList.length,
            todayRevenue,
          });
        }
      } catch {
        /* silencieux : KPI secondaires */
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAnalytics();
    return () => {
      mounted = false;
    };
  }, [restaurantId]);

  return { stats, loading };
}

// ─── useRestaurantPayments ─────────────────────────────────────────────────────

export function useRestaurantPayments(restaurantId: string | null | undefined) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      setPaymentError(null);
      return;
    }

    let mounted = true;

    const fetchPayments = async () => {
      try {
        setPaymentError(null);
        const { data, error: err } = await withTimeout(
          supabase
            .from('payments')
            .select('id,order_id,restaurant_id,method,status,amount,transaction_ref,created_at')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
            .limit(50),
          ANALYTICS_TIMEOUT_MS,
        );

        if (err) throw err;
        if (mounted) setPayments(data || []);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[useRestaurantPayments] Erreur chargement paiements:', err);
        if (mounted) {
          setPaymentError('Impossible de charger les paiements');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPayments();
    return () => { mounted = false; };
  }, [restaurantId]);

  return { payments, loading, paymentError };
}
