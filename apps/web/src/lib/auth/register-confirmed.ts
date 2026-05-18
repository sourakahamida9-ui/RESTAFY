/**
 * Logique partagée pour register-confirmed
 * Utilisée par: Supabase Edge Functions, Vercel Serverless, Next.js App Router
 */

export const SIGNUP_MIN_PASSWORD_LENGTH = 8;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterConfirmedInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role?: string;
  restaurantName?: string;
}

export interface SignupValidationInput extends RegisterConfirmedInput {
  confirmPassword?: string;
}

export interface RegisterConfirmedResult {
  success: boolean;
  userId?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Valide les données d'inscription (côté serveur - register-confirmed)
 */
export function validateRegistrationInput(input: RegisterConfirmedInput): { valid: boolean; error?: string } {
  const { email, password, fullName, phone, role, restaurantName } = input;

  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const trimmedPassword = typeof password === 'string' ? password : '';
  const trimmedFullName = typeof fullName === 'string' ? fullName.trim() : '';
  const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
  const normalizedRole = typeof role === 'string' && role.trim().toLowerCase() === 'restaurant_owner' ? 'restaurant_owner' : 'client';
  const trimmedRestaurantName = typeof restaurantName === 'string' ? restaurantName.trim() : undefined;

  if (!trimmedEmail || !trimmedPassword) {
    return { valid: false, error: 'E-mail et mot de passe requis' };
  }
  if (!trimmedFullName || !trimmedPhone) {
    return { valid: false, error: 'Nom complet et numéro de téléphone requis' };
  }
  if (trimmedPassword.length < 8 || !/[A-Za-z]/.test(trimmedPassword) || !/[0-9]/.test(trimmedPassword)) {
    return { valid: false, error: 'Mot de passe trop faible : au moins 8 caractères, avec au moins une lettre et un chiffre.' };
  }
  if (normalizedRole === 'restaurant_owner' && !trimmedRestaurantName) {
    return { valid: false, error: 'Le nom du restaurant est requis pour un compte partenaire' };
  }

  return { valid: true };
}

/**
 * Valide les données d'inscription (côté client - avec confirmation de mot de passe)
 * Utilise les mêmes règles que validateRegistrationInput mais avec confirmation
 */
export function validateSignupFields(input: SignupValidationInput): string | null {
  if (!input.fullName.trim()) return 'Le nom complet est requis.';
  if (!input.phone.trim()) return 'Le numéro de téléphone est requis.';
  if (!input.email.trim()) return 'L\'adresse e-mail est requise.';
  if (!EMAIL_REGEX.test(input.email.trim())) return 'Format d\'e-mail invalide.';
  if (input.restaurantName !== undefined && !input.restaurantName.trim()) {
    return 'Le nom du restaurant est requis.';
  }
  const p = input.password;
  if (p.length < SIGNUP_MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${SIGNUP_MIN_PASSWORD_LENGTH} caractères.`;
  }
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
    return 'Le mot de passe doit inclure au moins une lettre et un chiffre.';
  }
  if (input.confirmPassword && p !== input.confirmPassword) return 'Les mots de passe ne correspondent pas.';
  return null;
}

/**
 * Normalise et nettoie les données d'inscription
 */
export function normalizeRegistrationInput(input: RegisterConfirmedInput): {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: string;
  restaurantName?: string;
  userMetadata: Record<string, any>;
} {
  const trimmedEmail = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const trimmedPassword = typeof input.password === 'string' ? input.password : '';
  const trimmedFullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  const trimmedPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const normalizedRole = typeof input.role === 'string' && input.role.trim().toLowerCase() === 'restaurant_owner' ? 'restaurant_owner' : 'client';
  const trimmedRestaurantName = typeof input.restaurantName === 'string' ? input.restaurantName.trim() : undefined;

  return {
    email: trimmedEmail,
    password: trimmedPassword,
    fullName: trimmedFullName,
    phone: trimmedPhone,
    role: normalizedRole,
    restaurantName: trimmedRestaurantName,
    userMetadata: {
      full_name: trimmedFullName || undefined,
      phone: trimmedPhone || undefined,
      role: normalizedRole,
      restaurant_name: normalizedRole === 'restaurant_owner' ? trimmedRestaurantName || undefined : undefined,
    },
  };
}

/**
 * Interprète les erreurs Supabase Auth
 */
export function interpretSupabaseAuthError(error: { message?: string }): { statusCode: number; message: string } {
  const msg = error.message?.toLowerCase() ?? '';
  const raw = error.message || '';

  if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
    return { statusCode: 409, message: 'Cette adresse e-mail est déjà utilisée. Essayez de vous connecter.' };
  }
  if (msg.includes('weak') || msg.includes('password') || msg.includes('least')) {
    return { statusCode: 400, message: 'Mot de passe refusé : utilisez au moins 8 caractères avec des lettres et des chiffres.' };
  }
  if (msg.includes('database') || msg.includes('trigger') || msg.includes('saving new user') || msg.includes('unexpected_failure')) {
    return { statusCode: 422, message: `Échec côté base (souvent téléphone déjà utilisé ou déclencheur profil). Détail : ${raw}` };
  }

  return { statusCode: 400, message: raw || 'Impossible de créer le compte' };
}

/**
 * Génère un slug unique pour un restaurant
 */
export function generateRestaurantSlug(name: string): string {
  return `${name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')}-${Date.now().toString(36)}`;
}

/**
 * Vérifie si une erreur est un conflit de téléphone
 */
export function isPhoneConflict(error: { code?: string; message?: string }): boolean {
  if (!error) return false;
  const codeMatch = error.code === '23505';
  const messageMatch = String(error.message || '').toLowerCase().includes('phone');
  return codeMatch || messageMatch;
}
