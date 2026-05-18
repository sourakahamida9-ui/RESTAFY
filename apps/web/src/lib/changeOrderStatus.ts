/**
 * changeOrderStatus — resilient wrapper around RPC change_order_status.
 *
 * If the RPC fails because the `order_events` table is missing (migration
 * 077 / 110 not yet applied), falls back to a direct UPDATE on `orders`.
 * This keeps order management functional while the DBA applies the fix.
 */

import { supabase } from '@/lib/supabase';

interface ChangeResult {
  ok: boolean;
  error?: string;
  from?: string;
  to?: string;
  fallback?: boolean;
}

const ORDER_EVENTS_MISSING_RE = /order_events|does not exist/i;

export async function changeOrderStatus(
  orderId: string,
  newStatus: string,
  device: 'desktop' | 'mobile' | 'pos' = 'desktop',
): Promise<ChangeResult> {
  // Try the proper RPC first
  const { data, error } = await supabase.rpc('change_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_device: device,
  });

  const result = data as ChangeResult | null;

  // Happy path
  if (!error && result?.ok) {
    return { ok: true, from: result.from, to: result.to };
  }

  // If the error is about missing order_events table, fall back to direct UPDATE
  const errMsg = error?.message ?? result?.error ?? '';
  if (ORDER_EVENTS_MISSING_RE.test(errMsg)) {
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (!updateErr) {
      return { ok: true, fallback: true };
    }
    return { ok: false, error: updateErr.message };
  }

  // Other errors pass through
  if (result?.error === 'invalid_transition') {
    return { ok: false, error: 'invalid_transition', from: result.from, to: result.to };
  }
  return { ok: false, error: errMsg || 'unknown' };
}
