import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { sleep } from '@/lib/authApiHelpers';
import { useAuthStore, type AuthProfile, type AuthStaffInfo } from '@/store/useAuthStore';

export type SignupProfilePayload = {
  fullName: string;
  phone: string;
  role: 'client' | 'restaurant_owner';
};

const CACHE_TTL_MS = 2 * 60 * 1000;
const profileCache = new Map<
  string,
  { profile: AuthProfile | null; staffInfo: AuthStaffInfo | null; ts: number }
>();

function getCached(userId: string) {
  const entry = profileCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    profileCache.delete(userId);
    return null;
  }
  return entry;
}

export function invalidateProfileCache(userId: string): void {
  profileCache.delete(userId);
}

export function clearProfileCache(): void {
  profileCache.clear();
}

type ProfileBundle = {
  profile: AuthProfile | null;
  staffInfo: AuthStaffInfo | null;
  error: Error | null;
};

export async function loadProfileAndStaff(userId: string): Promise<ProfileBundle> {
  const cached = getCached(userId);
  if (cached) {
    return { profile: cached.profile, staffInfo: cached.staffInfo, error: null };
  }

  const [profileRes, staffRes] = await Promise.allSettled([
    supabase
      .from('profiles')
      .select(
        'id,email,full_name,phone,role,loyalty_points,total_orders,restaurant_id,has_completed_onboarding,avatar_url,city,address,is_active,loyalty_level'
      )
      .eq('id', userId)
      .single(),
    supabase
      .from('restaurant_staff')
      .select('id,profile_id,restaurant_id,role')
      .eq('profile_id', userId)
      .maybeSingle(),
  ]);

  let profile: AuthProfile | null = null;
  let staffInfo: AuthStaffInfo | null = null;
  let error: Error | null = null;

  if (profileRes.status === 'fulfilled') {
    const r = profileRes.value;
    if (r.error) {
      if (r.error.code === 'PGRST116') {
        profile = null;
      } else {
        error = new Error(r.error.message);
      }
    } else {
      profile = r.data as AuthProfile;
    }
  } else {
    const reason = profileRes.reason;
    error = reason instanceof Error ? reason : new Error('Échec chargement du profil');
  }

  if (staffRes.status === 'fulfilled') {
    const sr = staffRes.value;
    if (!sr.error && sr.data) {
      staffInfo = sr.data as AuthStaffInfo;
    }
  }

  if (profile && !error) {
    profileCache.set(userId, { profile, staffInfo, ts: Date.now() });
  }

  return { profile, staffInfo, error };
}

let applyGeneration = 0;

async function applyAuthSession(session: Session | null): Promise<void> {
  const gen = ++applyGeneration;
  const user = session?.user ?? null;

  if (!user) {
    clearProfileCache();
    if (gen !== applyGeneration) return;
    useAuthStore.setState({
      user: null,
      profile: null,
      staffInfo: null,
      loading: false,
      error: null,
    });
    return;
  }

  useAuthStore.setState({ user, loading: true, error: null });
  const bundle = await loadProfileAndStaff(user.id);
  if (gen !== applyGeneration) return;
  useAuthStore.setState({
    profile: bundle.profile,
    staffInfo: bundle.staffInfo,
    loading: false,
    error: bundle.error,
  });
}

/**
 * Délai au-delà duquel on considère que l’init Supabase est bloquée (storage
 * lock cross-onglet, projet en pause, lock GoTrue persistant…) et on libère
 * le store (`loading: false`) pour ne pas laisser l’UI sur le splash
 * « Chargement… » indéfiniment. L’utilisateur peut alors voir la page de
 * login ; `onAuthStateChange` appliquera la session normalement quand elle
 * finit par arriver.
 */
const AUTH_INIT_TIMEOUT_MS = 6000;

/**
 * Un seul flux d’auth pour toute l’app : getSession() puis onAuthStateChange.
 * À appeler une fois (ex. depuis AppRoutes).
 */
export function startAuthSync(): () => void {
  if (!isSupabaseConfigured) {
    useAuthStore.setState({
      user: null,
      profile: null,
      staffInfo: null,
      loading: false,
      error: null,
      isSupabaseConfigured: false,
    });
    return () => {};
  }

  useAuthStore.setState({ isSupabaseConfigured: true });

  let initialized = false;
  const markInitialized = () => {
    initialized = true;
  };

  // Filet de sécurité : si getSession() ne résout pas dans le délai
  // (storage lock, projet Supabase paused, etc.), on coupe le splash de
  // chargement pour permettre à l’utilisateur d’accéder à la page de login.
  const timeoutHandle = setTimeout(() => {
    if (initialized) return;
    initialized = true;
    const { user } = useAuthStore.getState();
    if (user) return; // session déjà connue, pas de UI bloquée
    useAuthStore.setState({
      loading: false,
      error: null,
    });
  }, AUTH_INIT_TIMEOUT_MS);

  void supabase.auth
    .getSession()
    .then(async ({ data: { session } }) => {
      try {
        await applyAuthSession(session);
      } finally {
        markInitialized();
        clearTimeout(timeoutHandle);
      }
    })
    .catch(() => {
      // Échec réel de getSession (CORS, offline, etc.) — on déloque l’UI.
      markInitialized();
      clearTimeout(timeoutHandle);
      useAuthStore.setState({ loading: false });
    });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    // onAuthStateChange peut arriver après le filet de sécurité ; on
    // applique quand même pour rafraîchir le store avec la session réelle.
    markInitialized();
    clearTimeout(timeoutHandle);
    void applyAuthSession(session);
  });

  return () => {
    applyGeneration += 1;
    clearTimeout(timeoutHandle);
    subscription.unsubscribe();
  };
}

export async function reloadProfileForCurrentUser(): Promise<void> {
  const { user } = useAuthStore.getState();
  if (!user) return;
  invalidateProfileCache(user.id);
  const bundle = await loadProfileAndStaff(user.id);
  const current = useAuthStore.getState().user;
  if (!current || current.id !== user.id) return;
  useAuthStore.setState({
    profile: bundle.profile,
    staffInfo: bundle.staffInfo,
    error: bundle.error,
    loading: false,
  });
}

/**
 * Upsert du profil côté client (RLS : auth.uid() = id). Filet de sécurité si le trigger DB échoue.
 */
export async function ensureProfileAfterSignup(
  userId: string,
  email: string | undefined,
  payload: SignupProfilePayload,
  opts?: { maxAttempts?: number; delayMs?: number },
): Promise<{ ok: boolean; error: Error | null }> {
  const maxAttempts = opts?.maxAttempts ?? 5;
  const delayMs = opts?.delayMs ?? 400;
  const displayName = payload.fullName.trim() || (email?.split('@')[0] ?? 'Utilisateur');
  const phone = payload.phone.trim() || null;
  const emailNorm = email?.trim().toLowerCase();
  const row: Record<string, unknown> = {
    id: userId,
    full_name: displayName,
    phone,
    role: payload.role,
    updated_at: new Date().toISOString(),
  };
  if (emailNorm) row.email = emailNorm;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
    if (!error) {
      invalidateProfileCache(userId);
      return { ok: true, error: null };
    }
    if (import.meta.env.DEV) console.warn('[ensureProfileAfterSignup]', attempt, error);
    await sleep(delayMs);
  }
  return { ok: false, error: new Error('Échec de la synchronisation du profil') };
}

/** Après inscription : upsert profil + rechargement du store. */
export async function syncProfileAfterSignup(
  userId: string,
  email: string | undefined,
  payload: SignupProfilePayload,
): Promise<void> {
  const res = await ensureProfileAfterSignup(userId, email, payload);
  if (!res.ok && import.meta.env.DEV) {
    console.warn('[syncProfileAfterSignup] Upsert profil incomplet (trigger ou RLS) :', res.error);
  }
  await reloadProfileForCurrentUser();
}
