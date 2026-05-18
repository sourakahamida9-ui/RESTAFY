// src/hooks/useRealtimeConnection.ts
//
// Surveille l'état de la connexion Supabase Realtime (websocket) et
// expose un statut consommable par l'UI (banner, badge, etc.).
//
// L'idée : Supabase ne nous notifie pas d'un disconnect réseau de façon
// fiable. On écoute donc les events de cycle de vie d'un canal "heartbeat"
// vide, et on infère le statut de la connexion globale.
//
// Statuts:
//   - 'connected'      : websocket OK, on reçoit les events temps réel.
//   - 'reconnecting'   : on a détecté une coupure ou un timeout, on tente
//                         de se reconnecter (exponential backoff côté Supabase).
//   - 'degraded'       : trop de tentatives échouées → l'UI doit basculer
//                         en polling fallback.
//
// Le hook ne **fait pas** le polling lui-même : il signale juste l'état.
// Les hooks concrets (useOrderRealtime, etc.) déclenchent leur propre
// polling quand status === 'degraded'.

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export type RealtimeConnectionStatus = 'connected' | 'reconnecting' | 'degraded';

interface Options {
  /** Nombre max de tentatives de reconnexion avant de basculer en 'degraded'. Default 3. */
  maxReconnectAttempts?: number;
  /** Délai (ms) avant de basculer 'reconnecting' → 'degraded' si toujours pas reconnecté. Default 15s. */
  degradedAfterMs?: number;
}

export function useRealtimeConnection(opts: Options = {}) {
  const { maxReconnectAttempts = 3, degradedAfterMs = 15_000 } = opts;
  const [status, setStatus] = useState<RealtimeConnectionStatus>('connected');
  const [lastErrorAt, setLastErrorAt] = useState<number | null>(null);
  const attemptsRef = useRef(0);
  const degradeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearDegradeTimer = () => {
      if (degradeTimerRef.current) {
        clearTimeout(degradeTimerRef.current);
        degradeTimerRef.current = null;
      }
    };

    // Canal heartbeat : on ne s'abonne à aucune table, on observe juste
    // les transitions d'état. Beaucoup plus léger qu'un canal métier.
    const channel = supabase.channel('rt-heartbeat', {
      config: { broadcast: { ack: false }, presence: { key: '' } },
    });

    channel.subscribe((subscriptionStatus) => {
      // Statuts possibles: SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED
      if (subscriptionStatus === 'SUBSCRIBED') {
        attemptsRef.current = 0;
        clearDegradeTimer();
        setStatus('connected');
        setLastErrorAt(null);
        return;
      }

      if (
        subscriptionStatus === 'CHANNEL_ERROR' ||
        subscriptionStatus === 'TIMED_OUT' ||
        subscriptionStatus === 'CLOSED'
      ) {
        attemptsRef.current += 1;
        setLastErrorAt(Date.now());

        if (attemptsRef.current >= maxReconnectAttempts) {
          clearDegradeTimer();
          setStatus('degraded');
          return;
        }

        setStatus('reconnecting');
        // Si la reconnexion ne revient pas au vert dans degradedAfterMs,
        // on bascule explicitement en degraded pour activer le polling.
        clearDegradeTimer();
        degradeTimerRef.current = setTimeout(() => {
          setStatus((s) => (s === 'reconnecting' ? 'degraded' : s));
        }, degradedAfterMs);
      }
    });

    // Au reload de fenêtre / changement de focus, on force un check du canal.
    const onFocusOrOnline = () => {
      // supabase-js réessaie automatiquement, on s'aligne juste sur l'état actuel.
      if (channel.state === 'joined') {
        attemptsRef.current = 0;
        clearDegradeTimer();
        setStatus('connected');
      }
    };
    window.addEventListener('online', onFocusOrOnline);
    window.addEventListener('focus', onFocusOrOnline);
    const onOffline = () => {
      attemptsRef.current = Math.max(attemptsRef.current, 1);
      setStatus('reconnecting');
      clearDegradeTimer();
      degradeTimerRef.current = setTimeout(() => {
        setStatus((s) => (s === 'reconnecting' ? 'degraded' : s));
      }, degradedAfterMs);
    };
    window.addEventListener('offline', onOffline);

    return () => {
      clearDegradeTimer();
      window.removeEventListener('online', onFocusOrOnline);
      window.removeEventListener('focus', onFocusOrOnline);
      window.removeEventListener('offline', onOffline);
      void channel.unsubscribe();
    };
  }, [maxReconnectAttempts, degradedAfterMs]);

  return { status, lastErrorAt };
}
