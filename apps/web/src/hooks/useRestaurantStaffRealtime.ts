import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Écoute les changements sur `restaurant_staff` pour ce restaurant (Supabase Realtime).
 * Activez la réplication pour la table dans Dashboard Supabase → Database → Replication si besoin.
 */
export function useRestaurantStaffRealtime(
  restaurantId: string | null,
  onChange: (event: 'INSERT' | 'UPDATE' | 'DELETE') => void,
) {
  const [channelState, setChannelState] = useState<'idle' | 'connecting' | 'subscribed' | 'error'>('idle');
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!restaurantId) {
      setChannelState('idle');
      return;
    }

    setChannelState('connecting');
    const handler = (payload: { eventType?: string }) => {
      const ev = payload.eventType;
      if (ev === 'INSERT' || ev === 'UPDATE' || ev === 'DELETE') {
        cbRef.current(ev);
      }
    };

    const ch = supabase
      .channel(`restaurant_staff:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_staff',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        handler,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setChannelState('subscribed');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setChannelState('error');
        else if (status === 'CLOSED') setChannelState('idle');
      });

    return () => {
      setChannelState('idle');
      void supabase.removeChannel(ch);
    };
  }, [restaurantId]);

  return { channelState };
}
