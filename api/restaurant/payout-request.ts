/**
 * API pour demander un retrait vers le compte du restaurant
 * POST /api/restaurant/payout-request
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// NOTE: `safeParseResponse` inlined from `src/lib/http/safeParseResponse` — the
// cross-directory import was causing Vercel to emit FUNCTION_INVOCATION_FAILED
// at module-load time on this serverless function. Inlining the (tiny) helper
// restores payout requests without changing observable behaviour.
async function safeParseResponse(response: Response) {
  const raw = await response.text().catch(() => '');
  let data: any = null;
  let parseError: string | null = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'JSON parse error';
    const isHtml = raw.includes('<html') || raw.includes('<!DOCTYPE') || raw.includes('<body');
    const isServerError = raw.includes('server error') || raw.includes('Server Error') || raw.includes('A server');
    data = isHtml || isServerError ? null : raw;
  }

  const message = (() => {
    if (data && typeof data === 'object') return (data?.message || data?.error || data?.details) ?? null;
    if (typeof data === 'string') return data.slice(0, 160);
    if (data === null) {
      if (parseError) return 'Service de paiement temporairement indisponible. Veuillez réessayer plus tard.';
      const isHtml = raw.includes('<html') || raw.includes('<!DOCTYPE') || raw.includes('<body');
      const isServerError = raw.includes('server error') || raw.includes('Server Error') || raw.includes('A server');
      return isHtml || isServerError ? 'Service de paiement temporairement indisponible. Veuillez réessayer plus tard.' : raw.slice(0, 160);
    }
    return null;
  })();

  return { ok: response.ok, status: response.status, data, raw, message, parseError };
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Configuration serveur incomplète (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis).'
    );
  }
  return createClient<any, 'public', 'public'>(supabaseUrl, supabaseServiceKey);
}

// Configuration Genius Pay
const GENIUSPAY_BASE_URL = 'https://pay.genius.ci/api/v1/merchant';
const GENIUSPAY_PUBLIC_KEY = process.env.GENIUSPAY_PUBLIC_KEY || '';
const GENIUSPAY_SECRET_KEY = process.env.GENIUSPAY_SECRET_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ AUTH JWT - Vérifier le token Supabase
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  const token = authHeader.slice(7);

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      error: 'Configuration serveur incomplète (SUPABASE_URL + SUPABASE_ANON_KEY requis).',
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await (supabaseClient.auth as any).getUser();
  if (authError || !user) {
    console.error('[Payout] Auth error:', authError);
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }

  let supabaseAdmin: ReturnType<typeof createClient<any, 'public', 'public'>>;
  try {
    supabaseAdmin = getSupabaseAdmin() as typeof supabaseAdmin;
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Configuration serveur invalide',
    });
  }

  try {
    const { restaurant_id, amount, method, destination } = req.body;

    // Validation
    if (!restaurant_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Restaurant ID and amount required' });
    }

    // ✅ Vérifier que l'utilisateur est propriétaire du restaurant
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('restaurant_id, role, email')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[Payout] Profile not found:', profileError);
      return res.status(403).json({ error: 'Profil utilisateur non trouvé' });
    }

    if (profile.restaurant_id !== restaurant_id) {
      console.warn('[Payout] Unauthorized access attempt:', user.id, 'tried to access', restaurant_id);
      return res.status(403).json({ error: 'Accès refusé à ce restaurant' });
    }

    // Vérifier le rôle autorisé
    const allowedRoles = ['restaurant_owner', 'admin', 'manager'];
    if (!allowedRoles.includes(profile.role)) {
      return res.status(403).json({ error: 'Rôle non autorisé pour cette opération' });
    }

    if (!method || !['mobile_money', 'bank_transfer', 'geniuspay_wallet'].includes(method)) {
      return res.status(400).json({ error: 'Valid payout method required' });
    }

    // Vérifier que le restaurant a assez de fonds
    const { data: restaurant, error: restoError } = await supabaseAdmin
      .from('restaurants')
      .select('id, name, geniuspay_merchant_id, available_balance, pending_payout_amount')
      .eq('id', restaurant_id)
      .single();

    if (restoError || !restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const availableBalance = restaurant.available_balance || 0;
    const minPayout = 5000; // Minimum 5000 FCFA

    if (amount < minPayout) {
      return res.status(400).json({ 
        error: `Minimum payout amount is ${minPayout} XOF`,
        current_balance: availableBalance
      });
    }

    if (amount > availableBalance) {
      return res.status(400).json({ 
        error: 'Insufficient balance',
        requested: amount,
        available: availableBalance
      });
    }

    // Créer la demande de retrait
    const payoutRef = `PO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('restaurant_payouts')
      .insert({
        restaurant_id,
        amount,
        currency: 'XOF',
        status: 'pending',
        payout_method: method,
        destination_info: destination,
        geniuspay_payout_id: payoutRef,
      })
      .select()
      .single();

    if (payoutError) {
      console.error('[Payout] Error creating payout:', payoutError);
      return res.status(500).json({ error: 'Failed to create payout request' });
    }

    // Appeler l'API Genius Pay pour initier le retrait
    let geniusPayResponse;
    try {
      const payoutPayload = {
        amount: parseFloat(amount),
        currency: 'XOF',
        reference: payoutRef,
        destination: {
          type: method === 'mobile_money' ? 'mobile_money' : 'bank_account',
          ...destination,
        },
        metadata: {
          restaurant_id,
          payout_id: payout.id,
          internal_reference: payoutRef,
        },
      };

      const response = await fetch(`${GENIUSPAY_BASE_URL}/payouts`, {
        method: 'POST',
        headers: {
          'X-API-Key': GENIUSPAY_PUBLIC_KEY,
          'X-API-Secret': GENIUSPAY_SECRET_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payoutPayload),
      });

      const parsed = await safeParseResponse(response);
      geniusPayResponse = parsed.data;

      if (!response.ok) {
        const errMsg = typeof geniusPayResponse === 'string' ? geniusPayResponse : (geniusPayResponse?.message || 'Payout initiation failed');
          throw new Error(errMsg);
      }

    } catch (geniusErr: any) {
      console.error('[Payout] GeniusPay error:', geniusErr);
      
      // Marquer comme échoué
      await supabaseAdmin
        .from('restaurant_payouts')
        .update({
          status: 'failed',
          failure_reason: geniusErr.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payout.id);

      return res.status(502).json({
        error: 'Payout service temporarily unavailable',
        details: geniusErr.message,
      });
    }

    // Mettre à jour le statut et bloquer les fonds
    await supabaseAdmin
      .from('restaurants')
      .update({
        available_balance: availableBalance - amount,
        pending_payout_amount: (restaurant.pending_payout_amount || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', restaurant_id);

    // Mettre à jour le payout avec l'ID Genius Pay
    await supabaseAdmin
      .from('restaurant_payouts')
      .update({
        geniuspay_payout_id: geniusPayResponse.data?.id || payoutRef,
        status: 'processing',
        initiated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payout.id);

    return res.status(200).json({
      success: true,
      payout_id: payout.id,
      reference: payoutRef,
      amount,
      method,
      status: 'processing',
      estimated_completion: method === 'mobile_money' ? 'instant' : '24-48h',
      message: 'Payout request submitted successfully',
    });

  } catch (err: any) {
    console.error('[Payout] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
