// src/components/notifications/NotificationProvider.tsx — RÉÉCRITURE COMPLÈTE
import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  showBrowserNotification,
  isRestaurantStaffSurfacePath,
  isNotificationHiddenOnClientSurface,
} from '@/lib/notifications';
import type { NotifType } from '../../store/useNotificationStore';

interface NotifContextType {
  notify: (type: NotifType, title: string, message: string, emoji?: string, actionUrl?: string) => void;
}

const NotifContext = createContext<NotifContextType | undefined>(undefined);

export const useNotify = () => {
  const context = useContext(NotifContext);
  if (!context) {
    return {
      notify: (type: NotifType, title: string, message: string, emoji?: string, actionUrl?: string) => {
        console.warn('[useNotify] NotificationProvider not found in component tree');
      }
    };
  }
  return context;
};

const VALID_TYPES: NotifType[] = ['order', 'new_order', 'order_status', 'payment', 'loyalty', 'event', 'team', 'promo', 'system', 'info'];
const safeType = (t: string): NotifType => VALID_TYPES.includes(t as NotifType) ? (t as NotifType) : 'system';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const store = useNotificationStore();
  const addNotification = store?.addNotification;
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);

  const allowClientFacingUi = (type: NotifType) =>
    isRestaurantStaffSurfacePath(pathname) || !isNotificationHiddenOnClientSurface(type);

  // Verify store is ready
  useEffect(() => {
    if (addNotification && typeof addNotification === 'function') {
      setIsReady(true);
    }
  }, [addNotification]);

  // Pas de demande de permission automatique (agressive / souvent bloquée).
  // L’utilisateur active les alertes depuis la page Notifications (gratuit, sans service tiers).

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user?.id || !addNotification) return;

    const channel = supabase
      .channel(`notif-provider:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as any;
          try {
            const type = safeType(n.type || 'system');
            if (allowClientFacingUi(type)) {
              addNotification({
                type,
                title: n.title,
                message: n.message,
                emoji: n.emoji || undefined,
                actionUrl: n.action_url || undefined,
              });
              void showBrowserNotification(n.title || 'Restafy', {
                body: n.message,
                tag: String(n.id),
              });
            }
          } catch (e) {
            console.error('[NotificationProvider] Error processing notification:', e);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, addNotification, pathname]);

  const notify = useCallback(
    (type: NotifType, title: string, message: string, emoji?: string, actionUrl?: string) => {
      if (!addNotification) {
        console.warn('[notify] Store not ready yet');
        return;
      }

      if (allowClientFacingUi(type)) {
        addNotification({ type, title, message, emoji, actionUrl });
        void showBrowserNotification(title, { body: message });
      }

      // Save to database (non-blocking)
      if (user?.id) {
        void supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type,
            title,
            message,
            emoji: emoji ?? null,
            action_url: actionUrl ?? null,
            is_read: false,
          })
          .then(({ error }) => {
            if (error) console.error('[notify] Database insert failed:', error);
          });
      }
    },
    [addNotification, user?.id, pathname]
  );

  return (
    <NotifContext.Provider value={{ notify }}>
      {children}
    </NotifContext.Provider>
  );
};
