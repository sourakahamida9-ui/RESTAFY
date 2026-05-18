/**
 * Système centralisé de gestion des erreurs pour Restafy
 * Convertit les erreurs Supabase et système en messages clairs en français
 */

const isDevelopment = import.meta.env.DEV;

interface SupabaseError {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  status?: number;
}

/**
 * Extrait le message d'une erreur de n'importe quel type
 */
export function extractErrorMessage(error: unknown): string {
  if (!error) return 'Erreur inconnue';

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;

    // Gestion PostgrestError de Supabase
    if (typeof err.message === 'string' && err.message) {
      return err.message;
    }
    if (typeof err.details === 'string' && err.details) {
      return err.details;
    }
    if (typeof err.hint === 'string' && err.hint) {
      return err.hint;
    }

    // Gestion des erreurs imbriquées { error: { message: "..." } }
    if (typeof err.error === 'object' && err.error) {
      const innerErr = err.error as Record<string, unknown>;
      if (typeof innerErr.message === 'string') {
        return innerErr.message;
      }
    }

    try {
      return JSON.stringify(error);
    } catch {
      // Impossible à stringify
    }
  }

  return String(error);
}

/**
 * Convertit une erreur Supabase en message utilisateur en français
 */
export function handleSupabaseError(error: SupabaseError | unknown): {
  userMessage: string;
  devMessage: string;
  code?: string;
} {
  const rawMessage = extractErrorMessage(error);
  const supabaseErr = error as SupabaseError;
  const code = supabaseErr.code || 'UNKNOWN';

  // Mapping des codes d'erreur Supabase courants
  const errorMap: Record<string, string> = {
    // Auth errors
    'invalid_credentials': 'Email ou mot de passe incorrect',
    'email_exists': 'Cet email est déjà utilisé',
    'weak_password': 'Le mot de passe doit contenir au moins 8 caractères',
    'email_not_confirmed': 'Veuillez confirmer votre email avant de continuer',
    'user_not_found': 'Utilisateur non trouvé',
    'over_email_send_rate_limit': 'Trop de tentatives. Réessayez plus tard',

    // Database errors
    'PGRST001': 'Ressource non trouvée',
    'PGRST002': 'Accès refusé à cette ressource',
    'PGRST003': 'Erreur de validation des données',
    'PGRST116': 'Aucune donnée trouvée',
    '23505': 'Cette entrée existe déjà',
    '23503': 'Impossible de supprimer: cette ressource est utilisée ailleurs',
    '42501': 'Vous n\'avez pas la permission d\'accéder à cela',

    // Network errors
    'ETIMEDOUT': 'La requête a pris trop de temps. Vérifiez votre connexion',
    'ECONNREFUSED': 'Impossible de se connecter. Vérifiez votre internet',
    'ENOTFOUND': 'Serveur non trouvable. Vérifiez votre connexion',
  };

  // Vérifier les codes d'erreur connus
  for (const [errorCode, message] of Object.entries(errorMap)) {
    if (rawMessage.includes(errorCode) || code.includes(errorCode)) {
      return {
        userMessage: message,
        devMessage: rawMessage,
        code: errorCode,
      };
    }
  }

  // Gestion par motifs textuels
  if (rawMessage.includes('Bucket not found')) {
    return {
      userMessage: 'Erreur serveur: bucket manquant',
      devMessage: rawMessage,
      code: 'BUCKET_NOT_FOUND',
    };
  }

  if (rawMessage.includes('Invalid URL')) {
    return {
      userMessage: 'Erreur configuration. Contactez l\'administrateur',
      devMessage: rawMessage,
      code: 'INVALID_CONFIG',
    };
  }

  if (rawMessage.includes('infinite recursion')) {
    return {
      userMessage: 'Erreur système détectée. Veuillez recharger',
      devMessage: rawMessage,
      code: 'RECURSION_ERROR',
    };
  }

  if (rawMessage.includes('timeout') || rawMessage.includes('timed out')) {
    return {
      userMessage: 'La requête a pris trop de temps. Réessayez',
      devMessage: rawMessage,
      code: 'TIMEOUT',
    };
  }

  if (rawMessage.includes('CORS') || rawMessage.includes('cors')) {
    return {
      userMessage: 'Erreur de configuration serveur',
      devMessage: rawMessage,
      code: 'CORS_ERROR',
    };
  }

  // Par défaut, utiliser le message brut en dev, générique en prod
  return {
    userMessage: 'Une erreur s\'est produite. Veuillez réessayer',
    devMessage: rawMessage,
    code: 'UNKNOWN_ERROR',
  };
}

/**
 * Logger une erreur en développement, silencieux en production
 */
export function logError(context: string, error: unknown) {
  if (isDevelopment) {
    console.error(`[${context}]`, error);
  }
}

/**
 * Créer une erreur formatée pour le développeur
 */
export function formatDevError(context: string, error: unknown): string {
  const timestamp = new Date().toISOString();
  const message = extractErrorMessage(error);
  return `[${timestamp}] ${context}: ${message}`;
}
