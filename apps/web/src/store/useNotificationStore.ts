import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotifType = 'order' | 'new_order' | 'order_status' | 'payment' | 'loyalty' | 'event' | 'team' | 'promo' | 'system' | 'info';

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  emoji?: string;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  unreadCount: () => number;
}

/** Anciennes entrées de démo (persist localStorage) — à retirer une fois migré. */
const LEGACY_DEMO_IDS = new Set(['1', '2', '3', '4']);

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      /** Uniquement des notifications réelles (temps réel, DB, notify()). */
      notifications: [],
      addNotification: (n) =>
        set((state) => ({
          notifications: [
            {
              ...n,
              id: Date.now().toString(),
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...state.notifications,
          ],
        })),
      markRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
      clearAll: () => set({ notifications: [] }),
      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    {
      name: 'restafy-notifications',
      version: 2,
      migrate: (persisted, fromVersion) => {
        if (fromVersion < 2 && persisted && typeof persisted === 'object' && 'notifications' in persisted) {
          const raw = persisted as { notifications?: Notification[] };
          const list = Array.isArray(raw.notifications) ? raw.notifications : [];
          return {
            ...raw,
            notifications: list.filter((n) => n && typeof n.id === 'string' && !LEGACY_DEMO_IDS.has(n.id)),
          };
        }
        return persisted as never;
      },
    },
  )
);