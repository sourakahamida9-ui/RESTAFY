import { useCallback, useState } from 'react';
// ✅ FIX Bug 1 : sendEventTicket/EventTicketParams n'existent pas dans email.ts
// → remplacés par sendTicketConfirmation / TicketConfirmationParams
import { sendOrderCongratulations, sendTicketConfirmation } from '@/lib/email';
import type { OrderCongratulationsParams, TicketConfirmationParams } from '@/lib/email';

export function useEmailService() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOrderConfirmation = useCallback(async (params: OrderCongratulationsParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sendOrderCongratulations(params);
      if (!result.success) {
        throw new Error('Failed to send order confirmation email');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email';
      setError(message);
      console.error('[Email] Order email error:', message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ FIX Bug 1 : params typé avec TicketConfirmationParams et appel sendTicketConfirmation
  const sendTicketEmail = useCallback(async (params: TicketConfirmationParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sendTicketConfirmation(params);
      if (!result.success) {
        throw new Error('Failed to send ticket email');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email';
      setError(message);
      console.error('[Email] Ticket email error:', message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    sendOrderConfirmation,
    sendTicketEmail,
    loading,
    error,
  };
}