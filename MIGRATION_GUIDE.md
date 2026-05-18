# Guide de Migration: Cross-Subdomain Authentication

## 📋 Vue d'Ensemble

Ce guide explique comment migrer du système actuel vers la nouvelle architecture d'authentification cross-subdomain.

### Timeline Estimée
- Phase 1: Setup (Jour 1) → 2-3h
- Phase 2: Migration Code (Jour 2) → 4-6h
- Phase 3: Testing (Jour 3) → 3-4h
- Phase 4: Deployment (Jour 4) → 2-3h

---

## Phase 1: Setup Infrastructure

### 1.1 Ajouter les Fichiers Système

Les fichiers suivants ont été créés:

```
✅ qr_scanner_offline/server/_core/crossSubdomainAuth.ts
✅ qr_scanner_offline/server/_core/corsConfig.ts
✅ qr_scanner_offline/server/_core/cookies.ts (modifié)
✅ qr_scanner_offline/client/src/hooks/useCrossSubdomainAuth.ts
✅ qr_scanner_offline/server/routers/auth.ts
✅ CROSS_SUBDOMAIN_AUTH.md
✅ MIGRATION_GUIDE.md
✅ .env.cross-subdomain.example
```

### 1.2 Copier la Configuration d'Environnement

```bash
# Créer le fichier .env basé sur l'exemple
cp .env.cross-subdomain.example .env.local

# Générer un JWT_SECRET sécurisé
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env.local

# Éditer .env.local et configurer:
# - JWT_SECRET ✅
# - MAIN_DOMAIN ✅
# - ALLOWED_ORIGINS ✅
```

### 1.3 Installer les Dépendances (si manquantes)

```bash
# Les packages suivants doivent être présents:
npm list jose         # JWT signing/verification
npm list zod          # Schema validation
npm list express      # HTTP server
npm list cookie       # Cookie handling

# Si manquants:
npm install jose zod express cookie
```

---

## Phase 2: Migration du Code

### 2.1 Backend: Ajouter les Middlewares

Éditer le fichier principal d'initialisation du serveur:

```typescript
// server/index.ts ou server/app.ts

import express from 'express';
import cookieParser from 'cookie-parser';
import {
  createCorsMiddleware,
  addSecurityHeaders,
  validateSubdomainConsistency
} from './_core/corsConfig';
import { authRouter } from './routers/auth';

const app = express();

// 1. ✅ Middleware de parsing
app.use(express.json());
app.use(cookieParser());

// 2. ✅ CORS pour cross-subdomain
app.use(createCorsMiddleware());

// 3. ✅ Headers de sécurité
app.use(addSecurityHeaders);

// 4. ✅ Validation subdomain
app.use(validateSubdomainConsistency);

// 5. ✅ Router d'authentification
app.use('/api/auth', authRouter);

// ... rest of middleware

export { app };
```

### 2.2 Backend: Intégrer dans le Contexte tRPC

Éditer `server/_core/context.ts`:

```typescript
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { authenticateRequest } from "./crossSubdomainAuth";
import type { CrossSubdomainSession } from "./crossSubdomainAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  // ✅ Ajouter la session
  session: CrossSubdomainSession | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // ✅ Authentifier automatiquement
  const session = await authenticateRequest(opts.req, opts.res);

  return {
    req: opts.req,
    res: opts.res,
    session,
  };
}
```

### 2.3 Backend: Créer les Routes API

Les routes API ont été créées dans `server/routers/auth.ts`.

Ajouter au router principal:

```typescript
// server/routers.ts ou server/index.ts

import { authRouter } from './routers/auth';
import { router } from './_core/trpc';

export const appRouter = router({
  auth: authRouter,
  // ... autres routers existants
});

export type AppRouter = typeof appRouter;
```

### 2.4 Frontend: Remplacer les Hooks Auth

#### Avant (useAuth avec localStorage)
```typescript
// ❌ Ancien système
const { user, isAuthenticated, login, logout } = useAuth();
// Problèmes:
// - Token stocké en localStorage (XSS vulnerable)
// - Pas de partage cross-subdomain
// - Pas de persistence offline
```

#### Après (useCrossSubdomainAuth)
```typescript
// ✅ Nouveau système
const {
  user,
  isAuthenticated,
  isLoading,
  login,
  logout,
  refreshSession,
  isExpiringSoon,
  timeUntilExpiry,
} = useCrossSubdomainAuth({
  autoValidate: true,
  useOfflineStorage: true,
  onSessionExpiring: () => {
    showNotification('Votre session expire dans 5 minutes');
  }
});

// Avantages:
// + Token en HttpOnly cookies (sécurisé)
// + Partagé entre sous-domaines automatiquement
// + Persistence offline via IndexedDB
// + Auto-refresh des tokens
// + PWA compatible
```

### 2.5 Frontend: Mise à Jour des Composants

#### App Root Component

```typescript
// src/App.tsx

import { useCrossSubdomainAuth } from '@/hooks/useCrossSubdomainAuth';
import { AuthContext } from '@/context/AuthContext';

export function App() {
  const auth = useCrossSubdomainAuth({
    autoValidate: true,
    validationInterval: 300,
    useOfflineStorage: true,
    onSessionExpiring: handleSessionExpiring,
    serverUrl: import.meta.env.VITE_API_URL
  });

  if (auth.isLoading) {
    return <LoadingScreen />;
  }

  return (
    <AuthContext.Provider value={auth}>
      <Router>
        <Routes>
          {auth.isAuthenticated ? (
            <>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/scanner" element={<Scanner />} />
              {/* Protected routes */}
            </>
          ) : (
            <>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              {/* Public routes */}
            </>
          )}
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}
```

#### Login Component

```typescript
// src/pages/Login.tsx

import { useCrossSubdomainAuth } from '@/hooks/useCrossSubdomainAuth';

export function Login() {
  const auth = useCrossSubdomainAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Appeler votre endpoint de login existant (Supabase, etc)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // ✅ Important!
      });

      if (!response.ok) throw new Error('Login failed');

      const { sessionToken, user } = await response.json();

      // 2. Utiliser le hook pour valider la session
      const success = await auth.login(user.id, sessionToken);

      if (success) {
        navigate('/dashboard');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Connexion...' : 'Se Connecter'}
      </button>
      {auth.error && <p className="error">{auth.error}</p>}
    </form>
  );
}
```

#### Logout Component

```typescript
// Dans n'importe quel composant

import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';

export function UserMenu() {
  const auth = useContext(AuthContext);

  const handleLogout = async () => {
    await auth.logout();
    navigate('/login');
  };

  return (
    <menu>
      <p>Connecté: {auth.user?.userId}</p>
      <button onClick={handleLogout}>Déconnexion</button>
    </menu>
  );
}
```

#### Session Expiration Alert

```typescript
// src/components/SessionExpirationAlert.tsx

import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/context/AuthContext';

export function SessionExpirationAlert() {
  const auth = useContext(AuthContext);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    // Montrer l'alerte si la session expire dans < 5 min
    setShowAlert(auth.isExpiringSoon && !auth.isExpired);
  }, [auth.isExpiringSoon, auth.isExpired]);

  if (!showAlert) return null;

  return (
    <div className="alert alert-warning">
      <p>
        ⚠️ Votre session expire dans{' '}
        {Math.floor(auth.timeUntilExpiry / 60)} minutes.
      </p>
      <button onClick={() => auth.refreshSession()}>
        Rester Connecté
      </button>
      <button onClick={() => auth.logout()}>
        Me Déconnecter
      </button>
    </div>
  );
}
```

### 2.6 Frontend: Mises à Jour des Requêtes API

#### Avant (sans credentials)
```typescript
// ❌ Ancien
async function getRestaurants() {
  const res = await fetch('/api/restaurants');
  return res.json();
}
```

#### Après (avec credentials)
```typescript
// ✅ Nouveau
async function getRestaurants() {
  const res = await fetch('/api/restaurants', {
    credentials: 'include' // ✅ Inclut les cookies de session
  });
  return res.json();
}
```

Ou créer un utilitaire:

```typescript
// src/lib/api.ts

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await fetch(endpoint, {
    ...options,
    credentials: 'include', // ✅ Toujours inclure
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Session expired
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

// Utilisation:
const restaurants = await apiCall('/api/restaurants');
const created = await apiCall('/api/restaurants', {
  method: 'POST',
  body: JSON.stringify({ name: 'Test' })
});
```

---

## Phase 3: Testing

### 3.1 Test Unitaire

```typescript
// __tests__/auth.test.ts

import { validateSessionToken, generateSessionToken, SessionType } from '../server/_core/crossSubdomainAuth';

describe('Cross-Subdomain Auth', () => {
  it('should generate valid session token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const { token } = await generateSessionToken({
      userId: 'test-user-123',
      type: SessionType.AGENT_SCAN,
      permissions: ['scan:qr'],
      expiresAt: now + 3600,
      issuer: 'restafy-sso',
      audience: 'restafy-subdomain-auth',
      subdomain: 'scan',
    });

    const result = await validateSessionToken(token);
    expect(result.valid).toBe(true);
    expect(result.session?.userId).toBe('test-user-123');
  });

  it('should reject expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const { token } = await generateSessionToken({
      userId: 'test-user-123',
      type: SessionType.AGENT_SCAN,
      permissions: ['scan:qr'],
      expiresAt: now - 3600, // Expired!
      issuer: 'restafy-sso',
      audience: 'restafy-subdomain-auth',
      subdomain: 'scan',
    });

    const result = await validateSessionToken(token);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expir');
  });
});
```

### 3.2 Test d'Intégration

```bash
# 1. Démarrer le serveur dev
npm run dev

# 2. Test CORS preflight (depuis un autre sous-domaine)
curl -X OPTIONS http://localhost:3000/api/auth/validate \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: POST" \
  -v

# 3. Test création de session
curl -X POST http://localhost:3000/api/trpc/auth.createSession \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "type": "agent_scan",
    "permissions": ["scan:qr"]
  }' \
  -v

# 4. Test validation de session
curl http://localhost:3000/api/trpc/auth.validate \
  -H "Cookie: auth-session=JWT_TOKEN_HERE" \
  -v

# 5. Test refresh
curl -X POST http://localhost:3000/api/trpc/auth.refreshSession \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "REFRESH_TOKEN_HERE"}' \
  -v
```

### 3.3 Test Frontend

```typescript
// src/__tests__/useCrossSubdomainAuth.test.ts

import { renderHook, waitFor } from '@testing-library/react';
import { useCrossSubdomainAuth } from '../hooks/useCrossSubdomainAuth';

describe('useCrossSubdomainAuth', () => {
  it('should load user from localStorage', async () => {
    localStorage.setItem('cross-subdomain-session', 'test-token');

    const { result } = renderHook(() => useCrossSubdomainAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should handle logout', async () => {
    const { result } = renderHook(() => useCrossSubdomainAuth());

    await result.current.logout();

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should detect session expiring soon', async () => {
    // Mock time < 5 minutes before expiry
    // ...
    expect(result.current.isExpiringSoon).toBe(true);
  });
});
```

### 3.4 Test Manuel Checklist

- [ ] Login sur app.restafy.shop
- [ ] Cookie `auth-session` visible dans DevTools → Application → Cookies
- [ ] Cookie domain: `.restafy.shop`
- [ ] Cookie httpOnly: ✅
- [ ] Cookie secure: ✅
- [ ] Cookie sameSite: None
- [ ] Naviguer vers scan.restafy.shop
- [ ] Toujours authentifié (pas de redirect login)
- [ ] Même cookie visible
- [ ] F5 refresh → session persistée
- [ ] Timeout 5 min → notification
- [ ] Cliquer "Rester Connecté" → refresh token
- [ ] Cliquer "Déconnexion" → cookies effacés
- [ ] Mode offline → cache affichée
- [ ] Reconnect → sync automatique

---

## Phase 4: Déploiement

### 4.1 Pré-déploiement Checklist

- [ ] Tests unitaires: `npm run test`
- [ ] Tests d'intégration: `npm run test:integration`
- [ ] Linting: `npm run lint`
- [ ] Build: `npm run build`
- [ ] Environnement `.env.production` configuré
- [ ] JWT_SECRET généré et sécurisé
- [ ] COOKIES_SECURE=true
- [ ] VALIDATE_IP_ADDRESS=true
- [ ] VALIDATE_USER_AGENT=true
- [ ] Certificat SSL/TLS installé
- [ ] Subdomains DNS configurés:
  - [ ] scan.restafy.shop → serveur
  - [ ] app.restafy.shop → serveur
  - [ ] api.restafy.shop → serveur (optionnel)

### 4.2 Déploiement Vercel

```bash
# 1. Ajouter les variables d'environnement
vercel env add JWT_SECRET
vercel env add MAIN_DOMAIN
vercel env add ALLOWED_ORIGINS
# ... autres variables

# 2. Configurer les domains
# Dashboard Vercel → Project Settings → Domains
# - scan.restafy.shop
# - app.restafy.shop

# 3. Déployer
vercel --prod

# 4. Vérifier les logs
vercel logs
```

### 4.3 Post-déploiement Tests

```bash
# 1. Test CORS depuis production
curl -H "Origin: https://scan.restafy.shop" \
  https://app.restafy.shop/api/auth/validate

# 2. Test cookies cross-domain
curl -b "auth-session=test" \
  https://app.restafy.shop/api/auth/validate

# 3. Test depuis le navigateur
# - Login sur https://app.restafy.shop
# - Vérifier cookies (DevTools → Application)
# - Navigate https://scan.restafy.shop
# - Vérifier toujours authentifié

# 4. Monitoring
# - Vérifier les logs d'erreur
# - Vérifier les métriques de connexion
# - Tester les cas limites
```

### 4.4 Rollback Plan

Si le déploiement échoue:

```bash
# 1. Revenir à la version précédente
vercel rollback

# 2. Vérifier l'état
vercel env ls

# 3. Analysez les logs
vercel logs --follow

# 4. Reportez le problème avec:
#    - Stack trace complet
#    - JSON de la requête qui a échoué
#    - Version du navigateur
#    - Commandes reproductibles
```

---

## 🚨 Problèmes Courants et Solutions

### "Cookie non partagé entre sous-domaines"

```
❌ Domain: restafy.shop
✅ Domain: .restafy.shop  ← Ajouter le point!
```

### "CORS error: credentials mode is 'include' but Access-Control-Allow-Credentials is missing"

```
❌ fetch(url, {})
✅ fetch(url, { credentials: 'include' })

Et serveur doit avoir:
res.header('Access-Control-Allow-Credentials', 'true');
```

### "Tokens volés depuis un autre pays"

```
✅ Valider IP côté serveur:
VALIDATE_IP_ADDRESS=true

✅ Valider User-Agent:
VALIDATE_USER_AGENT=true
```

### "Session perdue après F5 refresh"

```
✅ Utiliser IndexedDB fallback:
useOfflineStorage: true

✅ Et charger au démarrage:
const offlineSession = await getSessionFromIndexedDB();
```

---

## 📞 Support

Pour les questions ou problèmes:

1. Consulter `CROSS_SUBDOMAIN_AUTH.md` pour les détails techniques
2. Vérifier les logs: `vercel logs`
3. Tester avec `curl`:
   ```bash
   curl -v \
     -H "Origin: https://scan.restafy.shop" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://app.restafy.shop/api/auth/validate
   ```
4. Vérifier `browser DevTools → Application → Cookies`
5. Contactez le team auth Restafy

---

**Version**: 1.0.0  
**Dernière mise à jour**: 2026-04-11
