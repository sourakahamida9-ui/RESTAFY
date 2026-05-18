// src/lib/notifications.ts — VERSION CORRIGÉE
// FIX : suppression du champ "data" (colonne peut être absente en DB)

import { supabase } from './supabase';

/** Son unique pour toutes les notifications (fichier dans `static/`, servi à la racine en prod). */
export const NOTIFICATION_SOUND_URL = '/mixkit-happy-bells-notification-937.wav';

let notificationAudio: HTMLAudioElement | null = null;

function getNotificationAudio(): HTMLAudioElement {
  if (!notificationAudio) {
    notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
    notificationAudio.preload = 'auto';
  }
  return notificationAudio;
}

export interface NotificationPayload {
  type: 'new_order' | 'order_status' | 'order' | 'payment' | 'event' | 'promo' | 'system';
  title: string;
  message: string;
  emoji?: string;
  action_url?: string;
}

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    return (await Notification.requestPermission()) === 'granted';
  }
  return false;
};

/** Parcours back-office : alertes navigateur complètes. */
export function isRestaurantStaffSurfacePath(pathname: string): boolean {
  return (
    pathname.startsWith('/restaurant/dashboard') ||
    pathname.startsWith('/pos') ||
    pathname.startsWith('/superadmin')
  );
}

/**
 * Types de notif réservés au restaurant (cuisine, équipe) : pas d’alerte Chrome ni centre client.
 */
export const NOTIFICATION_TYPES_HIDDEN_ON_CLIENT_SURFACE = ['new_order', 'team'] as const;
export type HiddenOnClientNotifType = (typeof NOTIFICATION_TYPES_HIDDEN_ON_CLIENT_SURFACE)[number];

export function isNotificationHiddenOnClientSurface(type: string): boolean {
  return (NOTIFICATION_TYPES_HIDDEN_ON_CLIENT_SURFACE as readonly string[]).includes(type);
}

/** Retire emojis / pictos pour un rendu notification sobre (Chrome, etc.). */
export function sanitizeNotificationText(text: string | null | undefined): string {
  if (!text) return '';
  let s = text.normalize('NFKC');
  try {
    s = s.replace(/\p{Extended_Pictographic}/gu, '');
  } catch {
    s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
  }
  s = s.replace(/\uFE0F/g, '').replace(/\u200D/g, '');
  return s.replace(/\s{2,}/g, ' ').trim();
}

const BROWSER_BODY_MAX = 220;

/**
 * Alertes système **sans coût** : API native du navigateur (pas de Firebase / FCM / serveur push).
 * Texte nettoyé (sans emojis), ton sobre type SaaS.
 */
export const showBrowserNotification = async (title: string, options?: NotificationOptions): Promise<void> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const cleanTitle = sanitizeNotificationText(title) || 'Restafy';
  const rawBody = typeof options?.body === 'string' ? options.body : '';
  const cleanBody = sanitizeNotificationText(rawBody).slice(0, BROWSER_BODY_MAX);

  const { body: _b, ...rest } = options || {};
  const base: NotificationOptions = {
    lang: 'fr',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    silent: false,
    ...rest,
    body: cleanBody || undefined,
  };

  const t = cleanTitle.length > 64 ? `${cleanTitle.slice(0, 61)}…` : cleanTitle;

  try {
    // Méthode la plus simple — marche en contexte page (Chrome, Firefox, Edge, etc.)
    const n = new Notification(t, base);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return;
  } catch {
    /* navigateur très restrictif → tenter le SW */
  }

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker?.ready) {
      const registration = await navigator.serviceWorker.ready;
      if (registration?.showNotification) {
        await registration.showNotification(t, { ...base, body: cleanBody || undefined });
      }
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Notification] Affichage impossible:', err);
  }
};

/**
 * Joue le son de notification (même fichier pour commande, message, alerte).
 * Le paramètre `type` est conservé pour la compatibilité des appels existants.
 */
export const playNotificationSound = (_type?: 'order' | 'message' | 'alert'): void => {
  if (typeof window === 'undefined') return;
  try {
    const a = getNotificationAudio();
    a.loop = false;
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* Son non critique */
  }
};

/**
 * Démarre le son de notification en mode **boucle** jusqu'à appel
 * explicite de `stopRepeatingNotificationSound()`. À utiliser pour les
 * nouvelles commandes restaurant — le restaurateur peut ne pas être
 * devant l'écran, le son répétitif force l'attention.
 *
 * Idempotent : un second appel ne relance pas le son si déjà actif.
 */
let repeatingActive = false;
export const startRepeatingNotificationSound = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const a = getNotificationAudio();
    if (repeatingActive && !a.paused) return;
    a.loop = true;
    a.currentTime = 0;
    repeatingActive = true;
    void a.play().catch(() => {
      // Autoplay bloqué : on retombe sur le son one-shot au prochain
      // event utilisateur (déjà couvert ailleurs).
      repeatingActive = false;
    });
  } catch {
    /* Son non critique */
  }
};

export const stopRepeatingNotificationSound = (): void => {
  if (typeof window === 'undefined') return;
  try {
    if (!notificationAudio) return;
    notificationAudio.loop = false;
    notificationAudio.pause();
    notificationAudio.currentTime = 0;
    repeatingActive = false;
  } catch {
    /* Son non critique */
  }
};

export const isRepeatingNotificationSoundActive = (): boolean => repeatingActive;

// ── FIX principal : ne PAS envoyer le champ "data" ──────────────────────────
export const createNotification = async (userId: string, payload: NotificationPayload): Promise<void> => {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      emoji: payload.emoji ?? null,
      action_url: payload.action_url ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    if (error) console.error('[Notification] Error:', error.message);
  } catch (e) { console.error('[Notification] Failed:', e); }
};

export const sendEmailNotification = async (to: string, subject: string, _html: string): Promise<boolean> => {
  console.log('[Email]', { to, subject }); return true;
};

export const notifyNewOrder = (orderNumber: string, total: number, customerName?: string): void => {
  playNotificationSound('order');

  const body = sanitizeNotificationText(
    `Commande #${orderNumber} · ${total.toLocaleString('fr-FR')} FCFA${customerName ? ` · ${customerName}` : ''}`,
  );
  void showBrowserNotification('Restafy · Nouvelle commande', {
    body,
    tag: 'new-order',
    requireInteraction: true,
  });
};

export const notifyOrderStatusChange = (orderNumber: string, newStatus: string, restaurantName: string): void => {
  const msgs: Record<string, string> = {
    confirmed: 'Commande confirmée',
    preparing: 'En préparation',
    ready: 'Prête',
    delivering: 'En livraison',
    delivered: 'Livrée',
    cancelled: 'Annulée',
  };
  const line = msgs[newStatus] || newStatus;
  const title = sanitizeNotificationText(restaurantName) || 'Restafy';
  void showBrowserNotification(`${title} · Commande #${orderNumber}`, {
    body: sanitizeNotificationText(line),
    tag: `order-${orderNumber}`,
  });
};

export default {
  requestNotificationPermission,
  showBrowserNotification,
  sanitizeNotificationText,
  isRestaurantStaffSurfacePath,
  isNotificationHiddenOnClientSurface,
  NOTIFICATION_TYPES_HIDDEN_ON_CLIENT_SURFACE,
  NOTIFICATION_SOUND_URL,
  playNotificationSound,
  createNotification,
  sendEmailNotification,
  notifyNewOrder,
  notifyOrderStatusChange,
};
