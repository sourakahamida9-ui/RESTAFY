# QR Scanner Offline - Mini Application

## Vue d'ensemble

**QR Scanner Offline** est une application web élégante, sécurisée et performante conçue pour scanner les billets d'événements en temps réel. Elle offre un support complet du mode hors-ligne avec synchronisation bidirectionnelle, une validation atomique côté serveur, et une collecte de données comportementales pour l'entraînement d'IA.

### Caractéristiques principales

**Scan en temps réel:** Interface fluide avec scanner QR (html5-qrcode) offrant un feedback visuel immédiat (vert pour succès, orange pour doublon, rouge pour invalide).

**Mode hors-ligne complet:** Les agents de contrôle peuvent continuer à scanner sans connexion internet. Les scans sont stockés localement (IndexedDB) et synchronisés automatiquement dès que la connexion est rétablie.

**Validation atomique:** Chaque billet est validé côté serveur avec une vérification double-check pour prévenir les doublons et les race conditions.

**Tableau de bord en temps réel:** Compteur de billets validés, taux de remplissage, historique des scans, et indicateur de connexion/synchronisation.

**Collecte de données pour l'IA:** Temps de scan, taux d'erreur, géolocalisation indirecte (IP, timezone, langue) pour entraîner des modèles d'IA puissants.

**Design professionnel:** Interface élégante avec animations fluides, transitions douces, et attention particulière aux détails.

## Architecture

### Stack Technologique

**Frontend:**
- React 19 + TypeScript
- Tailwind CSS 4 pour le styling
- html5-qrcode pour le scanning
- Dexie pour IndexedDB
- Recharts pour les visualisations
- Wouter pour le routing

**Backend:**
- Express 4 + Node.js
- tRPC 11 pour les RPC typées
- Drizzle ORM pour la base de données
- MySQL/TiDB pour la persistance
- Zod pour la validation

**Sécurité:**
- Restafy OAuth pour l'authentification
- Validation atomique des QR codes
- Contrôle d'accès basé sur les rôles
- Protection contre les race conditions

### Structure du Projet

```
qr_scanner_offline/
├── client/                          # Frontend React
│   ├── src/
│   │   ├── components/
│   │   │   ├── QRScanner.tsx       # Composant scanner QR
│   │   │   ├── ScanDashboard.tsx   # Tableau de bord
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useOfflineSync.ts   # Gestion sync offline
│   │   ├── lib/
│   │   │   ├── db.ts              # Service IndexedDB
│   │   │   └── trpc.ts            # Client tRPC
│   │   ├── pages/
│   │   │   ├── Home.tsx           # Page d'accueil
│   │   │   └── Scanner.tsx        # Page scanner
│   │   └── App.tsx                # Routes principales
│   └── public/                     # Assets statiques
├── server/                         # Backend Express
│   ├── routers.ts                 # Procédures tRPC
│   ├── db.ts                      # Helpers de base de données
│   ├── _core/                     # Infrastructure
│   │   ├── context.ts             # Contexte tRPC
│   │   ├── trpc.ts                # Définition tRPC
│   │   └── index.ts               # Serveur Express
│   └── *.test.ts                  # Tests unitaires
├── drizzle/                        # Migrations
│   ├── schema.ts                  # Schéma de base de données
│   └── *.sql                      # Migrations SQL
└── shared/                         # Code partagé
    └── const.ts                   # Constantes
```

### Modèle de Données

**Events:** Événements avec capacité, nombre total de billets, et statistiques de scan.

**Tickets:** Billets avec QR code, statut (pending/confirmed/used/cancelled), et données client.

**ScanHistory:** Historique des scans avec timestamp, localisation, type d'appareil, et statut de synchronisation.

**BehavioralData:** Données comportementales pour l'IA (temps de scan, taux d'erreur, timezone, langue, type d'appareil).

**OfflineSyncQueue:** Queue de synchronisation pour les scans hors-ligne.

## Fonctionnalités Détaillées

### 1. Scanner QR

**Composant:** `client/src/components/QRScanner.tsx`

- Utilise html5-qrcode pour l'accès caméra
- Support du zoom et du flip caméra
- Feedback visuel immédiat
- Pause/reprise du scan
- Compteur de billets scannés

**Flux:**
1. Agent ouvre le scanner
2. Pointe la caméra vers le QR code
3. Validation côté serveur (atomique)
4. Feedback visuel (vert/orange/rouge)
5. Billet marqué comme utilisé

### 2. Mode Hors-Ligne

**Infrastructure:** `client/src/lib/db.ts` + `client/src/hooks/useOfflineSync.ts`

**Stockage local:**
- Billets de l'événement (téléchargés au démarrage)
- Scans effectués (avec statut de synchronisation)
- Queue de synchronisation

**Synchronisation:**
- Détection automatique de la connexion
- Tentatives de sync lors du retour en ligne
- Gestion des conflits (priorité serveur)
- Retry avec backoff exponentiel

### 3. Validation Atomique

**Procédure:** `server/db.ts` - `validateAndMarkTicketAsUsed()`

**Garanties:**
- Vérification que le billet n'est pas déjà utilisé
- Mise à jour conditionnelle (WHERE isUsed = 0)
- Vérification post-update
- Détection des race conditions

**Résultats possibles:**
- ✓ Succès: Billet marqué comme utilisé
- ⚠ Doublon: Billet déjà utilisé
- ✗ Invalide: Billet non trouvé ou statut incorrect

### 4. Tableau de Bord

**Composant:** `client/src/components/ScanDashboard.tsx`

**Métriques affichées:**
- Total de billets scannés
- Taux de remplissage (%)
- Temps moyen de scan
- Statut de connexion
- Distribution des scans (pie chart)
- Historique des 10 derniers scans

**Mise à jour:** Toutes les 5 secondes

### 5. Collecte de Données pour l'IA

**Données collectées:**
- Temps de scan (ms)
- Taux d'erreur (type d'erreur)
- Timezone (Intl API)
- Langue (navigator.language)
- Type d'appareil (mobile/desktop)
- Adresse IP (côté serveur)

**Stockage:** Table `behavioral_data` pour analyse ultérieure

**Utilisation:** Entraînement de modèles d'IA pour:
- Prédiction des patterns de scan
- Détection d'anomalies
- Optimisation des processus

## Sécurité

### Authentification

- Restafy OAuth pour l'authentification sécurisée
- Sessions avec HttpOnly cookies
- JWT secrets pour la signature

### Autorisation

- Endpoints protégés (nécessitent authentification)
- Rôles (admin/user)
- Contrôle d'accès basé sur le contexte

### Protection des Données

- Validation stricte des entrées (Zod)
- Parameterized queries (Drizzle ORM)
- Protection contre les injections SQL
- Protection XSS (React)
- Protection CSRF (OAuth)

### Intégrité des Données

- Validation atomique des QR codes
- Prévention des doublons
- Gestion des race conditions
- Audit logging complet

Voir [SECURITY.md](./SECURITY.md) pour les détails complets.

## Tests

### Tests Unitaires

```bash
pnpm test
```

**Couverture:**
- ✓ Validation atomique des QR codes (4 tests)
- ✓ Synchronisation offline (4 tests)
- ✓ Performance (4 tests)
- ✓ Authentification (1 test)

**Total:** 13 tests, tous passés

### Tests de Performance

**Validations:**
- Validation QR < 500ms
- Synchronisation 100 scans < 2s
- Récupération 50 scans < 200ms
- 10 scans concurrents < 2s

## Déploiement

### Build Production

```bash
pnpm build
```

**Sortie:**
- Client: `dist/public/` (Vite SPA)
- Serveur: `dist/index.js` (esbuild)

**Taille:**
- CSS: 123.65 KB (gzip: 19.22 KB)
- JS: 1,553.12 KB (gzip: 451.42 KB)

### Démarrage

```bash
pnpm start
```

Serveur écoute sur `http://localhost:3000`

### Variables d'Environnement

```
DATABASE_URL=mysql://...
JWT_SECRET=...
VITE_APP_ID=...
OAUTH_SERVER_URL=...
VITE_OAUTH_PORTAL_URL=...
```

## Utilisation

### Pour les Agents de Contrôle

1. **Connexion:** Cliquer sur "Se connecter" et s'authentifier via Restafy OAuth
2. **Sélection d'événement:** Choisir l'événement à scanner
3. **Téléchargement des billets:** Cliquer sur "Télécharger billets" pour préparer le mode offline
4. **Scanning:** Pointer la caméra vers les QR codes
5. **Synchronisation:** Les scans sont synchronisés automatiquement en ligne

### Mode Hors-Ligne

- Les billets téléchargés restent accessibles sans connexion
- Les scans sont enregistrés localement
- Synchronisation automatique au retour en ligne
- Indicateur visuel du statut de connexion

## Optimisations

### Performance

- Lazy loading du scanner QR
- Virtualisation de l'historique des scans
- Memoization des composants
- Optimisation des requêtes tRPC

### Bundle Size

- Code splitting par route
- Tree shaking des dépendances
- Compression gzip
- Minification du CSS/JS

## Recommandations pour la Production

### Sécurité

- [ ] Chiffrer les QR codes en base (AES-256)
- [ ] Chiffrer les adresses IP
- [ ] TLS 1.3+ obligatoire
- [ ] WAF (Web Application Firewall)
- [ ] Rate limiting

### Monitoring

- [ ] Logs centralisés (ELK/Datadog)
- [ ] Alertes sur tentatives de double-scan
- [ ] Audit trail complet
- [ ] Métriques de performance

### Conformité

- [ ] RGPD: Droit à l'oubli
- [ ] CCPA: Transparence
- [ ] Consentement explicite pour l'IA

### Infrastructure

- [ ] Backup et disaster recovery
- [ ] Load balancing
- [ ] CDN pour les assets statiques
- [ ] Database replication

## Support et Maintenance

### Logs

- `devserver.log` - Logs du serveur
- `browserConsole.log` - Logs du navigateur
- `networkRequests.log` - Requêtes HTTP
- `sessionReplay.log` - Interactions utilisateur

### Debugging

```bash
# Vérifier les erreurs TypeScript
pnpm check

# Exécuter les tests
pnpm test

# Démarrer le serveur de développement
pnpm dev
```

## Licence

MIT

## Auteur

Restafy Team - 2026
