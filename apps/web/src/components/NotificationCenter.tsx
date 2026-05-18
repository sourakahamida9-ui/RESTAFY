// src/components/NotificationCenter.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bell, Check, Package, CreditCard, Calendar, Tag, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  new_order: <Package className="w-4 h-4" />,
  order_status: <Package className="w-4 h-4" />,
  payment: <CreditCard className="w-4 h-4" />,
  payment_success: <CreditCard className="w-4 h-4" />,
  payout_initiated: <CreditCard className="w-4 h-4" />,
  payout_completed: <CreditCard className="w-4 h-4" />,
  event: <Calendar className="w-4 h-4" />,
  promo: <Tag className="w-4 h-4" />,
  system: <Info className="w-4 h-4" />,
};

const typeColors: Record<string, string> = {
  new_order: 'bg-green-100 text-green-600',
  order_status: 'bg-blue-100 text-blue-600',
  payment: 'bg-purple-100 text-purple-600',
  payment_success: 'bg-purple-100 text-purple-600',
  payout_initiated: 'bg-purple-100 text-purple-600',
  payout_completed: 'bg-purple-100 text-purple-600',
  event: 'bg-amber-100 text-amber-600',
  promo: 'bg-pink-100 text-pink-600',
  system: 'bg-gray-100 text-gray-600',
};

// Catégories utilisateur (filtres) → mapping vers les types techniques DB.
type FilterKey = 'all' | 'orders' | 'finances' | 'system';

const FILTER_TYPES: Record<FilterKey, string[] | null> = {
  all: null,
  orders: ['new_order', 'order_status'],
  finances: ['payment', 'payment_success', 'payout_initiated', 'payout_completed'],
  system: ['system', 'event', 'promo', 'info'],
};

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'Toutes',
  orders: 'Commandes',
  finances: 'Finances',
  system: 'Système',
};

const PAGE_SIZE = 20;

export default function NotificationCenter() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filtered = useMemo(() => {
    const types = FILTER_TYPES[filter];
    if (!types) return notifications;
    return notifications.filter((n) => types.includes(n.type));
  }, [notifications, filter]);

  const fetchPage = useCallback(
    async (offset: number): Promise<Notification[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        // is_archived peut ne pas exister tant que la migration 099 n'a pas
        // tourné — on n'ajoute donc pas de filtre client-side strict ici.
        // Le cron côté serveur gère l'archivage en lecture inverse.
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        console.warn('[NotificationCenter] fetch error', error);
        return [];
      }
      return (data || []) as Notification[];
    },
    [user?.id],
  );

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const page = await fetchPage(0);
      if (cancelled) return;
      setNotifications(page);
      setHasMore(page.length === PAGE_SIZE);
      setLoading(false);
    })();

    // Realtime subscription : nouvelles notifs prepended en haut.
    const subscription = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [user?.id, fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const page = await fetchPage(notifications.length);
    setNotifications((prev) => {
      const seen = new Set(prev.map((n) => n.id));
      return [...prev, ...page.filter((n) => !seen.has(n.id))];
    });
    setHasMore(page.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [fetchPage, notifications.length, loadingMore, hasMore]);

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const formatTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${days}j`;
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full transition hover:bg-[var(--r-surface)]"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} non lues)` : ''}`}
      >
        <Bell className="w-5 h-5 text-[color:var(--r-nav-hover)] opacity-80 hover:opacity-100" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
              role="dialog"
              aria-label="Centre de notifications"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Tout marquer lu
                  </button>
                )}
              </div>

              {/* Filtres */}
              <div
                className="flex items-center gap-1 px-2 py-2 border-b border-gray-100 overflow-x-auto"
                role="tablist"
                aria-label="Filtrer les notifications"
              >
                {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
                  const isActive = filter === key;
                  const types = FILTER_TYPES[key];
                  const count = types
                    ? notifications.filter((n) => types.includes(n.type)).length
                    : notifications.length;
                  return (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setFilter(key)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition',
                        isActive
                          ? 'bg-orange-500 text-white'
                          : 'text-gray-600 hover:bg-gray-100',
                      )}
                    >
                      {FILTER_LABELS[key]}
                      {count > 0 && (
                        <span className={cn('ml-1.5 text-[10px]', isActive ? 'opacity-90' : 'opacity-60')}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">Chargement…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{filter === 'all' ? 'Aucune notification' : 'Aucune notification dans cette catégorie'}</p>
                  </div>
                ) : (
                  <>
                    {filtered.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => markAsRead(notification.id)}
                        className={cn(
                          'px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition',
                          !notification.is_read && 'bg-orange-50/40',
                        )}
                      >
                        <div className="flex gap-3">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                              typeColors[notification.type] || typeColors.system,
                            )}
                          >
                            {typeIcons[notification.type] || typeIcons.system}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-sm text-gray-900 truncate">
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <span
                                  className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"
                                  aria-label="Non lu"
                                />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatTime(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {hasMore && filter === 'all' && (
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="w-full py-3 text-xs font-semibold text-orange-600 hover:bg-orange-50 disabled:opacity-50 transition"
                      >
                        {loadingMore ? 'Chargement…' : 'Charger plus'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
