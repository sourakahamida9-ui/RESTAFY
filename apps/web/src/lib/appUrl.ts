/**
 * URL de base de l’application (liens de confirmation, appels `/api/auth/*`, etc.).
 * Dans le navigateur : toujours l’origine courante (évite d’appeler le mauvais domaine sur Vercel preview / autre hôte).
 */
export function getAppUrl(): string {
  // En environnement navigateur, essayer window.location.origin avec validation
  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      const origin = window.location.origin;
      // Valider que c'est une URL HTTPS correcte
      if (origin && /^https?:\/\/.+\..+/.test(origin)) {
        return origin.replace(/\/$/, '');
      }
    } catch (error) {
      console.warn('[getAppUrl] window.location.origin invalide:', error);
    }
  }
  
  // Fallback: variable d'environnement
  const fromEnv = import.meta.env.VITE_APP_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    const cleaned = fromEnv.trim().replace(/\/$/, '');
    if (/^https?:\/\/.+\..+/.test(cleaned)) {
      return cleaned;
    }
  }
  
  // Fallback final : on renvoie TOUJOURS app.restafy.shop — jamais l'URL
  // restafy-prod.vercel.app, qui ne doit pas fuir côté utilisateur (liens
  // emails, redirects, QR codes…). Si le DNS d'app.restafy.shop est KO,
  // c'est un incident à régler côté ops, pas à masquer en renvoyant les
  // clients vers un domaine vercel.app.
  return 'https://app.restafy.shop';
}

/**
 * URL publique page complète — /r/:slug (évite @ dans le chemin React Router v6).
 * Utilise l'origine courante si on est dans le navigateur, sinon fallback app.restafy.shop.
 */
export function getRestaurantUrl(slug: string): string {
  return `${getAppUrl()}/r/${slug}`;
}

/**
 * Email de support
 */
export function getSupportEmail(): string {
  return 'support@restafy.shop';
}

/**
 * Email noreply (doit matcher un domaine verifie dans Resend).
 * Aujourd'hui seul app.restafy.shop est verifie cote Resend; on sortira
 * vers noreply@restafy.shop quand l'apex sera verifie.
 */
export function getNoReplyEmail(): string {
  return 'noreply@app.restafy.shop';
}
