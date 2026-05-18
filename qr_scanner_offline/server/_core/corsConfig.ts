/**
 * Configuration CORS pour authentification cross-subdomain
 * 
 * Permet les requêtes entre:
 * - scan.restafy.shop
 * - app.restafy.shop
 * 
 * Tout en maintenant la sécurité:
 * - Credentials inclus (cookies auth)
 * - Headers d'authentification
 * - Validations strictes de l'origine
 */

import type { Request, Response, NextFunction } from 'express';

// ============================================================================
// CONFIGURATION DOMAINES AUTORISÉS
// ============================================================================

const ALLOWED_ORIGINS = [
  // Production
  'https://scan.restafy.shop',
  'https://app.restafy.shop',
  'https://www.restafy.shop',
  'https://restafy.shop',
  
  // Staging/Testing
  'https://scan-staging.restafy.shop',
  'https://app-staging.restafy.shop',
  'https://staging.restafy.shop',
  
  // Développement local
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
];

// Pattern pour matcher les sous-domaines en développement
const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

// Pattern pour matcher les sous-domaines production
const PRODUCTION_PATTERN = /^https:\/\/[a-z0-9-]+\.restafy\.shop$/;

// ============================================================================
// VALIDATION D'ORIGINE
// ============================================================================

/**
 * Vérifie si une origine est autorisée pour les requêtes cross-subdomain
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;

  // Vérification directe
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Pattern matching pour développement
  if (LOCALHOST_PATTERN.test(origin)) {
    return true;
  }

  // Pattern matching pour production (tous les sous-domaines restafy.shop)
  if (PRODUCTION_PATTERN.test(origin)) {
    return true;
  }

  return false;
}

/**
 * Extrait le sous-domaine d'une origine
 */
export function extractSubdomain(origin: string): string | null {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    
    // localhost:3000 → 'localhost'
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = url.port;
      return port ? `localhost-${port}` : 'localhost';
    }

    // scan.restafy.shop → 'scan'
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      return parts[0];
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// MIDDLEWARE CORS
// ============================================================================

/**
 * Middleware CORS pour authentification cross-subdomain
 * 
 * Configuré pour:
 * 1. Permettre les credentials (cookies, Authorization headers)
 * 2. Inclure les headers d'authentification
 * 3. Valider les origines
 * 4. Supporter les preflight requests
 */
export function createCorsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (!isOriginAllowed(origin)) {
      // Origine non autorisée
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[CORS] Origine non autorisée: ${origin}`);
      }
      // Ne pas ajouter les headers CORS, mais continuer (pour éviter les erreurs)
      return next();
    }

    // Ajouter les headers CORS
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Headers autorisés pour les requêtes
    res.header('Access-Control-Allow-Headers', [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Auth-Token',
    ].join(', '));

    // Méthodes HTTP autorisées
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');

    // Temps de cache pour les preflight requests (24h)
    res.header('Access-Control-Max-Age', '86400');

    // Expose les headers de réponse au client
    res.header('Access-Control-Expose-Headers', [
      'X-Total-Count',
      'X-Session-Expiring-Soon',
      'X-Auth-Token-Refreshed',
      'X-Subdomain',
    ].join(', '));

    // Répondre aux OPTIONS requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  };
}

// ============================================================================
// HEADERS DE SÉCURITÉ ADDITIONNELS
// ============================================================================

/**
 * Ajoute des headers de sécurité pour les requêtes cross-subdomain
 */
export function addSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Éviter le clickjacking (sauf pour les iframes dans restafy.shop)
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.header('X-Frame-Options', 'SAMEORIGIN');
  } else {
    res.header('X-Frame-Options', 'DENY');
  }

  // Protéger contre le MIME type sniffing
  res.header('X-Content-Type-Options', 'nosniff');

  // Protéger contre le XSS
  res.header('X-XSS-Protection', '1; mode=block');

  // Politique de référrer
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

// ============================================================================
// VALIDATION DE SESSION CROSS-SUBDOMAIN
// ============================================================================

/**
 * Middleware pour vérifier que la session provient du bon sous-domaine
 */
export function validateSubdomainConsistency(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  
  if (!origin || !isOriginAllowed(origin)) {
    return next();
  }

  const subdomain = extractSubdomain(origin);
  if (subdomain) {
    // Ajouter le sous-domaine dans la requête pour le logging/audit
    (req as any).subdomain = subdomain;
    res.set('X-Subdomain', subdomain);
  }

  next();
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Formatte les origines autorisées pour les logs
 */
export function formatAllowedOrigins(): string {
  return ALLOWED_ORIGINS.join(', ');
}

/**
 * Exporte la configuration CORS
 */
export function getCorsConfig() {
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Session-Expiring-Soon',
      'X-Auth-Token-Refreshed',
    ],
    maxAge: 86400, // 24 heures
  };
}
