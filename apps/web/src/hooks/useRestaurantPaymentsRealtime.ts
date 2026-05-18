import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type PaymentRow = {
  id: string;
  order_id: string | null;
  restaurant_id: string;
  status: string | null;
  amount?: number | string | null;
  transaction_ref?: string | null;
};

const PAID_STATUSES = new Set(['confirmed', 'completed']);

export function useRestaurantPaymentsRealtime(
  restaurantId: string | null,
  onPaymentCompleted: (payment: PaymentRow) => void,
) {
  const cbRef = useRef(onPaymentCompleted);
  cbRef.current = onPaymentCompleted;

  useEffect(() => {
    if (!restaurantId) return;

    const ch = supabase
      .channel(`payments-rt:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payments',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const p = payload.new as PaymentRow;
          const s = String(p.status || '').toLowerCase();
          if (PAID_STATUSES.has(s)) cbRef.current(p);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const next = payload.new as PaymentRow;
          const prev = payload.old as Partial<PaymentRow> | null;
          const nextStatus = String(next.status || '').toLowerCase();
          const prevStatus = String(prev?.status || '').toLowerCase();
          const nextIsPaid = PAID_STATUSES.has(nextStatus);
          const prevIsPaid = PAID_STATUSES.has(prevStatus);
          if (nextIsPaid && !prevIsPaid) cbRef.current(next);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [restaurantId]);
}

