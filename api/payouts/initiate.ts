import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const GENIUSPAY_BASE_URL = process.env.GENIUSPAY_BASE_URL || 'https://pay.genius.ci/api/v1/merchant';
const GENIUSPAY_PUBLIC_KEY = process.env.GENIUSPAY_PUBLIC_KEY || '';
const GENIUSPAY_SECRET_KEY = process.env.GENIUSPAY_SECRET_KEY || '';

const ALLOWED_ORIGINS = [
  'https://app.restafy.shop',
  'https://restafy.shop',
  'https://www.restafy.shop',
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'restafy.shop' || hostname.endsWith('.restafy.shop')) return true;
    if (hostname.endsWith('.vercel.app')) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return false;
  } catch {
    return false;
  }
}

function applyCors(res: VercelResponse, req: VercelRequest): void {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const allowedOrigin = isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ─── Email "Retrait initié" au propriétaire du restaurant ─────────────────
// Le retrait passe par GeniusPay et est confirmé via webhook payout.completed.
// Cet email est envoyé en amont — dès l'initiation OK — pour que le
// restaurateur ait une trace écrite de la demande, du montant et de la
// référence (utile en cas de support/contestation).

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

async function sendPayoutInitiatedEmail(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  args: {
    restaurantId: string | null;
    reference: string;
    amount: number;
    currency: string;
    recipientPhone: string;
    recipientName: string | null;
    initiatedAt: string;
  },
): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[Payout] RESEND_API_KEY not set — skipping owner email');
    return;
  }
  if (!args.restaurantId) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('restaurant_id', args.restaurantId)
    .in('role', ['restaurant_owner', 'restaurant', 'admin'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!profile?.email) return;

  const { data: rest } = await supabase
    .from('restaurants')
    .select('available_balance, pending_payout_amount, name')
    .eq('id', args.restaurantId)
    .maybeSingle();

  const fmtAmount = (n: number) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const ownerName = profile.full_name ?? rest?.name ?? '';
  const balance = rest?.available_balance ?? null;
  const pending = rest?.pending_payout_amount ?? null;

  const rows = [
    { label: 'Type', value: 'Retrait initié' },
    { label: 'Montant', value: fmtAmount(args.amount), emphasize: true },
    { label: 'Bénéficiaire', value: args.recipientName || '—' },
    { label: 'Numéro Mobile Money', value: args.recipientPhone },
    { label: 'Référence', value: args.reference },
    { label: 'Date', value: fmtDate(args.initiatedAt) },
    ...(balance !== null ? [{ label: 'Solde disponible', value: fmtAmount(balance) }] : []),
    ...(pending !== null ? [{ label: 'En attente', value: fmtAmount(pending) }] : []),
  ];

  const rowsHtml = rows
    .map(
      (r) => `<tr>
        <td style="padding:10px 0;color:#6b7280;font-size:13px;">${r.label}</td>
        <td style="padding:10px 0;text-align:right;font-weight:${(r as any).emphasize ? '700' : '600'};color:${(r as any).emphasize ? '#FF6B00' : '#111827'};font-size:${(r as any).emphasize ? '17px' : '14px'};">${r.value}</td>
      </tr>`,
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f3f4f6;">
  <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <div style="background:linear-gradient(135deg,#FF6B00,#e85d04);padding:28px 24px;">
      <h1 style="color:white;margin:0;font-size:20px;letter-spacing:-0.01em;">Retrait initié</h1>
    </div>
    <div style="padding:28px 24px;">
      <p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.6;">
        Bonjour${ownerName ? ` <strong>${ownerName}</strong>` : ''}, votre demande de retrait a été
        transmise à GeniusPay. Vous recevrez un second email dès que le transfert
        Mobile Money est confirmé sur le numéro indiqué.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
        ${rowsHtml}
      </table>
      <p style="margin:18px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">
        Si vous n'êtes pas à l'origine de cette opération, contactez le support
        Restafy immédiatement à <a href="mailto:support@restafy.shop" style="color:#FF6B00;">support@restafy.shop</a>.
      </p>
    </div>
    <div style="background:#f9fafb;padding:14px 24px;text-align:center;color:#9ca3af;font-size:11px;">
      Restafy — restafy.shop · Cet email est automatique, ne pas y répondre.
    </div>
  </div>
</body></html>`.trim();

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Restafy <noreply@app.restafy.shop>',
        to: [profile.email],
        subject: `Restafy — Retrait initié (${fmtAmount(args.amount)})`,
        html,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[Payout] Resend HTTP', resp.status, errBody);
    }
  } catch (err) {
    console.error('[Payout] sendPayoutInitiatedEmail failed:', err);
  }
}

async function readJsonSafe(resp: Response): Promise<{ data: any; raw: string; contentType: string }> {
  const contentType = resp.headers.get('content-type') || '';
  const raw = await resp.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  return { data, raw, contentType };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, req);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!GENIUSPAY_PUBLIC_KEY || !GENIUSPAY_SECRET_KEY) {
    // Mode Kkiapay-only : Kkiapay ne propose pas d'API de payout automatisée.
    // Les retraits doivent passer par le dashboard admin Kkiapay ou un
    // virement Mobile Money manuel. On renvoie 501 Not Implemented pour que
    // le frontend affiche un message clair au propriétaire plutôt qu'un 500
    // générique.
    return res.status(501).json({
      error: 'Payout API unavailable',
      details:
        'Restafy a migré à 100% sur Kkiapay, qui ne propose pas d\'API de retrait automatisée. ' +
        'Les retraits doivent être effectués manuellement via https://app.kkiapay.me/dashboard ou ' +
        'par virement Mobile Money. Contactez l\'équipe support pour activer ce flux.',
      support_email: 'support@app.restafy.shop',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const {
      amount,
      currency = 'XOF',
      recipient_name,
      recipient_phone,
      note,
      order_id = null,
      restaurant_id = null,
      metadata = {},
    } = body || {};

    // Normalisation robuste du numéro de téléphone (par défaut +229)
    let normalizedPhone = String(recipient_phone || '').trim();
    // Supprimer tous les espaces, tirets, parenthèses
    normalizedPhone = normalizedPhone.replace(/[\s\-\(\)]/g, '');
    // Par défaut, ajouter +229 si pas déjà présent
    if (!normalizedPhone.startsWith('+229') && !normalizedPhone.startsWith('00229')) {
      if (normalizedPhone.startsWith('229') && normalizedPhone.length === 11) {
        normalizedPhone = '+' + normalizedPhone;
      } else if (normalizedPhone.length === 10 && normalizedPhone.startsWith('0')) {
        normalizedPhone = '+229' + normalizedPhone.substring(1);
      } else if (normalizedPhone.length === 8) {
        normalizedPhone = '+229' + normalizedPhone;
      } else {
        // Pour tout autre format, ajouter +229 par défaut
        normalizedPhone = '+229' + normalizedPhone;
      }
    }
    const normalizedName = String(recipient_name || '').trim();

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount required and must be positive' });
    }
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Recipient phone required' });
    }

    const reference = `PAYOUT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const payoutPayload = {
      amount: Number(amount),
      currency,
      reference,
      note: note || 'Transfert Restafy',
      recipient: {
        name: normalizedName || 'Client Restafy',
        phone: normalizedPhone,
      },
      metadata: {
        ...metadata,
        order_id,
        restaurant_id,
      },
    };

    const endpoint = `${GENIUSPAY_BASE_URL}/payouts`;
    const payoutResp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-Key': GENIUSPAY_PUBLIC_KEY,
        'X-API-Secret': GENIUSPAY_SECRET_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'Restafy/1.0',
      },
      body: JSON.stringify(payoutPayload),
    });

    const { data: payoutData, raw: payoutRaw, contentType: payoutCt } = await readJsonSafe(payoutResp);

    if (!payoutResp.ok) {
      return res.status(payoutResp.status).json({
        error: 'Payout initiation failed',
        details:
          payoutData?.message ||
          payoutData?.error ||
          (payoutRaw ? `Réponse non-JSON (${payoutCt || 'content-type inconnu'}): ${payoutRaw.slice(0, 180)}` : 'Erreur inconnue GeniusPay'),
      });
    }

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('payments').upsert(
        {
          transaction_ref: reference,
          order_id,
          restaurant_id,
          amount: Number(amount),
          currency,
          method: 'geniuspay',
          provider: 'geniuspay_payout',
          status: 'processing',
          customer_name: normalizedName || null,
          customer_phone: normalizedPhone || null,
          provider_response: {
            initiated_at: new Date().toISOString(),
            payout_id: payoutData?.id || null,
            raw: payoutData,
          },
        },
        { onConflict: 'transaction_ref' },
      );
    } catch (dbErr) {
      console.error('[Payout] DB upsert error (non-blocking):', dbErr);
    }

    // Email "retrait initié" au propriétaire — best-effort, ne bloque pas
    // la réponse au client si Resend tombe.
    try {
      const supabaseAdmin = getSupabaseAdmin();
      await sendPayoutInitiatedEmail(supabaseAdmin, {
        restaurantId: restaurant_id ?? null,
        reference,
        amount: Number(amount),
        currency,
        recipientPhone: normalizedPhone,
        recipientName: normalizedName || null,
        initiatedAt: new Date().toISOString(),
      });
    } catch (mailErr) {
      console.error('[Payout] sendPayoutInitiatedEmail outer failed:', mailErr);
    }

    return res.status(200).json({
      success: true,
      reference,
      payout_id: payoutData?.id || null,
      status: payoutData?.status || 'processing',
      provider_response: payoutData,
    });
  } catch (error) {
    console.error('[Payout] Error:', error);
    return res.status(500).json({
      error: 'Payout initiation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
