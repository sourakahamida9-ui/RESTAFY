/**
 * Indices actionnables pour erreurs SQL récurrentes (déploiement Supabase).
 */
function collectPostgrestErrorText(e: unknown): string {
  const parts: string[] = [];
  const add = (s: unknown) => {
    if (typeof s === 'string') {
      const t = s.trim();
      if (t) parts.push(t);
    }
  };
  if (typeof e === 'string') {
    add(e);
    return [...new Set(parts)].join(' — ');
  }
  if (e instanceof Error) {
    add(e.message);
  }
  if (typeof e === 'object' && e !== null) {
    const o = e as Record<string, unknown>;
    add(o.message);
    add(o.details);
    add(o.hint);
    add(o.code);
  }
  return [...new Set(parts)].join(' — ');
}

function withCommonSqlHints(msg: string): string {
  const t = msg.trim();
  if (!t) return msg;
  const isUserRoleEnumMismatch =
    /invalid input value for enum user_role/i.test(t) ||
    (/user_role/i.test(t) && /enum|invalid input/i.test(t) && /chef|cashier|waiter/i.test(t));
  if (isUserRoleEnumMismatch) {
    return (
      `${t} — Action admin Supabase : exécuter scripts/086-user-role-team-postes-if-not-exists.sql (PG 15+), ` +
      `ou scripts/076-user-role-team-postes.sql, ou scripts/084-restaurant-staff-role-text.sql (recommandé), puis réessayez.`
    );
  }
  return msg;
}

/**
 * Texte d'erreur pour toasts / logs — les erreurs PostgREST ne sont pas toujours des Error avec message rempli.
 */
export function formatSupabaseErr(e: unknown): string {
  if (e == null) return withCommonSqlHints('Erreur inconnue');
  const combined = collectPostgrestErrorText(e);
  if (combined) return withCommonSqlHints(combined);
  return withCommonSqlHints('Erreur inconnue');
}

/**
 * Texte affiché sur les écrans d’inscription (client / restaurant).
 * Les erreurs Supabase sont souvent en anglais ; les messages longs du hook (déploiement API) sont conservés tels quels.
 */
export function formatAuthSignupErrorMessage(raw: string): string {
  const msg = raw.trim();
  if (!msg) return 'Une erreur est survenue lors de l’inscription.';
  if (/already registered|user already|email.*already|duplicate|unique constraint|409/i.test(msg)) {
    return 'Cette adresse email est déjà utilisée.';
  }
  if (/database error saving new user|saving new user/i.test(msg)) {
    return (
      'Impossible de finaliser le profil (souvent un numéro de téléphone déjà utilisé sur un autre compte). ' +
      'Utilisez un autre numéro ou laissez-le vide, puis réessayez.'
    );
  }
  if (/rate limit|over_email_send|email rate limit|too many.*email/i.test(msg)) {
    return 'Trop d’emails d’inscription ont été envoyés récemment. Réessayez dans une heure, ou connectez-vous si le compte existe déjà.';
  }
  if (/server_timeout|serveur met trop longtemps/i.test(msg)) {
    return (
      'Le service met du temps à répondre (réseau lent ou démarrage à froid). ' +
      'Réessayez dans quelques secondes ; la connexion est retentée automatiquement.'
    );
  }
  if (/failed to fetch|load failed|networkerror|network error/i.test(msg)) {
    return (
      'Connexion au serveur impossible. Vérifiez votre connexion Internet et réessayez dans quelques instants.'
    );
  }
  return msg;
}

/**
 * Erreurs Auth Supabase / réseau : message utilisateur en français (objet Error ou AuthApiError).
 */
export function formatAuthErrorMessage(err: unknown): string {
  if (err == null) return 'Une erreur est survenue lors de l’inscription.';
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message?: unknown }).message)
        : String(err);
  const codeRaw =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const code = codeRaw.replace(/_/g, '').toLowerCase();
  const combined = `${codeRaw} ${raw}`.toLowerCase();

  if (code === 'weakpassword' || /weak_password|password.*weak|strength|too weak/i.test(combined)) {
    return 'Mot de passe trop faible : au moins 8 caractères, avec des lettres et des chiffres.';
  }
  if (code === 'emailaddressinvalid' || /invalid email|email format|email_address_invalid/i.test(combined)) {
    return 'Adresse e-mail invalide.';
  }
  if (
    code === 'useralreadyexists' ||
    /user already registered|already registered|email.*already|duplicate|unique constraint/i.test(combined)
  ) {
    return 'Cette adresse e-mail est déjà utilisée.';
  }
  if (/database error saving new user|saving new user/i.test(combined)) {
    return (
      'Impossible de finaliser le profil (souvent un numéro de téléphone déjà utilisé). ' +
      'Essayez un autre numéro ou contactez le support.'
    );
  }
  if (/signup.*disabled|signups not allowed|email signups are disabled/i.test(combined)) {
    return 'Les inscriptions sont momentanément désactivées. Réessayez plus tard ou contactez le support.';
  }
  if (/server_timeout/i.test(raw)) {
    return (
      'Le service met du temps à répondre. ' +
      'Vérifiez votre connexion et réessayez dans quelques secondes.'
    );
  }

  return formatAuthSignupErrorMessage(raw);
}

export function isLikelyMissingKioskSql(msg: string): boolean {
  return /function .* does not exist|42883|schema cache|pin_hash|access_token|owner_set_staff|column .* does not exist|42703/i.test(
    msg,
  );
}

/** PostgREST renvoie parfois du JSONB sérialisé en chaîne. */
export function parseRpcJson<T extends Record<string, unknown>>(data: unknown): T | null {
  if (data == null) return null;
  if (typeof data === 'object' && !Array.isArray(data)) return data as T;
  if (typeof data === 'string') {
    try {
      const v = JSON.parse(data) as unknown;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v as T;
    } catch {
      return null;
    }
  }
  return null;
}
