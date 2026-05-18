/**
 * Avec la clé service_role, `auth.admin` existe à l'exécution.
 * Les types par défaut de createClient() n'exposent pas toujours `admin` → TS2339 sur Vercel.
 */
import { createClient } from '@supabase/supabase-js';

/** Vercel / Node : `VITE_*` n’est pas toujours injecté dans les serverless — dupliquer l’URL en SUPABASE_URL. */
export function getSupabaseUrlForServer(): string | undefined {
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

export function getServiceRoleKeyForServer(): string | undefined {
  const candidates = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_SERVICE_ROLE_KEY];
  for (const c of candidates) {
    const t = typeof c === 'string' ? c.trim() : '';
    if (t.length > 40) return t;
  }
  return undefined;
}

/**
 * Si `auth.admin.updateUserById` échoue (bug client ou version), appelle GoTrue directement.
 */
export async function confirmUserEmailViaGoTrue(
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

export function createServiceRoleClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Sous-ensemble utilisé par les routes d'inscription */
export type AuthAdminApi = {
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

export function getAuthAdmin(client: { auth: unknown }): AuthAdminApi {
  return (client.auth as { admin: AuthAdminApi }).admin;
}
