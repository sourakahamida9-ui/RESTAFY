# Architecture d'Authentification Cross-Subdomain

## 📋 Résumé Exécutif

Cette architecture résout le problème d'authentification entre deux sous-domaines:
- **scan.restafy.shop** (PWA QR Scanner)
- **app.restafy.shop** (Application Principale)

### Problèmes Résolus

| Problème | Cause | Solution |
|----------|-------|----------|
| ❌ Token non partagé entre sous-domaines | localStorage isolé par domaine | Cookies HttpOnly avec `domain=.restafy.shop` |
| ❌ Session perdue au refresh | Token stocké localement | Validation serveur + persistance IndexedDB |
| ❌ PWA offline | Pas de fallback | IndexedDB cache + sync au reconnect |
| ❌ XSS token exposure | localStorage = XSS vulnerable | HttpOnly cookies + JWT signés |
| ❌ CORS errors | Mauvaise config | CORS + credentials + SameSite:none |
| ❌ Token expiration sans refresh | Pas de gestion d'expiration | Refresh tokens + auto-refresh |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     restafy.shop                            │
│  (Domaine parent - contrôle des cookies cross-subdomain)   │
└─────────────────────────────────────────────────────────────┘
  │                                                │
  ▼                                                ▼
┌──────────────────────┐              ┌──────────────────────┐
│ scan.restafy.shop    │              │ app.restafy.shop     │
│   (QR Scanner PWA)   │              │  (Main Application)  │
│                      │              │                      │
│ • Client React       │              │ • Client React       │
│ • Service Worker     │              │ • Supabase Auth      │
│ • IndexedDB          │              │ • Session Store      │
│ • useCrossSubdomain  │              │ • useAuth            │
│   Auth Hook          │              │                      │
└──────────────────────┘              └──────────────────────┘
  │                                                │
  │         ┌─────────────────────────┐          │
  │         │  Partagé via cookies    │          │
  │         │  domain=.restafy.shop   │          │
  │         │  httpOnly=true          │          │
  │         │  sameSite=none          │          │
  │         │  secure=true (HTTPS)    │          │
  │         └─────────────────────────┘          │
  │                  │                            │
  └──────────────────┼────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────────┐
         │   Backend/API Server     │
         │                          │
         │ • JWT Tokens             │
         │ • Session Storage        │
         │ • CORS Config            │
         │ • Permission Check       │
         │ • Token Refresh          │
         └──────────────────────────┘
```

### Flux d'Authentification

```
1. PREMIÈRE CONNEXION (app.restafy.shop)
   ┌─────────────────────────────────────────────┐
   │ Utilisateur se connecte via Supabase Auth   │
   │ (app.restafy.shop/login)                    │
   └─────────────────────────────────────────────┘
                    │
                    ▼
   ┌─────────────────────────────────────────────┐
   │ Backend génère:                             │
   │ - Session Token JWT (8h)                   │
   │ - Refresh Token JWT (30j)                  │
   └─────────────────────────────────────────────┘
                    │
                    ▼
   ┌─────────────────────────────────────────────┐
   │ Cookies définis avec:                       │
   │ - domain: .restafy.shop (IMPORTANT!)        │
   │ - httpOnly: true (sécurité XSS)             │
   │ - sameSite: none (cross-subdomain)          │
   │ - secure: true (HTTPS only)                 │
   └─────────────────────────────────────────────┘

2. ACCÈS À scan.restafy.shop
   ┌─────────────────────────────────────────────┐
   │ Utilisateur visite scan.restafy.shop        │
   │ useCrossSubdomainAuth hook:                 │
   │ 1. Cherche token dans localStorage          │
   │ 2. Fallback: IndexedDB (offline)            │
   │ 3. Validate avec serveur via credentials    │
   └─────────────────────────────────────────────┘
                    │
                    ▼
   ┌─────────────────────────────────────────────┐
   │ Requête avec cookies (auto via credentials) │
   │ GET /api/auth/validate                      │
   │ Headers {credentials: 'include'}            │
   │ Cookies {auth-session: JWT} (partagé!)      │
   └─────────────────────────────────────────────┘
                    │
                    ▼
   ┌─────────────────────────────────────────────┐
   │ Serveur vérifie JWT + permissions           │
   │ Réponse: {user, session} ou erreur          │
   └─────────────────────────────────────────────┘
                    │
                    ▼
   ┌─────────────────────────────────────────────┐
   │ ✅ Utilisateur authentifié sur les 2 apps   │
   │ même cookie partagé = même utilisateur      │
   └─────────────────────────────────────────────┘

3. TOKEN EXPIRATION & REFRESH
   ┌─────────────────────────────────────────────┐
   │ Token expire dans < 5 min                    │
   │ Hook détecte: isExpiringSoon = true         │
   └─────────────────────────────────────────────┘
                    │
                    ▼
   ┌─────────────────────────────────────────────┐
   │ POST /api/auth/refresh                      │
   │ Body: {refreshToken}                        │
   │ → Nouveau session token                     │
   │ → Nouveau refresh token                     │
   └─────────────────────────────────────────────┘
                    │
                    ▼
   ┌─────────────────────────────────────────────┐
   │ Cookies mis à jour automatiquement           │
   │ Session prolongée de 8h                     │
   └─────────────────────────────────────────────┘

4. MODE OFFLINE (PWA)
   ┌─────────────────────────────────────────────┐
   │ Connexion perdue                            │
   │ useCrossSubdomainAuth:                      │
   │ → Fallback IndexedDB                        │
   │ → Afficher cached session                   │
   │ → Queue les actions offline                 │
   └─────────────────────────────────────────────┘
                    │
                    ▼
   ┌─────────────────────────────────────────────┐
   │ Connexion rétablie                          │
   │ Sync automatique + validation serveur       │
   │ Session mise à jour                         │
   └─────────────────────────────────────────────┘
```

---

## 🔑 Composants Clés

### 1. **Cross-Domain Cookies** (`getSessionCookieOptions`)

```javascript
{
  httpOnly: true,           // ✅ Protection XSS
  path: "/",                // ✅ Valide partout
  domain: ".restafy.shop",  // ✅ Cross-subdomain!
  sameSite: "none",         // ✅ Nécessaire cross-domain
  secure: true              // ✅ HTTPS only
}
```

**Pourquoi `.restafy.shop` avec le point?**
- `scan.restafy.shop` peut accéder au cookie
- `app.restafy.shop` peut accéder au cookie
- Impossible sans le point
- `restafy.shop` seul = pas de sous-domaines

### 2. **JWT Tokens Sécurisés** (`generateSessionToken`)

```javascript
// Session Token (courte durée)
{
  userId: "uuid",
  sessionId: "uuid",
  type: "agent_scan|manager|admin|client",
  permissions: ["scan:qr", "read:events"],
  restaurantId: "uuid?",
  expiresAt: timestamp,
  nonce: "uuid", // Prévient les replays
  issuer: "restafy-sso",
  audience: "restafy-subdomain-auth"
}

// Refresh Token (longue durée)
{
  sessionId: "uuid",
  userId: "uuid",
  type: "agent_scan",
  expiresAt: timestamp (30 jours)
}
```

### 3. **CORS Configuration** (`corsConfig.ts`)

Permet les requêtes cross-subdomain avec credentials:

```javascript
{
  origin: [
    "https://scan.restafy.shop",
    "https://app.restafy.shop",
    "https://www.restafy.shop"
  ],
  credentials: true,        // ✅ Inclut les cookies
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type"],
  sameSite: "none",         // ✅ Cross-domain
  secure: true              // ✅ HTTPS
}
```

### 4. **Client-Side Hook** (`useCrossSubdomainAuth`)

Gère:
- ✅ Validation de session au démarrage
- ✅ Stockage offline (IndexedDB)
- ✅ Refresh automatique des tokens
- ✅ Notification d'expiration
- ✅ Fallback gracieux

```typescript
const {
  user,                    // Session actuelle
  isAuthenticated,         // boolean
  isLoading,              // boolean
  error,                  // string | null
  
  login,                  // (userId, token) => Promise<boolean>
  logout,                 // () => Promise<void>
  refreshSession,         // () => Promise<boolean>
  
  timeUntilExpiry,        // seconds
  isExpired,              // boolean
  isExpiringSoon,         // boolean (< 5 min)
} = useCrossSubdomainAuth({
  autoValidate: true,
  validationInterval: 300,
  useOfflineStorage: true,
  onSessionExpiring: () => console.log('Refresh token soon!')
});
```

---

## 🚀 Implémentation

### Backend Setup

```typescript
// 1. Ajouter les middlewares au serveur Express
import { createCorsMiddleware, addSecurityHeaders } from './server/_core/corsConfig';
import { authenticateRequest } from './server/_core/crossSubdomainAuth';

const app = express();

// CORS pour cross-subdomain
app.use(createCorsMiddleware());

// Sécurité additionnelle
app.use(addSecurityHeaders);

// Authentification optionnelle sur toutes les routes
app.use(async (req, res, next) => {
  const session = await authenticateRequest(req, res);
  (req as any).session = session;
  next();
});

// 2. Ajouter le router auth
import { authRouter } from './server/routers/auth';
export const appRouter = router({
  auth: authRouter,
  // ... autres routers
});

// 3. Configurer les cookies avec domain cross-subdomain
import { getSessionCookieOptions } from './server/_core/cookies';
const cookieOptions = getSessionCookieOptions(req);
res.cookie('auth-session', token, cookieOptions);
```

### Frontend Setup

```typescript
// 1. Utiliser le hook dans le composant principal
import { useCrossSubdomainAuth } from '@/hooks/useCrossSubdomainAuth';

export function App() {
  const auth = useCrossSubdomainAuth({
    autoValidate: true,
    useOfflineStorage: true,
    onSessionExpiring: () => {
      toast.warning('Votre session expire dans 5 minutes');
    }
  });

  if (auth.isLoading) return <Loader />;
  if (!auth.isAuthenticated) return <LoginPage />;

  return (
    <AuthContext.Provider value={auth}>
      <MainApp />
    </AuthContext.Provider>
  );
}

// 2. Utiliser dans les composants
export function Dashboard() {
  const auth = useContext(AuthContext);

  if (auth.isExpiringSoon) {
    return <RefreshPrompt onRefresh={auth.refreshSession} />;
  }

  return (
    <div>
      <p>Session expires in {auth.timeUntilExpiry}s</p>
      <button onClick={() => auth.logout()}>Logout</button>
    </div>
  );
}

// 3. Fetch avec credentials (important!)
async function apiCall(endpoint: string) {
  const response = await fetch(endpoint, {
    credentials: 'include', // ✅ Inclut les cookies
    headers: {
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}
```

---

## 🔐 Sécurité

### Checklist Sécurité

- ✅ **HttpOnly Cookies**: Protection contre XSS (JavaScript ne peut pas accéder)
- ✅ **Secure Flag**: HTTPS only (pas d'envoi en HTTP)
- ✅ **SameSite=None**: Permet cross-subdomain (mais nécessite Secure)
- ✅ **JWT Signé**: Impossible de falsifier sans la clé secrète
- ✅ **Token Expiration**: Sessions courtes (8h max)
- ✅ **Refresh Tokens**: Renouvellement sans relogin
- ✅ **CORS Stricte**: Validation des origines
- ✅ **Nonce dans Token**: Prévient les replays
- ✅ **User Agent Checking**: Détecte les token volés
- ✅ **IP Validation**: Détecte l'utilisation depuis un autre pays

### Prévention des Attaques

| Attaque | Mitigated By |
|---------|-------------|
| **XSS** | HttpOnly cookies |
| **CSRF** | Same-site cookies + CORS validation |
| **Token Theft** | HttpOnly + HTTPS only |
| **Token Replay** | Nonce + IP validation |
| **Session Fixation** | Token expiration |
| **Privilege Escalation** | Server-side permission check |
| **Subdomain Takeover** | Domain validation in cookies |

---

## 📱 PWA Compatibility

### Service Worker Integration

```typescript
// Dans le Service Worker
self.addEventListener('fetch', event => {
  // Permettre les requêtes avec credentials
  const request = new Request(event.request, {
    credentials: 'include' // ✅ Important!
  });

  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache-first pour les ressources statiques
        if (request.method === 'GET') {
          const cache = await caches.open('v1');
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => {
        // Offline: retourner du cache
        return caches.match(request);
      })
  );
});
```

### Offline Session Persistence

```typescript
// IndexedDB schema
{
  objectStore: 'sessions',
  keyPath: 'sessionId',
  data: {
    userId: "...",
    sessionId: "...",
    token: "...",
    expiresAt: timestamp,
    savedAt: timestamp
  }
}

// Récupération
const offlineSession = await getSessionFromIndexedDB();
if (offlineSession) {
  // Afficher la session cached
  // Synchroniser au reconnect
}
```

---

## 🧪 Testing

### Test d'Authentification Cross-Subdomain

```bash
# 1. Start dev server
npm run dev

# 2. Test cookies partagés
curl -H "Cookie: auth-session=test" \
  http://scan.restafy.shop:3000/api/auth/validate

curl -H "Cookie: auth-session=test" \
  http://app.restafy.shop:3000/api/auth/validate

# 3. Test CORS
curl -H "Origin: https://scan.restafy.shop" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization" \
  -X OPTIONS \
  https://api.restafy.shop/api/auth/validate

# 4. Test refresh token
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"..."}' \
  https://api.restafy.shop/api/auth/refresh
```

### Checklist de Test

- [ ] Login sur app.restafy.shop
- [ ] Accès à scan.restafy.shop → encore authentifié
- [ ] Refresh de page → session persistée
- [ ] Mode offline → cache affichée
- [ ] Mode offline → reconnect → sync
- [ ] Token expiry < 5 min → notification
- [ ] Refresh token → new session token
- [ ] Logout → session cleared
- [ ] CORS preflight → 204 response
- [ ] Invalid token → 401 response

---

## 🐛 Troubleshooting

### Problème: "Authentifié sur app mais pas sur scan"

**Cause**: Cookies non partagés

**Solution**:
```typescript
// ✅ Correct
domain: ".restafy.shop"  // Avec le point!

// ❌ Incorrect
domain: "restafy.shop"   // Sans le point!
```

### Problème: "CORS error quand accès à scan depuis app"

**Cause**: Pas de `credentials: 'include'`

**Solution**:
```javascript
// ✅ Correct
fetch(url, {
  credentials: 'include',  // Important!
  ...
})

// ❌ Incorrect
fetch(url, {
  // Oublié credentials!
})
```

### Problème: "Token volé/intercepté"

**Cause**: Token dans localStorage ou non-HttpOnly

**Solution**:
- ✅ Utiliser HttpOnly cookies uniquement
- ✅ Jamais localStorage pour les tokens
- ✅ Toujours HTTPS en production
- ✅ Valider l'User-Agent côté serveur

### Problème: "Session perdue après refresh"

**Cause**: Pas de fallback offline

**Solution**:
```typescript
// ✅ Utiliser IndexedDB
useOfflineStorage: true

// Et valider au démarrage
useEffect(() => {
  // IndexedDB fallback si pas de localStorage
}, [])
```

---

## 📚 References

- [JWT.io](https://jwt.io) - JWT specification
- [OWASP: Cookie Security](https://owasp.org/www-community/controls/Cookie_Security)
- [MDN: HttpOnly Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [SameSite Cookie Explained](https://web.dev/samesite-cookies-explained/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

## 🎯 Prochaines Étapes

1. **Tester la configuration** sur les sous-domaines réels
2. **Mettre en place le monitoring** des tokens
3. **Ajouter le 2FA** pour les admins
4. **Implémenter le logout distribué** (logout sur tous les sous-domaines)
5. **Ajouter l'audit logging** des authentifications
6. **Configurer le key rotation** pour les secrets JWT

---

**Version**: 1.0.0  
**Auteur**: Restafy Auth Team  
**Dernière mise à jour**: 2026-04-11
