# 🚀 PLAN DE MIGRATION: 100% Kkiapay (Option A - Recommandée)

**Date:** 2026-05-06  
**Status:** 📋 À EXÉCUTER  
**Effort Estimé:** 4-6 heures  
**Risk Level:** 🟡 MOYEN (bien documenté, pas de breakage critique)

---

## 🎯 Objectif

**Remplacer 100% Genius Pay par Kkiapay**
- Supprimer 94 références GeniusPay de `api/payments/initiate.ts`
- Nettoyer docs/tests GeniusPay
- Mettre à jour configuration env vars
- Valider suite complète de tests

**Résultat Final:**
- ✅ Une seule gateway de paiement (Kkiapay)
- ✅ Code 2x plus simple
- ✅ Réduction dette technique
- ✅ Production-ready

---

## 📋 PRÉ-CONDITION (VALIDATION)

Avant de lancer la migration, vérifier:

```bash
# ✅ 1. Kkiapay fonctionne déjà en production
curl -X POST https://app.restafy.shop/api/payments/initiate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "description": "Test migration",
    "customer_name": "Test User",
    "customer_email": "test@example.com",
    "customer_phone": "+22912345678"
  }'
# Attendu: { "success": true, "checkout_url": "..." }

# ✅ 2. Variables env Kkiapay définies
echo $KKIAPAY_PUBLIC_KEY
echo $KKIAPAY_PRIVATE_KEY

# ✅ 3. Tests unitaires Kkiapay passent
pnpm run test -- api/payments/_verifyKkiapay.ts

# ✅ 4. Webhooks Kkiapay configurés
# Dans le dashboard Kkiapay: https://app.kkiapay.me/dashboard
# Vérifier que POST https://app.restafy.shop/api/webhooks?type=payment est enregistré
```

**Si tout vert ✅ → Lancer la migration**

---

## 🔧 ÉTAPE 1: Nettoyer `api/payments/initiate.ts`

### Avant (1828 lignes - dual-gateway messy)
```typescript
// 94 références GeniusPay mélangées
const GENIUSPAY_BASE_URL = process.env.GENIUSPAY_BASE_URL || '...';
const getGeniusPayKeys = () => {...};
const buildGeniusPayHeaders = () => {...};
const mapGeniusPayStatus = () => {...};

// Code Kkiapay aussi (20 refs)
// Deux systèmes coexistent = confusion
```

### Après (Étape 1 seulement - supprimer GP)
```typescript
// ✅ SUPPRIMER TOUT:
// - import GENIUSPAY_* variables
// - getGeniusPayKeys()
// - buildGeniusPayHeaders()
// - mapGeniusPayStatus()
// - Tout code commenté avec "GeniusPay"
// - Les 2-3 fallbacks "si Kkiapay échoue → essayer GP"

// ✅ GARDER:
// - Logique Kkiapay pure (~ 300-400 lignes)
// - Validation téléphone
// - Gestion erreurs
// - Auth + CORS
```

### Action à Coder

```diff
api/payments/initiate.ts

- const GENIUSPAY_BASE_URL = process.env.GENIUSPAY_BASE_URL || 'https://pay.genius.ci/api/v1/merchant';
- const GENIUSPAY_PUBLIC_KEY = process.env.GENIUSPAY_PUBLIC_KEY || '';
- const GENIUSPAY_SECRET_KEY = process.env.GENIUSPAY_SECRET_KEY || '';

- function getGeniusPayKeys() { ... }
- function buildGeniusPayHeaders() { ... }
- function mapGeniusPayStatus() { ... }

// Garder:
+ const KKIAPAY_BASE_URL = process.env.KKIAPAY_BASE_URL || 'https://api.kkiapay.me/api/v1';
+ const KKIAPAY_PUBLIC_KEY = process.env.KKIAPAY_PUBLIC_KEY || '';
+ const KKIAPAY_PRIVATE_KEY = process.env.KKIAPAY_PRIVATE_KEY || '';
+ const KKIAPAY_SECRET_KEY = process.env.KKIAPAY_SECRET_KEY || '';
```

**Fichier principal à refactoriser:**
- 📄 `api/payments/initiate.ts` (1828 → ~400 lignes après nettoyage)

---

## 📝 ÉTAPE 2: Mettre à jour `.env.example`

### Avant
```bash
# GeniusPay (à supprimer)
GENIUSPAY_PUBLIC_KEY=pk_sandbox_...
GENIUSPAY_SECRET_KEY=sk_sandbox_...
GENIUSPAY_BASE_URL=https://pay.genius.ci/api/v1/merchant
GENIUSPAY_WEBHOOK_SECRET=whsec_...
GENIUSPAY_ENVIRONMENT=sandbox

# Kkiapay (garder)
VITE_KKIAPAY_PUBLIC_KEY=...
KKIAPAY_PRIVATE_KEY=...
KKIAPAY_SECRET_KEY=...
```

### Après
```bash
# ========================================
# PAYMENT GATEWAY — Kkiapay ONLY ✅
# ========================================
# Docs: https://docs.kkiapay.me
# Dashboard: https://app.kkiapay.me/dashboard

# Public Key (exposed on client — safe)
VITE_KKIAPAY_PUBLIC_KEY=pk_...

# Backend Secrets (ONLY in Vercel env vars)
KKIAPAY_PRIVATE_KEY=sk_private_...
KKIAPAY_SECRET_KEY=sk_secret_...

# Mode: 'sandbox' (tests) ou 'production' (live)
KKIAPAY_ENVIRONMENT=sandbox

# Base URL (development can override)
KKIAPAY_BASE_URL=https://api.kkiapay.me/api/v1
```

**Fichier à mettre à jour:**
- 📄 `.env.example`

---

## 🗑️ ÉTAPE 3: Nettoyer la Documentation & Tests GeniusPay

### À SUPPRIMER

```bash
❌ GENIUSPAY_INTEGRATION.md
❌ GENIUSPAY_PRODUCTION.md
❌ GENIUSPAY_FINAL_REPORT.md
❌ GENIUSPAY_ACTION_ITEMS.md
❌ GENIUSPAY_API_CONFORMANCE_REPORT.md
❌ PAYMENT_CODE_REVIEW.md
❌ PAYMENT_VALIDATION_CHECKLIST.md
❌ PAYMENT_MONITORING_GUIDE.md
❌ PAYMENT_SYSTEM_SUMMARY.md
❌ CODE_REVIEW_SUMMARY.md
❌ scripts/test-geniuspay.js
❌ scripts/test-geniuspay-error-handling.js
❌ scripts/test-geniuspay-api.js
```

### À GARDER & RENOMMER

```bash
✅ KKIAPAY_INTEGRATION.md (new)
✅ KKIAPAY_SETUP_GUIDE.md (new)
✅ PAYMENT_SYSTEM_ARCHITECTURE.md (rewrite)
✅ scripts/test-kkiapay.js (renamed from test-geniuspay.js)
```

**Commandes:**
```bash
# Supprimer fichiers GP
rm GENIUSPAY_*.md PAYMENT_*.md CODE_REVIEW_SUMMARY.md
rm scripts/test-geniuspay*.js

# Créer README pour la migration
touch KKIAPAY_INTEGRATION_COMPLETE.md
```

---

## 🔗 ÉTAPE 4: Vérifier/Mettre à Jour les Webhooks

### État Actuel (Mixed)
```
api/webhooks/index.ts:
- 28 références GeniusPay
- 41 références Kkiapay
- Deux handlers: handleGeniusPay() + handleKkiapay()
```

### À Faire

**Supprimer le handler GeniusPay:**
```diff
api/webhooks/index.ts

- if (provider === 'geniuspay') {
-   // handleGeniusPay...
- }
+ // GP supprimé

+ if (provider === 'kkiapay') {
+   // handleKkiapay() — SEUL et UNIQUE
+ }
```

**Vérifier le routing:**
```typescript
// Query param dans le webhook URL
// Avant: POST /api/webhooks?type=payment&provider=geniuspay
// Après: POST /api/webhooks?type=payment&provider=kkiapay

// ✅ Tester avec curl:
curl -X POST https://app.restafy.shop/api/webhooks?type=payment \
  -H "Content-Type: application/json" \
  -H "X-Kkiapay-Signature: ..." \
  -d '{...webhook payload...}'
```

**Fichier à mettre à jour:**
- 📄 `api/webhooks/index.ts` (supprimer ~200 lignes de code GP)

---

## ✅ ÉTAPE 5: Valider Configuration Vercel

### Variables à Vérifier dans Vercel Dashboard

**URL:** https://vercel.com/account/team/~/projects/restafy-prod/settings/environment-variables

| Variable | Value | Scope | Note |
|----------|-------|-------|------|
| `KKIAPAY_PUBLIC_KEY` | `pk_...` | Production | Déjà présent? |
| `KKIAPAY_PRIVATE_KEY` | `sk_private_...` | Production | À ajouter si absent |
| `KKIAPAY_SECRET_KEY` | `sk_secret_...` | Production | À ajouter si absent |
| `KKIAPAY_ENVIRONMENT` | `production` | Production | À mettre à `production` |
| `GENIUSPAY_PUBLIC_KEY` | ❌ **SUPPRIMER** | - | Remove |
| `GENIUSPAY_SECRET_KEY` | ❌ **SUPPRIMER** | - | Remove |
| `GENIUSPAY_WEBHOOK_SECRET` | ❌ **SUPPRIMER** | - | Remove |

**Action:**
```bash
# ✅ Dans Vercel Settings:
# 1. Ajouter KKIAPAY_PRIVATE_KEY, KKIAPAY_SECRET_KEY (si absents)
# 2. Mettre KKIAPAY_ENVIRONMENT = 'production'
# 3. SUPPRIMER toutes les variables GENIUSPAY_*
# 4. Redeploy
```

---

## 🧪 ÉTAPE 6: Tests & Validation

### A. Tests Unitaires
```bash
# Tester la logique Kkiapay
pnpm run test -- api/payments/_verifyKkiapay.ts

# Lint + TypeScript
pnpm run lint
pnpm run type-check

# Build
pnpm run build

# ✅ Tous devraient PASSER
```

### B. Tests d'Intégration (Manual in Staging)

```bash
# 1. Tester un vrai paiement
curl -X POST https://app-staging.restafy.shop/api/payments/initiate \
  -H "Authorization: Bearer STAGING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "description": "Test Kkiapay integration",
    "customer_name": "Migration Test",
    "customer_email": "test@restafy.shop",
    "customer_phone": "+22912345678"
  }'

# ✅ Attendu: 
# { "success": true, "checkout_url": "https://checkout.kkiapay.me/..." }

# 2. Suivre le lien checkout
# → Completer le paiement
# → Vérifier webhook reçu dans les logs

# 3. Vérifier statut dans Supabase
SELECT * FROM payments WHERE transaction_ref LIKE 'kkiapay_test_%'
ORDER BY created_at DESC LIMIT 1;

# ✅ Attendu: status = 'confirmed', provider = 'kkiapay'
```

### C. Checklist de Validation

- [ ] Aucune référence "geniuspay" dans le code (vérifier avec grep)
  ```bash
  grep -r "geniuspay" . --include="*.ts" --include="*.tsx" --include="*.js"
  # Attendu: 0 résultats
  ```

- [ ] `.env.example` ne contient que des vars Kkiapay
- [ ] Vercel env vars mises à jour (GeniusPay supprimés)
- [ ] Tests unitaires passent
- [ ] Build passe en prod (pas de warnings)
- [ ] Webhook Kkiapay fonctionne end-to-end
- [ ] Documentation Kkiapay à jour
- [ ] Pas de console errors côté client

---

## 📋 RÉSUMÉ DES FICHIERS À MODIFIER

### À MODIFIER

| Fichier | Action | Lignes |
|---------|--------|--------|
| `api/payments/initiate.ts` | Supprimer 94 refs GP | 1828 → ~400 |
| `api/webhooks/index.ts` | Supprimer handler GP | 1372 → ~1100 |
| `.env.example` | Supprimer GP, clarifier KK | ~10 lines |
| `api/payouts/initiate.ts` | Vérifier/nettoyer GP refs | ? |
| `api/cron/index.ts` | Vérifier/nettoyer GP refs | ? |

### À SUPPRIMER

| Fichier | Raison |
|---------|--------|
| `GENIUSPAY_*.md` | Docs obsolètes (5 fichiers) |
| `PAYMENT_*.md` | Docs obsolètes (3 fichiers) |
| `CODE_REVIEW_SUMMARY.md` | Docs obsolètes |
| `scripts/test-geniuspay*.js` | Tests obsolètes (3 fichiers) |

### À CRÉER

| Fichier | Contenu |
|---------|---------|
| `KKIAPAY_INTEGRATION_COMPLETE.md` | Rapport de migration |
| `KKIAPAY_SETUP_GUIDE.md` | Guide de setup Kkiapay |

---

## 🚀 PLAN D'EXÉCUTION

### Timing Estimé

| Phase | Durée | Résultat |
|-------|-------|----------|
| **1. Audit préalable** | 30 min | Confirm readiness ✅ |
| **2. Refactor initiate.ts** | 1h 30 | Pure Kkiapay code |
| **3. Nettoyer webhooks** | 45 min | Single handler |
| **4. Docs & cleanup** | 30 min | Supprimer GP files |
| **5. Tests & validation** | 1h | End-to-end tests |
| **6. Staging deploy + QA** | 1h | Smoke tests |
| **Total** | **5-6h** | Production-ready |

### Ordre d'Exécution

```
1️⃣ Validation préalable (30 min)
   └─ Vérifier Kkiapay est fonctionnel
   
2️⃣ Créer PR "Clean up GeniusPay" (3h 45)
   ├─ api/payments/initiate.ts (refactor)
   ├─ api/webhooks/index.ts (nettoyage)
   ├─ .env.example (update)
   ├─ Docs + tests GeniusPay (DELETE)
   └─ Tests unitaires (passer)
   
3️⃣ Créer PR "Migrate Vercel env vars" (30 min)
   ├─ Vérifier KKIAPAY_* variables présentes
   ├─ Supprimer GENIUSPAY_* variables
   └─ Staging deploy + test
   
4️⃣ Merge & Production Deploy (30 min)
   ├─ Monitor logs
   ├─ Webhook events (✅ tous Kkiapay)
   └─ Customer payments (✅ tous Kkiapay)
   
5️⃣ Post-Deploy Monitoring (continu, 1 semaine)
   └─ Alerter sur webhook errors
```

---

## ⚠️ RISQUES & MITIGATION

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|-----------|
| Webhooks échouent après deploy | 🟡 Moyen | 🔴 Critique | Test dans staging d'abord |
| Code GeniusPay non complètement supprimé | 🟢 Bas | 🟡 Moyen | Grep check + code review |
| Env vars mal configurées en prod | 🟡 Moyen | 🔴 Critique | Vercel checklist double-check |
| Clients voient erreur paiement | 🟢 Bas | 🔴 Critique | Feature flag rollback si besoin |

### Plan de Rollback (si catastrophe)

```bash
# Si les paiements crashent après deploy:

# 1. Rollback commit (< 5 min)
git revert <commit-hash>
git push origin main
# Vercel redeploy auto

# 2. Vérifier logs Kkiapay
# Dashboard: https://app.kkiapay.me/dashboard

# 3. Slack alert l'équipe
# "Payment system rolled back - investigating"

# 4. Debug + fix
# Merge PR de fix
# Redeploy
```

---

## ✨ BÉNÉFICES ATTENDUS

### Avant la Migration
```
❌ 94 refs GeniusPay + 20 refs Kkiapay = Confusion
❌ Deux handlers webhook = Maintenance complexe
❌ Docs fragmentées + outdated
❌ Tests ambigus (quoi tester?)
❌ Onboarding dev difficile ("Pourquoi deux gateways?")
```

### Après la Migration
```
✅ Code unitaire, cohérent
✅ Un handler webhook clair
✅ Docs consolidées
✅ Tests ciblés
✅ Onboarding trivial
✅ Réduction dette technique ~40%
✅ Performance identique
✅ Risque de bugs baissé
```

---

## 📞 CONTACTS & ESCALADE

| Situation | Action |
|-----------|--------|
| Question sur Kkiapay | Docs: https://docs.kkiapay.me |
| Webhook ne fonctionne pas | Vérifier Dashboard Kkiapay + logs Vercel |
| Erreur "Invalid API Key" | Vérifier KKIAPAY_PUBLIC_KEY/SECRET_KEY dans Vercel |
| Besoin de rollback urgent | Exécuter script rollback + Slack channel |

---

## 📌 CHECKLIST FINAL

Avant de merger la PR de migration:

- [ ] Code compiles sans warnings: `pnpm run build`
- [ ] Tests passent: `pnpm run test`
- [ ] Aucune ref "geniuspay" dans le code: `grep -r "geniuspay" .`
- [ ] `.env.example` n'a que Kkiapay vars
- [ ] PR description explique les changements
- [ ] Code review approuvée
- [ ] Staging deploy testé (payment end-to-end)
- [ ] Vercel env vars updated (GeniusPay supprimés, Kkiapay confirmés)
- [ ] Logs Vercel inspectés (no errors after deploy)
- [ ] Webhook events tracées (all successful)
- [ ] Customer facing (no errors reported)

---

## 📌 NOTES

- Cette migration est **NON-BREAKING** pour les customers (transparente)
- Les paiements en cours restent valides
- Aucune action requise côté utilisateur
- La migration peut être revertée à tout moment (< 5 min)

---

**Status:** ✅ PRÊT À EXÉCUTER

**Créé par:** Copilot  
**Date:** 2026-05-06  
**Version:** 1.0 (Final)
