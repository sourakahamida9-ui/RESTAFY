import { supabase } from './supabase';
import { safeParseResponse } from '@/lib/http/safeParseResponse';
import { authedSendEmailFetch } from './sendEmailClient';

/**
 * Enregistre les tentatives d'envoi d'email pour déboguer
 */
export async function logEmailAttempt(data: {
  recipient: string;
  subject: string;
  type: string;
  order_id?: string;
  success: boolean;
  error?: string;
  timestamp?: string;
}) {
  try {
    // Optionnel: Enregistrer aussi dans la base de données pour analyse
    if (import.meta.env.VITE_LOG_EMAILS_TO_DB === 'true') {
      await supabase.from('email_logs').insert([
        {
          recipient: data.recipient,
          subject: data.subject,
          type: data.type,
          order_id: data.order_id,
          success: data.success,
          error: data.error,
          created_at: new Date().toISOString(),
        },
      ]);
    }
  } catch (err) {
    console.error('[v0] Failed to log email attempt:', err);
  }
}

/**
 * Envoie un email de test via l'API serverless securisee
 * SECURITE: N'utilise plus VITE_BREVO_API_KEY cote client
 */
export async function sendTestEmail(recipientEmail: string) {
  try {
    if (import.meta.env.DEV) console.log('[EmailLog] Sending test email to:', recipientEmail);

    // Utilise l'API serverless /api/send-email pour eviter d'exposer les cles API
    const response = await authedSendEmailFetch({
      to: recipientEmail,
      subject: 'Email de test Restafy',
      htmlContent: `
        <h2>Email de test</h2>
        <p>Cet email de test a été envoyé avec succès!</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
    });

    const { ok, status, data, raw, message } = await safeParseResponse(response);
    // `ok` and `message` can be used by the caller if needed

    if (!response.ok || !data.success) {
      if (import.meta.env.DEV) console.error('[EmailLog] Send error:', data);
      logEmailAttempt({
        recipient: recipientEmail,
        subject: 'Email de test',
        type: 'test',
        success: false,
        error: JSON.stringify(data.error || data),
      });
      return { success: false, error: data.error || 'Echec envoi' };
    }

    if (import.meta.env.DEV) console.log('[EmailLog] Test email sent successfully');
    logEmailAttempt({
      recipient: recipientEmail,
      subject: 'Email de test',
      type: 'test',
      success: true,
    });

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (import.meta.env.DEV) console.error('[EmailLog] Test email error:', errorMsg);
    logEmailAttempt({
      recipient: recipientEmail,
      subject: 'Email de test',
      type: 'test',
      success: false,
      error: errorMsg,
    });
    return { success: false, error: errorMsg };
  }
}
