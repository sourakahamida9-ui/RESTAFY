import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { startOfDay, subDays, format } from 'date-fns';

export interface AnalyticsData {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  revenueGrowth: number | null;
  ordersGrowth: number | null;
  periodSales: Array<{ date: string; revenue: number; orders: number }>;
  statusDistribution: Record<string, number>;
  topItems: Array<{ name: string; quantity: number; revenue: number }>;
  customersCount: number;
  /** OMS — temps moyen de préparation (secondes, confirmed → ready). null si pas assez de data. */
  avgPrepTimeSec: number | null;
  /** OMS — délai moyen d'acceptation (secondes, pending → confirmed/accepted). null si pas assez de data. */
  avgAcceptLagSec: number | null;
  /** OMS — taux d'annulation (0..1) sur la période. */
  cancelRate: number;
  /** OMS — nombre de commandes annulées. */
  cancelledCount: number;
}

export function useAnalyticsData(restaurantId: string | null | undefined, days: number = 7) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const startDate = startOfDay(subDays(new Date(), days));
        const startISO = startDate.toISOString();

        // 1. Fetch Orders
        const { data: orders, error: ordersErr } = await supabase
          .from('orders')
          .select('id, total_amount, status, created_at, customer_id')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', startISO);

        if (ordersErr) throw ordersErr;

        const previousStartISO = startOfDay(subDays(new Date(), days * 2)).toISOString();
        const previousEndISO = startISO;

        const { data: previousOrders, error: previousOrdersErr } = await supabase
          .from('orders')
          .select('total_amount, status')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', previousStartISO)
          .lt('created_at', previousEndISO);

        if (previousOrdersErr) throw previousOrdersErr;

        // 2. Fetch Order Items for top items
        const orderIds = (orders || []).map(o => o.id);
        let topItems: AnalyticsData['topItems'] = [];
        
        if (orderIds.length > 0) {
          const { data: items, error: itemsErr } = await supabase
            .from('order_items')
            .select('item_name, quantity, unit_price, subtotal')
            .in('order_id', orderIds);
          
          if (!itemsErr && items) {
            const itemMap = new Map<string, { quantity: number; revenue: number }>();
            items.forEach(it => {
              const name = it.item_name || 'Inconnu';
              const current = itemMap.get(name) || { quantity: 0, revenue: 0 };
              itemMap.set(name, {
                quantity: current.quantity + (it.quantity || 1),
                revenue: current.revenue + (it.subtotal || (it.quantity * it.unit_price) || 0)
              });
            });
            topItems = Array.from(itemMap.entries())
              .map(([name, stats]) => ({ name, ...stats }))
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 5);
          }
        }

        // 3. Process period sales
        const buckets: Record<string, { revenue: number; orders: number }> = {};
        for (let i = 0; i <= days; i++) {
          const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
          buckets[d] = { revenue: 0, orders: 0 };
        }

        let totalRevenue = 0;
        let deliveredCount = 0;
        let cancelledCount = 0;
        const statusDistribution: Record<string, number> = {};
        const uniqueCustomers = new Set();

        (orders || []).forEach(o => {
          const dateKey = o.created_at.split('T')[0];
          if (buckets[dateKey]) {
            buckets[dateKey].revenue += Number(o.total_amount);
            buckets[dateKey].orders += 1;
          }
          
          if (o.status === 'delivered' || o.status === 'completed') {
            totalRevenue += Number(o.total_amount);
            deliveredCount += 1;
          }
          if (o.status === 'cancelled') cancelledCount += 1;

          statusDistribution[o.status] = (statusDistribution[o.status] || 0) + 1;
          if (o.customer_id) uniqueCustomers.add(o.customer_id);
        });

        // 3b. OMS metrics — temps prep + délai acceptation (depuis order_events).
        // Best-effort : on swallow l'erreur si la table n'existe pas encore (v1 pas appliqué).
        let avgPrepTimeSec: number | null = null;
        let avgAcceptLagSec: number | null = null;
        if (orderIds.length > 0) {
          try {
            const { data: events, error: evErr } = await supabase
              .from('order_events')
              .select('order_id, from_status, to_status, created_at')
              .in('order_id', orderIds)
              .in('to_status', ['accepted', 'confirmed', 'preparing', 'ready']);
            if (!evErr && Array.isArray(events)) {
              // Group earliest timestamp per (order_id, key)
              const byOrder: Record<string, { pending?: string; accepted?: string; preparing?: string; ready?: string }> = {};
              for (const ev of events as Array<{ order_id: string; from_status: string | null; to_status: string; created_at: string }>) {
                const slot = (byOrder[ev.order_id] ||= {});
                if ((ev.to_status === 'accepted' || ev.to_status === 'confirmed') && !slot.accepted) {
                  slot.accepted = ev.created_at;
                }
                if (ev.to_status === 'preparing' && !slot.preparing) slot.preparing = ev.created_at;
                if (ev.to_status === 'ready' && !slot.ready) slot.ready = ev.created_at;
                // pending = order created_at (proxy, plus fiable que les events)
              }
              const orderCreatedAt: Record<string, string> = {};
              for (const o of orders || []) orderCreatedAt[o.id] = o.created_at;

              const prepDeltas: number[] = [];
              const acceptDeltas: number[] = [];
              for (const [oid, s] of Object.entries(byOrder)) {
                const created = orderCreatedAt[oid];
                if (created && s.accepted) {
                  const d = (new Date(s.accepted).getTime() - new Date(created).getTime()) / 1000;
                  if (d >= 0 && d < 60 * 60 * 6) acceptDeltas.push(d);
                }
                // prep time : from confirmed/preparing to ready
                const prepStart = s.preparing || s.accepted;
                if (prepStart && s.ready) {
                  const d = (new Date(s.ready).getTime() - new Date(prepStart).getTime()) / 1000;
                  if (d >= 0 && d < 60 * 60 * 6) prepDeltas.push(d);
                }
              }
              if (acceptDeltas.length >= 1) {
                avgAcceptLagSec = Math.round(acceptDeltas.reduce((a, b) => a + b, 0) / acceptDeltas.length);
              }
              if (prepDeltas.length >= 1) {
                avgPrepTimeSec = Math.round(prepDeltas.reduce((a, b) => a + b, 0) / prepDeltas.length);
              }
            }
          } catch {
            // table absente ou RLS — laisser les métriques à null
          }
        }

        const periodSales = Object.entries(buckets)
          .map(([date, stats]) => ({ date, ...stats }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const previousDeliveredOrders = (previousOrders || []).filter(
          (order) => order.status === 'delivered' || order.status === 'completed'
        );
        const previousRevenue = previousDeliveredOrders.reduce(
          (sum, order) => sum + Number(order.total_amount || 0),
          0
        );
        const previousOrderCount = (previousOrders || []).length;

        setData({
          revenue: totalRevenue,
          orders: orders?.length || 0,
          avgOrderValue: deliveredCount ? Math.round(totalRevenue / deliveredCount) : 0,
          revenueGrowth: previousRevenue > 0
            ? Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100)
            : null,
          ordersGrowth: previousOrderCount > 0
            ? Math.round((((orders?.length || 0) - previousOrderCount) / previousOrderCount) * 100)
            : null,
          periodSales,
          statusDistribution,
          topItems,
          customersCount: uniqueCustomers.size,
          avgPrepTimeSec,
          avgAcceptLagSec,
          cancelRate: (orders?.length || 0) > 0 ? cancelledCount / (orders!.length) : 0,
          cancelledCount,
        });

      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [restaurantId, days]);

  return { data, loading, error };
}
