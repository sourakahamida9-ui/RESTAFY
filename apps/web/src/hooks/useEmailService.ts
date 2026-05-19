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
      const message = 'Impossible d\'envoyer l\'email de confirmation.';
      setError(message);
      if (import.meta.env.DEV) console.error('[Email] Order email error:', err);
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
      const message = 'Impossible d\'envoyer l\'email du billet.';
      setError(message);
      if (import.meta.env.DEV) console.error('[Email] Ticket email error:', err);
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
