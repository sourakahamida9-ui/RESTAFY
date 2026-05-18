// useDataCollection.ts - Track data for AI/ML training
import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface DataCollectionOptions {
  restaurantId?: string;
  userId?: string;
  sessionId?: string;
}

export const useDataCollection = () => {
  // Track order event (status change)
  const trackOrderEvent = useCallback(
    async (
      orderId: string,
      restaurantId: string,
      eventType: 'created' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled',
      triggeredBy: 'customer' | 'staff' | 'auto' = 'auto',
      staffId?: string,
      deviceType?: 'mobile' | 'desktop' | 'pos'
    ) => {
      try {
        const { error } = await supabase.from('order_events').insert({
          order_id: orderId,
          restaurant_id: restaurantId,
          event_type: eventType,
          triggered_by: triggeredBy,
          staff_id: staffId,
          device_type: deviceType || 'mobile',
        });

        if (error && import.meta.env.DEV) {
          console.error('[DataCollection] trackOrderEvent error:', error);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[DataCollection] trackOrderEvent exception:', err);
      }
    },
    []
  );

  // Track menu item view
  const trackMenuView = useCallback(
    async (
      restaurantId: string,
      itemId: string,
      sessionId?: string,
      userId?: string,
      timeSpentSeconds?: number,
      addedToCart: boolean = false,
      deviceType?: 'mobile' | 'desktop' | 'pos'
    ) => {
      try {
        const { error } = await supabase.from('menu_views').insert({
          restaurant_id: restaurantId,
          item_id: itemId,
          session_id: sessionId,
          user_id: userId,
          time_spent_seconds: timeSpentSeconds,
          added_to_cart: addedToCart,
          device_type: deviceType || 'mobile',
        });

        if (error && import.meta.env.DEV) {
          console.error('[DataCollection] trackMenuView error:', error);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[DataCollection] trackMenuView exception:', err);
      }
    },
    []
  );

  // Track order completion (when ordered button clicked)
  const trackOrderCompletion = useCallback(
    async (restaurantId: string, itemId: string, sessionId?: string, userId?: string) => {
      try {
        const { error } = await supabase
          .from('menu_views')
          .update({ ordered: true })
          .eq('restaurant_id', restaurantId)
          .eq('item_id', itemId)
          .eq('session_id', sessionId || null)
          .eq('user_id', userId || null);

        if (error && import.meta.env.DEV) {
          console.error('[DataCollection] trackOrderCompletion error:', error);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[DataCollection] trackOrderCompletion exception:', err);
      }
    },
    []
  );

  // Report stock alert
  const reportStockAlert = useCallback(
    async (
      restaurantId: string,
      itemId: string,
      reportedBy: string,
      alertType: 'low' | 'out_of_stock' | 'back',
      ordersLostEstimate?: number
    ) => {
      try {
        const now = new Date();
        const hourOfDay = now.getHours();
        const dayOfWeek = now.getDay();

        const { error } = await supabase.from('stock_alerts').insert({
          restaurant_id: restaurantId,
          item_id: itemId,
          reported_by: reportedBy,
          alert_type: alertType,
          hour_of_day: hourOfDay,
          day_of_week: dayOfWeek,
          orders_lost_estimate: ordersLostEstimate,
        });

        if (error && import.meta.env.DEV) {
          console.error('[DataCollection] reportStockAlert error:', error);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[DataCollection] reportStockAlert exception:', err);
      }
    },
    []
  );

  // Log admin action
  const logAdminAction = useCallback(
    async (
      actorId: string,
      actorRole: string,
      actionType: string,
      entityType?: string,
      entityId?: string,
      oldValue?: Record<string, any>,
      newValue?: Record<string, any>,
      ipAddress?: string
    ) => {
      try {
        const { error } = await supabase.from('admin_actions').insert({
          actor_id: actorId,
          actor_role: actorRole,
          action_type: actionType,
          entity_type: entityType,
          entity_id: entityId,
          old_value: oldValue,
          new_value: newValue,
          ip_address: ipAddress,
        });

        if (error && import.meta.env.DEV) {
          console.error('[DataCollection] logAdminAction error:', error);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[DataCollection] logAdminAction exception:', err);
      }
    },
    []
  );

  // Get data collection stats
  const getDataCollectionStats = useCallback(
    async (restaurantId: string) => {
      try {
        // Count total orders (fallback: use orders table if order_events is missing)
        const orderEventsResult = await supabase
          .from('order_events')
          .select('id', { count: 'exact' })
          .eq('restaurant_id', restaurantId);
        const totalOrders = orderEventsResult.error ? 0 : orderEventsResult.count;

        // Count daily stats
        const { count: dailyStats } = await supabase
          .from('daily_restaurant_stats')
          .select('id', { count: 'exact' })
          .eq('restaurant_id', restaurantId);

        // Count menu views
        const { count: menuViews } = await supabase
          .from('menu_views')
          .select('id', { count: 'exact' })
          .eq('restaurant_id', restaurantId);

        // Count stock alerts
        const { count: stockAlerts } = await supabase
          .from('stock_alerts')
          .select('id', { count: 'exact' })
          .eq('restaurant_id', restaurantId);

        return {
          totalOrders: totalOrders || 0,
          dailyStats: dailyStats || 0,
          menuViews: menuViews || 0,
          stockAlerts: stockAlerts || 0,
          dataReadinessPercentage: Math.min(100, Math.round(((totalOrders || 0) / 500) * 100)),
        };
      } catch (err) {
        return {
          totalOrders: 0,
          dailyStats: 0,
          menuViews: 0,
          stockAlerts: 0,
          dataReadinessPercentage: 0,
        };
      }
    },
    []
  );

  return {
    trackOrderEvent,
    trackMenuView,
    trackOrderCompletion,
    reportStockAlert,
    logAdminAction,
    getDataCollectionStats,
  };
};
