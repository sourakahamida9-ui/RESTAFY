// src/hooks/useOrderRealtime.ts
//
// Surveille les nouvelles commandes d'un restaurant en temps réel via
// Supabase Realtime, avec **fallback polling** quand la connexion est
// dégradée et **son répétitif** sur nouvelle commande pour ne rien rater.
//
// Comportement:
//   - Realtime OK → INSERT/UPDATE remontés instantanément.
//   - Realtime degraded (cf. RealtimeStatusContext) → polling toutes 15s
//     avec déduplication par order.id.
//   - Sur INSERT (live ou polling) : son répétitif + vibration + notif.
//   - Le son boucle jusqu'à appel de `stopAlerts()` (exposé au consumer).
//   - Si `soundEnabled === false`, aucun son ne joue (réglage utilisateur).

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotify } from '@/components/notifications/NotificationProvider';
import {
  startRepeatingNotificationSound,
  stopRepeatingNotificationSound,
} from '@/lib/notifications';
import { useRealtimeStatus } from '@/context/RealtimeStatusContext';

interface IncomingOrder {
  id: string;
  order_number?: string;
  total_amount?: number | string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

const POLL_INTERVAL_MS = 15_000;

export function useOrderRealtime(
  restaurantId: string | null,
  onNewOrder?: (order: IncomingOrder) => void,
  soundEnabled = true,
  vibrationEnabled = true,
) {
  const { notify } = useNotify();
  const { status: rtStatus } = useRealtimeStatus();

  // Track des ids déjà notifiés pour éviter les doublons (Realtime ↔ polling).
  const seenIdsRef = useRef<Set<string>>(new Set());
  const lastSeenAtRef = useRef<string>(new Date().toISOString());
  const onNewOrderRef = useRef(onNewOrder);
  onNewOrderRef.current = onNewOrder;

  const playSound = useCallback(() => {
    if (!soundEnabled) return;
    startRepeatingNotificationSound();
  }, [soundEnabled]);

  const vibrate = useCallback(() => {
    if (!vibrationEnabled) return;
    try {
      if ('vibrate' in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
    } catch {
      // Vibration non supportée
    }
  }, [vibrationEnabled]);

  const handleIncoming = useCallback(
    (order: IncomingOrder, source: 'realtime' | 'polling') => {
      if (!order?.id) return;
      if (seenIdsRef.current.has(order.id)) return;
      seenIdsRef.current.add(order.id);

      // Borne mémoire : on garde les 200 derniers ids (largement suffisant
      // pour dédupliquer Realtime ↔ polling sur des fenêtres de quelques min).
      if (seenIdsRef.current.size > 200) {
        const arr = Array.from(seenIdsRef.current);
        seenIdsRef.current = new Set(arr.slice(arr.length - 200));
      }

      if (order.created_at && order.created_at > lastSeenAtRef.current) {
        lastSeenAtRef.current = order.created_at;
      }

      // Only trigger alerts (sound/vibration/notification) for pending orders
      const isPending = !order.status || order.status === 'pending';

      if (isPending) {
        playSound();
        vibrate();

        try {
          const montant = order.total_amount
            ? `${Number(order.total_amount).toLocaleString('fr-FR')} FCFA`
            : '';
          notify(
            'new_order',
            'Nouvelle commande',
            `#${order.order_number ?? '---'}${montant ? ` · ${montant}` : ''}${
              source === 'polling' ? ' · synchro' : ''
            }`,
            undefined,
            '/restaurant/dashboard',
          );
        } catch {
          // Non critique
        }
      }

      try {
        onNewOrderRef.current?.(order);
      } catch {
        /* Non critique */
      }
    },
    [notify, playSound, vibrate],
  );

  // ── Subscription Realtime ──────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`orders-rt:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const order = payload.new as IncomingOrder;
          handleIncoming(order, 'realtime');
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          try {
            onNewOrderRef.current?.(payload.new as IncomingOrder);
          } catch {
            /* Non critique */
          }
        },
      )
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [restaurantId, handleIncoming]);

  // ── Polling fallback quand la connexion est dégradée ──────────────────
  // Tant que rtStatus !== 'connected', on poll toutes les POLL_INTERVAL_MS
  // pour récupérer les commandes créées depuis lastSeenAtRef. La dédup
  // par seenIdsRef évite le double-notification quand Realtime revient.
  useEffect(() => {
    if (!restaurantId) return;
    if (rtStatus === 'connected') return;

    let cancelled = false;

    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id,order_number,total_amount,status,created_at')
          .eq('restaurant_id', restaurantId)
          .gt('created_at', lastSeenAtRef.current)
          .order('created_at', { ascending: true })
          .limit(50);

        if (cancelled) return;
        if (error) return;
        for (const o of data || []) {
          handleIncoming(o as IncomingOrder, 'polling');
        }
      } catch {
        // Non critique — on retentera au prochain tick
      }
    };

    // Premier tick immédiat puis polling régulier.
    void poll();
    const id = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [restaurantId, rtStatus, handleIncoming]);

  // Méthode exposée pour couper le son (clic user, ouverture commande, etc.).
  const stopAlerts = useCallback(() => {
    stopRepeatingNotificationSound();
  }, []);

  // Auto-stop : dès que le restaurateur interagit avec la page (clic, touche),
  // on coupe le son en boucle. Évite d'avoir à mettre un bouton dédié partout.
  // Stop AUSSI au démontage (navigation client-side, sinon le wav singleton
  // boucle indéfiniment puisque les listeners sont retirés).
  useEffect(() => {
    const stop = () => stopRepeatingNotificationSound();
    document.addEventListener('click', stop, { passive: true });
    document.addEventListener('keydown', stop, { passive: true });
    document.addEventListener('touchstart', stop, { passive: true });
    return () => {
      stopRepeatingNotificationSound();
      document.removeEventListener('click', stop);
      document.removeEventListener('keydown', stop);
      document.removeEventListener('touchstart', stop);
    };
  }, []);

  return { stopAlerts };
}
