/**
 * POST — formulaire « Rejoindre Restafy » (vitrine → Supabase).
 * Route : /api/partner-join-request
 * Variables Vercel : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optionnel PARTNER_JOIN_CORS_ORIGINS.
 *
 * L’ancienne URL /api/public/partner-join-request réexporte ce handler (compatibilité).
 * Aligner les changements avec landing/api/partner-join-request.ts.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_shared/supabaseAdmin';
import { checkRateLimit, getClientIp } from './_shared/rateLimit';

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
  const candidates = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_SERVICE_ROLE_KEY];
  for (const c of candidates) {
    const t = typeof c === 'string' ? c.trim() : '';
    if (t.length > 40) return t;
  }
  return undefined;
}

const DEFAULT_ORIGINS = [
  'https://www.restafy.shop',
  'https://restafy.shop',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

function allowedOrigins(): string[] {
  const raw = process.env.PARTNER_JOIN_CORS_ORIGINS;
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_ORIGINS;
}

function isOriginAllowed(origin: string): boolean {
  if (origin === 'null') return true;
  if (!origin) return false;
  const list = allowedOrigins();
  if (list.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'restafy.shop' || hostname.endsWith('.restafy.shop')) return true;
    if (hostname.endsWith('.vercel.app')) return true;
    return false;
  } catch {
    return false;
  }
}

function applyCors(res: VercelResponse, req: VercelRequest): void {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const list = allowedOrigins();
  const value = isOriginAllowed(origin) ? origin : list[0] || '*';
  res.setHeader('Access-Control-Allow-Origin', value);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function insertErrorMessage(error: { code?: string; message?: string }): string {
  const msg = error.message || '';
  if (error.code === 'PGRST205' || msg.includes('relation') || msg.includes('does not exist')) {
    return 'Table partner_join_requests absente : exécutez scripts/083-partner-join-requests.sql sur Supabase.';
  }
  if (error.code === '42501' || /permission denied|rls/i.test(msg)) {
    return 'Droits base insuffisants : exécutez scripts/087-partner-join-grant-service-role.sql sur Supabase (GRANT INSERT pour service_role).';
  }
  return 'Enregistrement impossible. Réessayez plus tard.';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Rate limit IP-based : ce formulaire est public, sans auth, et alimente
  // la table partner_join_requests. 5 soumissions / 5 minutes / IP suffit
  // largement pour un humain et bloque les bots qui spammeraient.
  // Fail-open en cas d'erreur Supabase.
  {
    const ip = getClientIp(req.headers);
    const rl = await checkRateLimit({
      bucket: 'partner_join',
      identity: `ip:${ip}`,
      limit: 5,
      windowSeconds: 300,
    });
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter));
      return res.status(429).json({
        ok: false,
        error: `Trop de demandes. Réessayez dans ${Math.ceil(rl.retryAfter / 60)} min.`,
      });
    }
  }

  const url = getSupabaseUrlForServer();
  const key = getServiceRoleKeyForServer();
  if (!url || !key) {
    return res.status(500).json({
      ok: false,
      error: 'Configuration serveur incomplète (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).',
    });
  }

  let body: Record<string, unknown>;
  try {
    body =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as Record<string, unknown>)
        : ((req.body as Record<string, unknown>) ?? {});
  } catch {
    return res.status(400).json({ ok: false, error: 'JSON invalide' });
  }

  const honeypot = typeof body.website === 'string' ? body.website.trim() : '';
  if (honeypot.length > 0) {
    return res.status(200).json({ ok: true });
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const restaurantName = typeof body.restaurantName === 'string' ? body.restaurantName.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (fullName.length < 2 || fullName.length > 200) {
    return res.status(400).json({ ok: false, error: 'Nom complet invalide (2–200 caractères).' });
  }
  if (!isValidEmail(email) || email.length > 320) {
    return res.status(400).json({ ok: false, error: 'Adresse e-mail invalide.' });
  }
  if (restaurantName.length < 2 || restaurantName.length > 200) {
    return res.status(400).json({ ok: false, error: 'Nom de l’établissement requis (2–200 caractères).' });
  }
  if (phone.length > 60) {
    return res.status(400).json({ ok: false, error: 'Téléphone trop long.' });
  }
  if (city.length > 120) {
    return res.status(400).json({ ok: false, error: 'Ville trop longue.' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ ok: false, error: 'Message trop long.' });
  }

  const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const sourceHost =
    originHeader.replace(/^https?:\/\//i, '').split('/')[0]?.slice(0, 200) || null;

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (err) {
    // Defense in depth: la validation locale lignes 110-117 couvre déjà ce
    // cas, mais si jamais les env-var fallbacks divergeaient on retourne un
    // 500 propre au lieu de laisser l'exception remonter et crasher Vercel.
    console.error('[partner-join-request] Supabase admin unavailable:', err);
    return res.status(500).json({
      ok: false,
      error: 'Configuration serveur incomplète (Supabase admin client).',
    });
  }

  const { error } = await admin.from('partner_join_requests').insert({
    full_name: fullName,
    email,
    phone: phone || null,
    restaurant_name: restaurantName,
    city: city || null,
    message: message || null,
    status: 'pending',
    source_host: sourceHost,
  });

  if (error) {
    console.error('[partner-join-request]', error);
    return res.status(500).json({
      ok: false,
      error: insertErrorMessage(error),
    });
  }

  return res.status(200).json({ ok: true });
}
