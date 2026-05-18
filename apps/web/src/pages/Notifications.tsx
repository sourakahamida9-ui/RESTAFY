import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Check, Trash2, ShoppingBag, Star, Calendar, Tag, Users, Zap, Clock, Info } from 'lucide-react';
import { useNotificationStore, type Notification, type NotifType } from '../store/useNotificationStore';
import { cn } from '../lib/utils';

const typeConfig: Record<NotifType, { icon: React.ElementType; color: string; bg: string }> = {
  order:        { icon: ShoppingBag, color: 'text-primary',     bg: 'bg-primary/10' },
  new_order:    { icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  order_status: { icon: Clock,       color: 'text-blue-600',    bg: 'bg-blue-50' },
  payment:      { icon: Zap,         color: 'text-yellow-500',  bg: 'bg-yellow-50' },
  loyalty:      { icon: Star,        color: 'text-amber-500',   bg: 'bg-amber-50' },
  event:        { icon: Calendar,    color: 'text-purple-500',  bg: 'bg-purple-50' },
  team:         { icon: Users,       color: 'text-blue-500',    bg: 'bg-blue-50' },
  promo:        { icon: Tag,         color: 'text-emerald-500', bg: 'bg-emerald-50' },
  system:       { icon: Bell,        color: 'text-zinc-500',    bg: 'bg-zinc-100' },
  info:         { icon: Info,        color: 'text-sky-600',     bg: 'bg-sky-50' },
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'À l\'instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return `Il y a ${Math.floor(diff / 86400)}j`;
}

const NotifCard = ({ notif }: { notif: Notification }) => {
  const { markRead } = useNotificationStore();
  const navigate = useNavigate();
  const cfg = typeConfig[notif.type] ?? typeConfig.system;
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      onClick={() => {
        markRead(notif.id);
        if (notif.actionUrl) navigate(notif.actionUrl);
      }}
      className={cn(
        'flex gap-4 p-4 rounded-2xl border cursor-pointer transition-all active:scale-[0.98]',
        notif.read
          ? 'bg-white border-zinc-100'
          : 'bg-primary/5 border-primary/20 shadow-sm'
      )}
    >
      <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0', cfg.bg)}>
        <Icon className={cn('w-5 h-5', cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={cn('font-bold text-sm', !notif.read && 'text-ink')}>{notif.title}</h4>
          <span className="text-[10px] text-zinc-400 whitespace-nowrap">{timeAgo(notif.createdAt)}</span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{notif.message}</p>
      </div>
      {!notif.read && (
        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
      )}
    </motion.div>
  );
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, markAllRead, clearAll, unreadCount } = useNotificationStore();
  const count = unreadCount();
  const [notifPerm, setNotifPerm] = React.useState<NotificationPermission>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const requestDesktopAlerts = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const p = await Notification.requestPermission();
      setNotifPerm(p);
    } catch {
      setNotifPerm('denied');
    }
  };

  const hasBrowserNotifApi = typeof window !== 'undefined' && 'Notification' in window;

  return (
    <div className="min-h-screen bg-paper pb-32">
      <header className="px-4 py-6 flex items-center gap-4 bg-white border-b border-zinc-100">
        <button onClick={() => navigate(-1)} className="p-2 bg-zinc-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Notifications</h1>
          {count > 0 && (
            <p className="text-xs text-primary font-bold">{count} non lue{count > 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex gap-2">
          {count > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold"
            >
              <Check className="w-3 h-3" /> Tout lire
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 text-zinc-500 rounded-xl text-xs font-bold"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {hasBrowserNotifApi && (
          <div
            className={cn(
              'rounded-2xl border p-4 mb-1',
              notifPerm === 'granted'
                ? 'bg-emerald-50/80 border-emerald-200'
                : 'bg-zinc-50 border-zinc-200'
            )}
          >
            <p className="text-sm font-bold text-ink mb-1">Alertes hors appli (gratuit)</p>
            <p className="text-xs text-zinc-600 leading-relaxed mb-3">
              Utilise uniquement le navigateur : pas d’abonnement ni de service payant. Fonctionne sur HTTPS après votre accord.
            </p>
            {notifPerm === 'default' && (
              <button
                type="button"
                onClick={requestDesktopAlerts}
                className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold"
              >
                Activer les alertes
              </button>
            )}
            {notifPerm === 'granted' && (
              <p className="text-xs font-semibold text-emerald-700">Les alertes système sont activées.</p>
            )}
            {notifPerm === 'denied' && (
              <p className="text-xs text-zinc-500">
                Les alertes ont été refusées. Vous pouvez les réactiver dans les paramètres du site de votre navigateur.
              </p>
            )}
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-zinc-300" />
            </div>
            <h3 className="font-bold text-lg mb-1">Tout est à jour !</h3>
            <p className="text-sm text-zinc-400">Vous n'avez aucune notification pour le moment.</p>
          </div>
        ) : (
          <AnimatePresence>
            {notifications.map((n) => (
              <NotifCard key={n.id} notif={n} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
