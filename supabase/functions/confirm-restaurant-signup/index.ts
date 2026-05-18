/**
 * Edge Function — même logique que app/api/auth/confirm-restaurant-signup
 * Déployer : supabase functions deploy confirm-restaurant-signup --no-verify-jwt
 * (l’appel est sécurisé par les contrôles userId + email + rôle + fenêtre temporelle)
 */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_AGE_MS = 48 * 60 * 60 * 1000;
// SECURITY: tight fallback window when the caller cannot present a signed
// `confirmToken` yet. The Vercel twin (`api/auth/index.ts`) already accepts
// HS256 proofs; until this function is redeployed with the matching verifier,
// we restrict the no-proof path to 10 minutes so account-takeover enumeration
// windows shrink from 48h to 10 min.
const LEGACY_CONFIRM_WINDOW_MS = 10 * 60 * 1000;

function metadataRoleMatchesExpected(
  meta: Record<string, unknown> | undefined,
  expected: 'client' | 'restaurant_owner',
): boolean {
  const roleStr = typeof meta?.role === 'string' ? meta.role.trim() : '';
  if (expected === 'client') {
    return roleStr === '' || roleStr === 'client';
  }
  return roleStr === 'restaurant_owner' || roleStr === 'restaurant';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Variables SUPABASE_URL / SERVICE_ROLE manquantes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let body: {
      userId?: string;
      email?: string;
      expectedRole?: 'client' | 'restaurant_owner';
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Corps JSON invalide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const expectedRole: 'client' | 'restaurant_owner' =
      body.expectedRole === 'client' ? 'client' : 'restaurant_owner';

    if (!userId || !email) {
      return new Response(JSON.stringify({ error: 'userId et email requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: got, error: getErr } = await admin.auth.admin.getUserById(userId);
    if (getErr || !got.user) {
      return new Response(JSON.stringify({ error: 'Utilisateur introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = got.user;
    if ((user.email || '').toLowerCase() !== email) {
      return new Response(JSON.stringify({ error: 'Email ne correspond pas à ce compte' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const meta = user.user_metadata as Record<string, unknown> | undefined;
    if (!metadataRoleMatchesExpected(meta, expectedRole)) {
      return new Response(JSON.stringify({ error: 'Rôle non autorisé' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (user.email_confirmed_at) {
      return new Response(JSON.stringify({ ok: true, alreadyConfirmed: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const created = user.created_at ? new Date(user.created_at).getTime() : 0;
    const ageMs = created ? Date.now() - created : Number.POSITIVE_INFINITY;
    // Hard ceiling (defence-in-depth): never auto-confirm accounts older than 48h.
    if (!created || ageMs > MAX_AGE_MS) {
      return new Response(
        JSON.stringify({
          error:
            'Délai d’inscription dépassé. Utilisez le lien reçu par e-mail ou recommencez l’inscription.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    // Tight legacy window while callers don't yet present `confirmToken`.
    if (ageMs > LEGACY_CONFIRM_WINDOW_MS) {
      console.warn('[confirm-restaurant-signup] legacy confirm refused (window expired)', { userId });
      return new Response(
        JSON.stringify({
          error:
            'Preuve d’inscription requise. Utilisez le lien reçu par e-mail ou recommencez l’inscription.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    if (updErr) {
      console.error('[confirm-restaurant-signup] updateUserById:', updErr);
      const base = supabaseUrl.replace(/\/$/, '');
      const adminUrl = `${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
      const payload = JSON.stringify({ email_confirm: true });
      const headers = {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      };
      let r = await fetch(adminUrl, { method: 'PUT', headers, body: payload });
      if (!r.ok && r.status === 405) {
        r = await fetch(adminUrl, { method: 'PATCH', headers, body: payload });
      }
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        return new Response(
          JSON.stringify({
            error: `SDK: ${updErr.message} | GoTrue: ${t.slice(0, 200)}`,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[confirm-restaurant-signup]', e);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
