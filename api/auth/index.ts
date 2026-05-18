/**
 * Auth API consolidée - Vercel Serverless
 * POST /api/auth?action=register|confirm
 * 
 * Regroupe :
 * - /api/auth/register-confirmed (création compte)
 * - /api/auth/confirm-restaurant-signup (confirmation email)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SignJWT, jwtVerify } from 'jose';

// NOTE: helpers inlined from `src/lib/api/supabaseAuthAdmin`. The cross-directory
// import was causing Vercel to emit FUNCTION_INVOCATION_FAILED at module-load
// time (handler never runs, OPTIONS returns 500), which broke account signup
// and email confirmation in production. Inlining eliminates the flaky bundler
// resolution without duplicating business logic that lives in other modules.

// ──────────────────────────────────────────────────────────────────────────
// Signup-confirm proof (HS256 JWT signed with the service-role key).
//
// Historically `/api/auth?action=confirm` would auto-confirm any pending
// account given only `userId + email`. Anyone who enumerated a freshly
// created user could confirm in the victim's place (account takeover before
// first login). We now require a short-lived signed token issued at
// registration time and either carried in-memory by the client or re-issued
// via a trusted server channel.
// ──────────────────────────────────────────────────────────────────────────
const SIGNUP_PROOF_TYP = 'restafy/signup-confirm@1';
const SIGNUP_PROOF_TTL_SECONDS = 15 * 60; // 15 minutes
// Window in which we accept a confirm call WITHOUT a signed proof, for
// backward-compatibility with older clients (Edge Function, stale bundles).
// A fresh `confirmation_sent_at < 10 min` is an OK stand-in for "user just
// signed up on this device". After Sprint 2 rolls out everywhere, flip this
// to zero.
const LEGACY_CONFIRM_WINDOW_MS = 10 * 60 * 1000;

function getSignupProofSecret(serviceKey: string): Uint8Array {
  return new TextEncoder().encode(serviceKey);
}

async function issueSignupConfirmToken(
  serviceKey: string,
  userId: string,
  email: string,
): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SIGNUP_PROOF_TTL_SECONDS)
    .setAudience(SIGNUP_PROOF_TYP)
    .sign(getSignupProofSecret(serviceKey));
}

async function verifySignupConfirmToken(
  serviceKey: string,
  token: string,
  expectedUserId: string,
  expectedEmail: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const { payload } = await jwtVerify(token, getSignupProofSecret(serviceKey), {
      audience: SIGNUP_PROOF_TYP,
    });
    if (payload.sub !== expectedUserId) return { ok: false, reason: 'userId mismatch' };
    const payloadEmail = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    if (payloadEmail !== expectedEmail.toLowerCase()) return { ok: false, reason: 'email mismatch' };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'invalid token' };
  }
}

function getSupabaseUrlForServer(): string | undefined {
  const candidates = [
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
    process.env.PUBLIC_SUPABASE_URL,
  ];
  for (const c of candidates) {
    const t = typeof c === 'string' ? c.trim() : '';
    if (t && /^https:\/\//i.test(t)) return t.replace(/\/$/, '');
  }
  return undefined;
}

function getServiceRoleKeyForServer(): string | undefined {
  const candidates = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_SERVICE_ROLE_KEY,
  ];
  for (const c of candidates) {
    const t = typeof c === 'string' ? c.trim() : '';
    if (t.length > 40) return t;
  }
  return undefined;
}

function createServiceRoleClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type AuthAdminApi = {
  createUser: (args: {
    email: string;
    password: string;
    email_confirm?: boolean;
    user_metadata?: Record<string, unknown>;
  }) => Promise<{
    data: { user: { id: string } | null } | null;
    error: { message: string } | null;
  }>;
  getUserById: (userId: string) => Promise<{
    data: {
      user: {
        id: string;
        email?: string;
        email_confirmed_at?: string | null;
        created_at?: string;
        user_metadata?: Record<string, unknown>;
      };
    } | null;
    error: { message: string } | null;
  }>;
  updateUserById: (
    userId: string,
    attrs: { email_confirm?: boolean },
  ) => Promise<{ error: { message: string } | null }>;
};

function getAuthAdmin(client: { auth: unknown }): AuthAdminApi {
  return (client.auth as { admin: AuthAdminApi }).admin;
}

async function confirmUserEmailViaGoTrue(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
): Promise<{ error?: string }> {
  const base = supabaseUrl.replace(/\/$/, '');
  const url = `${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
  const payload = JSON.stringify({ email_confirm: true });
  const headers = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    'Content-Type': 'application/json',
  } as const;

  async function one(method: 'PUT' | 'PATCH') {
    const r = await fetch(url, { method, headers, body: payload });
    const text = await r.text().catch(() => '');
    return { r, text };
  }

  let { r, text } = await one('PUT');
  if (!r.ok && r.status === 405) {
    ({ r, text } = await one('PATCH'));
  }
  if (!r.ok) {
    try {
      const j = JSON.parse(text) as { msg?: string; error?: string; message?: string };
      const m = j.msg || j.error || j.message || text;
      return { error: (m || `HTTP ${r.status}`).slice(0, 400) };
    } catch {
      return { error: (text || `HTTP ${r.status}`).slice(0, 400) };
    }
  }
  return {};
}

const MAX_AGE_MS = 48 * 60 * 60 * 1000;

// CORS — uses centralized config; auth also allows the `apikey` header.
import { applyCors as _baseCors } from '../_shared/cors';
function applyCors(res: VercelResponse, req: VercelRequest): void {
  _baseCors(res, req);
  // auth endpoint additionally needs the `apikey` header
  const prev = String(res.getHeader('Access-Control-Allow-Headers') || '');
  if (!prev.includes('apikey')) {
    res.setHeader('Access-Control-Allow-Headers', prev + ', apikey');
  }
}

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

// ============ REGISTER ============
async function handleRegister(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = getSupabaseUrlForServer();
  const serviceKey = getServiceRoleKeyForServer();
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: 'Configuration serveur : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis',
    });
  }

  const supabaseAdmin = createServiceRoleClient(supabaseUrl, serviceKey);
  const authAdmin = getAuthAdmin(supabaseAdmin);

  let body: any = req.body;
  if (typeof req.body === 'string') {
    try { body = JSON.parse(req.body); } catch {
      return res.status(400).json({ error: 'Corps JSON invalide' });
    }
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const role = body.role === 'restaurant_owner' ? 'restaurant_owner' : 'client';
  const restaurantName = typeof body.restaurantName === 'string' ? body.restaurantName.trim() : undefined;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail et mot de passe requis' });
  }
  if (!fullName || !phone) {
    return res.status(400).json({ error: 'Nom complet et numéro de téléphone requis' });
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({
      error: 'Mot de passe trop faible : au moins 8 caractères, avec au moins une lettre et un chiffre.',
    });
  }
  if (role === 'restaurant_owner' && !restaurantName) {
    return res.status(400).json({ error: 'Le nom du restaurant est requis pour un compte partenaire' });
  }

  const { data, error } = await authAdmin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || undefined, phone: phone || undefined, role, restaurant_name: role === 'restaurant_owner' ? restaurantName || undefined : undefined },
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? '';
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return res.status(409).json({ error: 'Cette adresse e-mail est déjà utilisée. Essayez de vous connecter.' });
    }
    if (msg.includes('weak') || msg.includes('password')) {
      return res.status(400).json({ error: 'Mot de passe refusé : utilisez au moins 8 caractères avec des lettres et des chiffres.' });
    }
    console.error('[auth/register]', error.message);
    return res.status(400).json({ error: error.message || 'Impossible de créer le compte' });
  }

  if (!data.user?.id) {
    return res.status(500).json({ error: 'Création du compte : réponse Auth sans identifiant utilisateur' });
  }

  const userId = data.user.id;
  const profileRow = { id: userId, full_name: fullName || email.split('@')[0], phone: phone || null, role, email, updated_at: new Date().toISOString() };
  
  let { error: profErr } = await supabaseAdmin.from('profiles').upsert(profileRow, { onConflict: 'id' });
  const phoneConflict = profErr && (profErr.code === '23505' || String(profErr.message || '').toLowerCase().includes('phone'));
  if (phoneConflict) {
    const { error: retryErr } = await supabaseAdmin.from('profiles').upsert({ ...profileRow, phone: null }, { onConflict: 'id' });
    if (retryErr) console.error('[auth/register] profile retry sans téléphone:', retryErr);
    else profErr = null;
  }
  if (profErr) console.error('[auth/register] profile upsert:', profErr);

  if (role === 'restaurant_owner' && restaurantName) {
    const { data: prof, error: profReadErr } = await supabaseAdmin.from('profiles').select('restaurant_id').eq('id', userId).maybeSingle();
    if (profReadErr) console.error('[auth/register] profile read:', profReadErr);
    else if (!prof?.restaurant_id) {
      const slug = `${restaurantName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now().toString(36)}`;
      const { data: resto, error: restoErr } = await supabaseAdmin.from('restaurants').insert([{ name: restaurantName.trim(), slug, owner_id: userId, is_active: true, is_open: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]).select('id').single();
      if (restoErr) console.error('[auth/register] restaurant insert:', restoErr);
      else if (resto?.id) {
        const { error: linkErr } = await supabaseAdmin.from('profiles').update({ restaurant_id: resto.id }).eq('id', userId);
        if (linkErr) console.error('[auth/register] profile restaurant_id:', linkErr);
      }
    }
  }

  // Emit a short-lived proof the caller can hand back to /api/auth?action=confirm
  // if they choose to auto-confirm the account from this browser session. If
  // the caller never calls confirm (default for register-confirmed, which
  // already sets email_confirm: true), the token simply expires unused.
  let confirmToken: string | undefined;
  try {
    confirmToken = await issueSignupConfirmToken(serviceKey, userId, email);
  } catch (e) {
    console.error('[auth/register] issueSignupConfirmToken', e);
  }

  return res.status(200).json({ ok: true, userId, confirmToken });
}

// ============ CONFIRM ============
async function handleConfirm(req: VercelRequest, res: VercelResponse) {
  const url = getSupabaseUrlForServer();
  const key = getServiceRoleKeyForServer();
  if (!url || !key) {
    return res.status(500).json({ error: 'Configuration serveur : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis' });
  }

  const supabaseAdmin = createServiceRoleClient(url, key);
  const authAdmin = getAuthAdmin(supabaseAdmin);

  let body: any = req.body;
  if (typeof req.body === 'string') {
    try { body = JSON.parse(req.body); } catch {
      return res.status(400).json({ error: 'Corps JSON invalide' });
    }
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const expectedRole: 'client' | 'restaurant_owner' = body.expectedRole === 'client' ? 'client' : 'restaurant_owner';
  const confirmToken = typeof body.confirmToken === 'string' ? body.confirmToken.trim() : '';

  if (!userId || !email) {
    return res.status(400).json({ error: 'userId et email requis' });
  }

  // If the caller presents a signup-confirm proof (issued by /register),
  // verify it up-front. A valid proof binds userId+email cryptographically
  // and closes the enumeration window that existed with the legacy flow.
  let proofVerified = false;
  if (confirmToken) {
    const v = await verifySignupConfirmToken(key, confirmToken, userId, email);
    if (v.ok === true) {
      proofVerified = true;
    } else {
      console.warn('[auth/confirm] invalid confirmToken', { userId, reason: v.reason });
      return res.status(403).json({ error: 'Preuve d\'inscription invalide ou expirée' });
    }
  }

  const { data: got, error: getErr } = await authAdmin.getUserById(userId);
  if (getErr || !got.user) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }

  const user = got.user;
  if ((user.email || '').toLowerCase() !== email) {
    return res.status(403).json({ error: 'Email ne correspond pas à ce compte' });
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (!metadataRoleMatchesExpected(meta, expectedRole)) {
    return res.status(403).json({ error: 'Rôle non autorisé pour cette opération' });
  }

  if (user.email_confirmed_at) {
    const fullNameEarly = typeof meta?.full_name === 'string' ? meta.full_name.trim() : '';
    const phoneEarly = typeof meta?.phone === 'string' ? meta.phone.trim() : '';
    const rowEarly = { id: userId, full_name: fullNameEarly || email.split('@')[0], phone: phoneEarly || null, role: expectedRole, email, updated_at: new Date().toISOString() };
    const { error: profEarly } = await supabaseAdmin.from('profiles').upsert(rowEarly, { onConflict: 'id' });
    if (profEarly) console.error('[auth/confirm] profile (alreadyConfirmed):', profEarly);
    return res.status(200).json({ ok: true, alreadyConfirmed: true });
  }

  // Legacy path — no signed proof. We accept only a very short post-signup
  // window (10 min), far below the original 48h, so enumeration windows
  // shrink drastically even before all clients ship the confirmToken.
  if (!proofVerified) {
    const created = user.created_at ? new Date(user.created_at).getTime() : 0;
    if (!created || Date.now() - created > LEGACY_CONFIRM_WINDOW_MS) {
      console.warn('[auth/confirm] legacy confirm refused (no proof, window expired)', { userId });
      return res.status(403).json({
        error: 'Preuve d\'inscription requise. Utilisez le lien reçu par e-mail ou recommencez l\'inscription.',
      });
    }
  }

  // Defence in depth: keep the original 48h hard ceiling even when a proof
  // is provided, so a leaked old token can't confirm a stale account.
  const created = user.created_at ? new Date(user.created_at).getTime() : 0;
  if (!created || Date.now() - created > MAX_AGE_MS) {
    return res.status(403).json({ error: 'Délai d\'inscription dépassé. Utilisez le lien reçu par e-mail ou recommencez l\'inscription.' });
  }

  const { error: updErr } = await authAdmin.updateUserById(userId, { email_confirm: true });
  if (updErr) {
    console.error('[auth/confirm] updateUserById:', updErr.message);
    const rest = await confirmUserEmailViaGoTrue(url, key, userId);
    if (rest.error) {
      return res.status(500).json({ error: `Confirmation e-mail échouée: ${updErr.message} | ${rest.error}` });
    }
  }

  const fullName = typeof meta?.full_name === 'string' ? meta.full_name.trim() : '';
  const phoneMeta = typeof meta?.phone === 'string' ? meta.phone.trim() : '';
  const profileRow = { id: userId, full_name: fullName || email.split('@')[0], phone: phoneMeta || null, role: expectedRole, email, updated_at: new Date().toISOString() };
  const { error: profErr } = await supabaseAdmin.from('profiles').upsert(profileRow, { onConflict: 'id' });
  if (profErr) console.error('[auth/confirm] profile upsert:', profErr);

  return res.status(200).json({ ok: true });
}

// ============ MAIN HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query?.action as string;

  try {
    if (action === 'register') {
      return await handleRegister(req, res);
    } else if (action === 'confirm') {
      return await handleConfirm(req, res);
    } else {
      return res.status(400).json({ error: 'Paramètre action requis: register ou confirm' });
    }
  } catch (e) {
    console.error('[auth]', e);
    const detail = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: `Erreur serveur: ${detail}`.slice(0, 400) });
  }
}
