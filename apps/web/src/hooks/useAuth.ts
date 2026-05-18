import { getAppUrl } from '@/lib/appUrl';
import { useCallback } from 'react';
import { FunctionsHttpError, FunctionsRelayError, type User } from '@supabase/supabase-js';
import {
  AUTH_INVOKE_BASE_DELAY_MS,
  AUTH_INVOKE_MAX_ATTEMPTS,
  AUTH_INVOKE_TIMEOUT_MS,
  fetchJsonPostWithTimeout,
  isTransientNetworkError,
  retryOnTransientFailure,
  sleep,
  withTimeout,
} from '@/lib/authApiHelpers';
import { formatAuthErrorMessage } from '@/lib/formatSupabaseError';
import { getSupabaseEdgeFetchConfig, isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import {
  clearProfileCache,
  invalidateProfileCache,
  reloadProfileForCurrentUser,
  syncProfileAfterSignup,
} from '@/lib/authSync';

export type { AuthProfile as Profile, AuthStaffInfo as RestaurantStaff } from '@/store/useAuthStore';

/** Résultat de `signUp` — `pendingEmailConfirmation` : compte créé, e-mail Supabase envoyé, sans session immédiate. */
export type SignUpResult = {
  user: User | null;
  error: Error | null;
  pendingEmailConfirmation?: boolean;
};

/** Erreur GoTrue / fetch — le message seul peut être vide côté client. */
function isAuthEmailRateLimitError(err: {
  message?: string;
  code?: string | number;
  status?: number;
}): boolean {
  if (err.status === 429) return true;
  const code = String(err.code ?? '')
    .toLowerCase()
    .replace(/_/g, '');
  if (code.includes('overemailsend') || code.includes('emailsendrate') || code.includes('ratelimit')) {
    return true;
  }
  const m = (err.message || '').toLowerCase();
  return (
    m.includes('rate limit') ||
    m.includes('over_email_send_rate_limit') ||
    m.includes('email rate limit') ||
    (m.includes('too many') && m.includes('email'))
  );
}

/**
 * Si register-confirmed (Edge ou /api) échoue, on retente avec signUp Supabase classique.
 * Inclut 500/502/503 (config manquante, panne fonction, trigger DB) et corps de réponse non JSON.
 */
function shouldFallbackToSupabaseSignUpAfterRegisterConfirmed(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  const low = m.toLowerCase();
  return (
    /\(404\)|\(405\)|\b404\b|\b405\b/i.test(m) ||
    /\(50[0-4]\)|\(52[45]\)/i.test(m) ||
    /inscription de secours impossible|register-confirmed|réponse serveur invalide/i.test(m) ||
    /configuration serveur|erreur serveur|server configuration|incomplete.*supabase admin/i.test(low) ||
    /failed to fetch|load failed|network\s*error|networkerror|echec du réseau|typeerror.*fetch/i.test(m) ||
    /connexion au serveur d.inscription impossible/i.test(m) ||
    /unexpected token|is not valid json|invalid json/i.test(low)
  );
}

/** Message court si les fonctions Edge auth ne répondent pas (évite de citer Vercel si vous n’utilisez que le SPA). */
function hintDeployAuthEdgeFunctions(): string {
  return (
    'Déployez sur votre projet Supabase les fonctions « register-confirmed » et « confirm-restaurant-signup » ' +
    '(Dashboard → Edge Functions, ou : supabase functions deploy register-confirmed --no-verify-jwt ; idem pour confirm-restaurant-signup). ' +
    'Vérifiez le secret SUPABASE_SERVICE_ROLE_KEY pour les fonctions. Le fichier supabase/config.toml du dépôt définit verify_jwt = false.'
  );
}

/** Évite de remonter « Failed to fetch » brut au formulaire. */
function friendlyRegisterNetworkError(): Error {
  return new Error(
    'Connexion au serveur d’inscription impossible (réseau, projet Supabase en pause, ou fonctions Edge non déployées). ' +
      hintDeployAuthEdgeFunctions() +
      ' — Solution sans Edge : Supabase Dashboard → Authentication → Providers → Email → désactiver « Confirm email » : l’inscription standard renverra alors une session tout de suite.',
  );
}

function friendlyConfirmNetworkError(): Error {
  return new Error(
    'Connexion au serveur de confirmation impossible. ' +
      hintDeployAuthEdgeFunctions() +
      ' — Ou désactivez « Confirm email » côté Supabase pour ne plus dépendre de cette étape.',
  );
}

async function safePostJson(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<Response | null> {
  try {
    return await fetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    });
  } catch {
    return null;
  }
}

function isTransientInvokeFailure(error: unknown, response?: Response): boolean {
  if (isTransientNetworkError(error)) return true;
  if (error instanceof FunctionsHttpError) {
    const s = response?.status ?? 0;
    return s === 502 || s === 503 || s === 504;
  }
  return false;
}

async function invokeAuthFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: unknown; response?: Response }> {
  return retryOnTransientFailure(
    async () => {
      const out = await withTimeout(
        supabase.functions.invoke<T>(name, { body }),
        AUTH_INVOKE_TIMEOUT_MS,
      );
      if (out.error && isTransientInvokeFailure(out.error, out.response)) {
        const msg = out.error instanceof Error ? out.error.message : String(out.error);
        throw new Error(msg);
      }
      return out;
    },
    { maxAttempts: AUTH_INVOKE_MAX_ATTEMPTS, baseDelayMs: AUTH_INVOKE_BASE_DELAY_MS },
  );
}

/** Confirme l’e-mail (client ou restaurant) puisque signUp n’a pas renvoyé de session. */
async function confirmPendingSignupEmail(
  userId: string,
  email: string,
  expectedRole: 'client' | 'restaurant_owner',
): Promise<void> {
  const body = {
    userId,
    email: email.trim().toLowerCase(),
    expectedRole,
  };

  if (isSupabaseConfigured) {
    const { data, error, response } = await invokeAuthFunction<{ ok?: boolean; error?: string }>(
      'confirm-restaurant-signup',
      body as Record<string, unknown>,
    );
    if (!error && data?.ok === true) return;
    // Ne pas throw ici : la Edge peut renvoyer 5xx alors que /api Vercel a SUPABASE_SERVICE_ROLE_KEY.
  }

  const payload = JSON.stringify(body);
  const appBase = getAppUrl().replace(/\/$/, '');
  const edgeCfg = getSupabaseEdgeFetchConfig();

  const res = await retryOnTransientFailure(
    async () => {
      if (edgeCfg) {
        const rEdge = await fetchJsonPostWithTimeout(
          `${edgeCfg.url}/functions/v1/confirm-restaurant-signup`,
          payload,
          { Authorization: `Bearer ${edgeCfg.anonKey}`, apikey: edgeCfg.anonKey },
          AUTH_INVOKE_TIMEOUT_MS,
        );
        if (rEdge?.ok) return rEdge;
        // Erreur client « définitive » (400) : pas de second essai utile avec le même corps
        if (rEdge && rEdge.status === 400) return rEdge;
      }
      const rApi = await fetchJsonPostWithTimeout(
        `${appBase}/api/auth/confirm-restaurant-signup`,
        payload,
        {},
        AUTH_INVOKE_TIMEOUT_MS,
      );
      if (!rApi) throw new Error('SERVER_TIMEOUT');
      return rApi;
    },
    { maxAttempts: AUTH_INVOKE_MAX_ATTEMPTS, baseDelayMs: AUTH_INVOKE_BASE_DELAY_MS },
  );

  const json = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
  if (!res.ok) {
    throw new Error(json.error || `Validation du compte impossible (${res.status})`);
  }
}

/**
 * Inscription via Admin API : compte créé avec e-mail déjà confirmé (pas d’e-mail Supabase).
 * Utilisé si signUp échoue (ex. quota d’e-mails) ou si la confirmation serveur échoue.
 */
type RegisterConfirmedJson = { error?: string; ok?: boolean; userId?: string };

async function registerConfirmedViaAdmin(params: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: 'client' | 'restaurant_owner';
  restaurantName?: string;
}): Promise<User> {
  const email = params.email.trim();
  const body = {
    email,
    password: params.password,
    fullName: params.fullName,
    phone: params.phone,
    role: params.role,
    restaurantName: params.restaurantName,
  };
  const bodyStr = JSON.stringify(body);

  const signInAfterRegister = async (): Promise<User> => {
    const signInRes = await supabase.auth.signInWithPassword({
      email,
      password: params.password,
    });
    if (signInRes.error || !signInRes.data.user) {
      throw new Error(signInRes.error?.message || 'Connexion après inscription impossible');
    }
    return signInRes.data.user;
  };

  const profilePayload = {
    fullName: params.fullName,
    phone: params.phone,
    role: params.role,
  };

  const finalizeAfterRegister = async (): Promise<User> => {
    const u = await signInAfterRegister();
    await syncProfileAfterSignup(u.id, u.email ?? email, profilePayload);
    return u;
  };

  const applyRegisterResponse = async (res: Response): Promise<User> => {
    const json = (await res.json().catch(() => ({}))) as RegisterConfirmedJson;
    if (res.status === 409) {
      const signInRes = await supabase.auth.signInWithPassword({
        email,
        password: params.password,
      });
      if (!signInRes.error && signInRes.data.user) {
        const u = signInRes.data.user;
        await syncProfileAfterSignup(u.id, u.email ?? email, profilePayload);
        return u;
      }
      throw new Error(
        json.error ||
          'Cette adresse e-mail est déjà utilisée. Connectez-vous ou utilisez le lien de confirmation reçu.',
      );
    }
    if (!res.ok) {
      throw new Error(json.error || `Inscription de secours impossible (${res.status})`);
    }
    if (json.ok !== true) {
      throw new Error(
        'Inscription de secours impossible — réponse serveur invalide (fonction register-confirmed).',
      );
    }
    return finalizeAfterRegister();
  };

  // 1) SDK Supabase : mêmes URL / clé / fetch que le client → évite beaucoup d’échecs « Failed to fetch ».
  if (isSupabaseConfigured) {
    const { data, error, response } = await invokeAuthFunction<RegisterConfirmedJson>(
      'register-confirmed',
      body as Record<string, unknown>,
    );
    if (!error && data?.ok === true) {
      return finalizeAfterRegister();
    }
    if (
      error &&
      response instanceof Response &&
      (error instanceof FunctionsHttpError || error instanceof FunctionsRelayError)
    ) {
      return applyRegisterResponse(response);
    }
  }

  const appBase = getAppUrl().replace(/\/$/, '');
  const edgeCfg = getSupabaseEdgeFetchConfig();

  const res = await retryOnTransientFailure(
    async () => {
      let r: Response | null = null;
      if (edgeCfg) {
        r = await fetchJsonPostWithTimeout(
          `${edgeCfg.url}/functions/v1/register-confirmed`,
          bodyStr,
          { Authorization: `Bearer ${edgeCfg.anonKey}`, apikey: edgeCfg.anonKey },
          AUTH_INVOKE_TIMEOUT_MS,
        );
        if (r?.ok) return r;
        if (r && r.status === 400) return r;
      }
      r = await fetchJsonPostWithTimeout(`${appBase}/api/auth/register-confirmed`, bodyStr, {}, AUTH_INVOKE_TIMEOUT_MS);
      if (!r) throw new Error('SERVER_TIMEOUT');
      return r;
    },
    { maxAttempts: AUTH_INVOKE_MAX_ATTEMPTS, baseDelayMs: AUTH_INVOKE_BASE_DELAY_MS },
  );

  return applyRegisterResponse(res);
}

export function useAuth() {
  const { user, profile, staffInfo, loading, error, isSupabaseConfigured } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      profile: s.profile,
      staffInfo: s.staffInfo,
      loading: s.loading,
      error: s.error,
      isSupabaseConfigured: s.isSupabaseConfigured,
    })),
  );

  const refreshProfile = useCallback(async () => {
    await reloadProfileForCurrentUser();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    role: 'client' | 'restaurant_owner' = 'client',
    _restaurantId?: string,
    restaurantName?: string,
  ): Promise<SignUpResult> => {
    const emailTrim = email.trim();
    const fullNameTrim = fullName.trim();
    const phoneTrim = phone.trim();

    const finishWithRestaurant = (u: User) => {
      if (role === 'restaurant_owner' && restaurantName) {
        void createRestaurantForUser(u.id, restaurantName).catch((err: unknown) => {
          if (import.meta.env.DEV) console.error('[Auth] Erreur création restaurant:', err);
        });
      }
    };

    try {
      // Clients : évite tout e-mail transactionnel Supabase quand la fonction register-confirmed est dispo (Edge en priorité).
      if (role === 'client') {
        try {
          const u = await registerConfirmedViaAdmin({
            email: emailTrim,
            password,
            fullName: fullNameTrim,
            phone: phoneTrim,
            role: 'client',
            restaurantName,
          });
          finishWithRestaurant(u);
          return { user: u, error: null };
        } catch (clientAdminErr) {
          if (!shouldFallbackToSupabaseSignUpAfterRegisterConfirmed(clientAdminErr)) {
            return {
              user: null,
              error:
                clientAdminErr instanceof Error
                  ? clientAdminErr
                  : new Error('Inscription impossible'),
            };
          }
        }
      }

      const signUpResult = await supabase.auth.signUp({
        email: emailTrim,
        password,
        options: {
          emailRedirectTo: `${getAppUrl()}/auth/confirm`,
          data: {
            full_name: fullNameTrim,
            phone: phoneTrim,
            role,
            restaurant_name: restaurantName || undefined,
          },
        },
      });

      if (signUpResult.error) {
        if (isAuthEmailRateLimitError(signUpResult.error)) {
          try {
            const u = await registerConfirmedViaAdmin({
              email: emailTrim,
              password,
              fullName: fullNameTrim,
              phone: phoneTrim,
              role,
              restaurantName,
            });
            finishWithRestaurant(u);
            return { user: u, error: null };
          } catch (fallbackErr: unknown) {
            return {
              user: null,
              error:
                fallbackErr instanceof Error
                  ? fallbackErr
                  : new Error(
                      'Limite d’e-mails atteinte : déployez /api/auth/register-confirmed (ou la Edge Function register-confirmed) avec SUPABASE_SERVICE_ROLE_KEY.',
                    ),
            };
          }
        }
        throw signUpResult.error;
      }

      const newUser = signUpResult.data.user;
      const session = signUpResult.data.session;

      if (!newUser) throw new Error('Inscription échouée');

      let effectiveUser = newUser;

      if (!session) {
        const tryConfirmThenSignIn = async (): Promise<User> => {
          await confirmPendingSignupEmail(newUser.id, emailTrim, role);
          const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
            email: emailTrim,
            password,
          });
          if (signErr) throw signErr;
          if (!signData.user) throw new Error('Connexion impossible');
          return signData.user;
        };

        try {
          effectiveUser = await tryConfirmThenSignIn();
        } catch {
          try {
            effectiveUser = await registerConfirmedViaAdmin({
              email: emailTrim,
              password,
              fullName: fullNameTrim,
              phone: phoneTrim,
              role,
              restaurantName,
            });
          } catch {
            try {
              effectiveUser = await tryConfirmThenSignIn();
            } catch {
              // signUp Supabase a réussi : utilisateur créé + e-mail de confirmation envoyé par GoTrue.
              // L’API confirm-restaurant-signup / register-confirmed peut être en 500 sans annuler l’e-mail.
              if (import.meta.env.DEV) {
                console.warn(
                  '[Auth] Confirmation serveur impossible après signUp ; l’utilisateur doit utiliser le lien reçu par e-mail.',
                );
              }
              return {
                user: null,
                error: null,
                pendingEmailConfirmation: true,
              };
            }
          }
        }
      }

      await syncProfileAfterSignup(effectiveUser.id, effectiveUser.email ?? emailTrim, {
        fullName: fullNameTrim,
        phone: phoneTrim,
        role,
      });
      finishWithRestaurant(effectiveUser);
      return { user: effectiveUser, error: null };
    } catch (error) {
      if (import.meta.env.DEV) console.error('[Auth signUp]', error);
      return {
        user: null,
        error: new Error(formatAuthErrorMessage(error)),
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const {
        data: { user: signedUser },
        error,
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      return { user: signedUser, error: null };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error : new Error('Sign in failed') };
    }
  };

  const signOut = async () => {
    try {
      clearProfileCache();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Sign out failed') };
    }
  };

  const completeOnboarding = async () => {
    try {
      const u = useAuthStore.getState().user;
      if (!u) throw new Error('No user');
      await supabase.from('profiles').update({ has_completed_onboarding: true }).eq('id', u.id);
      const p = useAuthStore.getState().profile;
      if (p) {
        useAuthStore.setState({
          profile: { ...p, has_completed_onboarding: true },
        });
      }
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Onboarding failed') };
    }
  };

  const hasPermission = (requiredRole: string | string[]) => {
    const p = useAuthStore.getState().profile;
    if (!p) return false;
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(p.role);
  };

  return {
    user,
    profile,
    staffInfo,
    loading,
    error,
    isSupabaseConfigured,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    completeOnboarding,
    hasPermission,
  };
}

async function createRestaurantForUser(userId: string, restaurantName: string) {
  let profileId: string | null = null;
  for (let i = 0; i < 6; i++) {
    await sleep(500);
    const { data } = await supabase.from('profiles').select('id, restaurant_id').eq('id', userId).single();
    if (data) {
      profileId = data.id;
      if (data.restaurant_id) return;
      break;
    }
  }
  if (!profileId) {
    if (import.meta.env.DEV) console.warn('[createRestaurant] Profile not found after retries');
    return;
  }

  const slug = `${restaurantName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')}-${Date.now().toString(36)}`;

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .insert([
      {
        name: restaurantName.trim(),
        slug,
        owner_id: userId,
        is_active: true,
        is_open: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single();

  if (error) {
    if (import.meta.env.DEV) console.error('[createRestaurant] insert failed:', error);
    return;
  }

  if (restaurant?.id) {
    await supabase
      .from('profiles')
      .update({ restaurant_id: restaurant.id, role: 'restaurant_owner' })
      .eq('id', userId);
    invalidateProfileCache(userId);
  }
}

