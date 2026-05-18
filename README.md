# Restafy — Plateforme restaurant, commande & paiement

> **Ne mangez pas. Savourez.**
>
> Plateforme web complète pour **commander**, **payer** (Mobile Money via Genius Pay), **gérer un restaurant** et **vivre des événements** gastronomiques — pensée pour le Bénin et l'Afrique de l'Ouest, extensible à toute ville où vous déployez Supabase.

---

## Sommaire

- [1. Aperçu produit](#1-aperçu-produit)
- [2. Surfaces & URLs](#2-surfaces--urls)
- [3. Stack technique](#3-stack-technique)
- [4. Architecture](#4-architecture)
- [5. Flux métier principaux](#5-flux-métier-principaux)
  - [5.1 Commande client → paiement → cuisine](#51-commande-client--paiement--cuisine)
  - [5.2 Billetterie événement](#52-billetterie-événement)
  - [5.3 Scan billets événement + Scan équipe (token + PIN)](#53-scan-billets-événement--scan-équipe-token--pin)
  - [5.4 Fidélité, parrainage, récompenses](#54-fidélité-parrainage-récompenses)
- [6. Fiabilité paiement (P0 mergé)](#6-fiabilité-paiement-p0-mergé)
- [7. API serverless (`/api/*`)](#7-api-serverless-api)
- [8. Base de données Supabase](#8-base-de-données-supabase)
- [9. Variables d'environnement](#9-variables-denvironnement)
- [10. Installation & scripts](#10-installation--scripts)
- [11. Déploiement](#11-déploiement)
- [12. Sécurité](#12-sécurité)
- [13. Arborescence](#13-arborescence)
- [14. Contribuer & conventions](#14-contribuer--conventions)
- [15. Documentation complémentaire](#15-documentation-complémentaire)

---

## 1. Aperçu produit

Restafy est une **super-app** multi-rôle qui couvre tout le cycle restaurant en un seul produit :

| Rôle | Ce qu'il peut faire |
|------|---------------------|
| **Client** | Parcourir les restaurants, commander (livraison / sur place / à emporter), payer via Mobile Money, suivre sa commande, cumuler des points fidélité, acheter un billet d'événement, consulter ses billets. |
| **Restaurateur** | Gérer son menu, ses catégories et photos, recevoir et faire avancer les commandes, lancer des événements et vendre des billets, gérer son équipe, suivre ses statistiques, encaisser via Mobile Money, demander un payout. |
| **Équipe (staff)** | Scanner les billets QR à l'entrée d'un événement via `scan.restafy.shop/scanner` ou `/validator` (mode hors-ligne pris en charge) ; et depuis `/team`, se connecter sans compte Supabase via un **lien + code PIN** pour voir les commandes cuisine en temps réel (poll 3s), faire avancer les statuts, annuler si manager. |
| **Super admin Restafy** | Vue globale restaurants / utilisateurs / finances, campagnes email, monitoring, validation des demandes partenaires. |

**Modèle économique** : Restafy prend **0 % de commission** sur les ventes restaurant ; les revenus viennent des plans (Gratuit / Starter / Pro) et des options (livraison, événements premium, IA d'import menu).

---

## 2. Surfaces & URLs

| Surface | URL prod | Rôle |
|---------|----------|------|
| **Landing** | `https://restafy.shop` | Vitrine marketing (HTML statique sous `landing/`) |
| **App principale** | `https://app.restafy.shop` | Client + restaurant + super admin (SPA React sous `src/`) |
| **Scan billets (événements)** | `https://scan.restafy.shop` | PWA offline-first pour scanner les QR codes des billets à l'entrée d'un événement (`/scanner`, `/validator`). Inclut aussi `/team` pour l'accès staff aux commandes en cuisine. Source sous `qr_scanner_offline/`. |
| **Widget iframe** | `https://app.restafy.shop/widget/…` | Intégration externe du menu / commande |

Les 3 apps partagent Supabase (même projet) et l'API serverless `app.restafy.shop/api/*`. Le scanner offline appelle explicitement `https://app.restafy.shop/api/team-scan` (staff orders) et `https://app.restafy.shop/api/tickets/*` (validation billet) en cross-origin — CORS ouvert aux sous-domaines `*.restafy.shop`.

---

## 3. Stack technique

| Couche | Choix |
|--------|-------|
| **UI** | React 19, TypeScript, Vite 6 |
| **Routing** | React Router 7 |
| **Styles** | Tailwind CSS 4 |
| **State / cache** | TanStack Query 5, Zustand 5 |
| **Formulaires** | react-hook-form, Zod |
| **Animations / UX** | Framer Motion, Sonner, Lucide, Recharts |
| **Backend BaaS** | Supabase (Auth, Postgres + RLS, Storage, Edge Functions) |
| **API serverless** | Vercel Node (`api/*.ts`) |
| **Paiements** | Genius Pay (MTN, Moov, Celtiis) + webhook signé HMAC-SHA256 |
| **QR / scan** | `html5-qrcode`, `qrcode` |
| **Analytics** | `@vercel/analytics`, `@vercel/speed-insights` |
| **PWA** | Service worker via le scanner offline (cache + IndexedDB) |
| **Tests** | Vitest + Testing Library |

Packaging : **pnpm 9** (verrouillé via `packageManager`). Les déploiements Vercel exécutent `pnpm install --no-frozen-lockfile` puis `pnpm run build`.

---

## 4. Architecture

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│   restafy.shop (vitrine)     │     │   scan.restafy.shop (PWA)    │
│   landing/*.html (statique)  │     │   qr_scanner_offline/client  │
└──────────────┬───────────────┘     └──────────────┬───────────────┘
               │                                    │
               │                                    │ POST /api/team-scan
               ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      app.restafy.shop (SPA)                         │
│                     Vite + React 19 (src/)                          │
│                                                                     │
│   Routing ────► pages/* (client, admin, superadmin, staff)          │
│   Auth    ────► @supabase/supabase-js (lib/supabase.ts)             │
│   State   ────► Zustand + TanStack Query                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ fetch('/api/...')
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Vercel Serverless (api/*.ts)                           │
│  /payments/initiate ─► Genius Pay POST + idempotency + attempts     │
│  /payments/status  ─► polling + SANDBOX auto-confirm                │
│  /webhooks         ─► HMAC vérifié + dédup + RPC confirm_payment    │
│  /team-scan        ─► auth token+PIN, orders, update-order-status   │
│  /orders/create    ─► création commande + RLS bypass contrôlé       │
│  /ticket-orders    ─► création billet événement                     │
│  /cron             ─► cleanup, reminders, reconcile_payments        │
│  /auth             ─► register-confirmed, confirm-restaurant        │
│  /send-email       ─► Resend / Brevo                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            Supabase                                 │
│  Postgres : orders, ticket_purchases, payments, payment_attempts,   │
│             webhook_events, webhook_logs, team_scan_tokens,         │
│             restaurants, profiles, menu_items, reservations, …      │
│  RLS      : par `auth.uid()` (client) et `restaurant_staff` (resto) │
│  RPC      : confirm_payment(…) — atomic, idempotent                 │
│  Storage  : bucket menus, photos, logos, event_images               │
│  Edge Fn  : gemini-menu-import (IA import menu photo)               │
└─────────────────────────────────────────────────────────────────────┘
```

**Principes structurants** :

1. **Un seul projet Supabase pour les 3 apps** — cookies partagés sur `.restafy.shop`, cf. `CROSS_SUBDOMAIN_AUTH.md`.
2. **RLS activée sur toutes les tables métier** ; la clé `service_role` n'existe que côté Vercel (jamais dans le client).
3. **Paiements atomiques via RPC** : la confirmation est une transaction unique côté Postgres (voir §6), pas une série d'UPDATE côté Node.
4. **Idempotency de bout en bout** : header `Idempotency-Key` client → table `payment_attempts` serveur → dédup `webhook_events` → RPC `confirm_payment` guard par `status <> 'confirmed'`.
5. **Graceful degradation** : si la migration 094/095 n'est pas encore appliquée, le code retombe sur les anciens chemins sans crash.

---

## 5. Flux métier principaux

### 5.1 Commande client → paiement → cuisine

```
1. Client navigue /r/:slug → ajoute des plats au panier (Zustand)
2. /cart → "Payer" → POST /api/orders/create (crée orders + order_items)
3. /cart → POST /api/payments/initiate
   ├── Headers: Idempotency-Key: <UUID>
   ├── Enregistrement payment_attempts(status=pending)
   ├── Appel Genius Pay POST /payments (pas de withRetry — non idempotent)
   └── Retour: { checkout_url, reference: 'SANDBOX_xxx' ou 'GP_xxx' }
4. Redirection vers Genius Pay → client paie (MTN / Moov / Celtiis)
5a. Succès prod → webhook signé HMAC → /api/webhooks?type=payment
    ├── Vérif signature + replay window 5min
    ├── Dédup par X-Webhook-Id (webhook_events)
    └── RPC confirm_payment() — atomique
5b. Succès sandbox → redirect direct (pas de webhook) → /payment/success
    ├── Polling 10 × 3s de /api/payments/status
    ├── lookupLocalStatus() — retourne pending si l'order existe et appartient au user
    └── Fallback SANDBOX_* → RPC confirm_payment() côté API de status
6. UI affiche "Paiement réussi 🎉 Votre commande est confirmée."
7. Cuisine voit la commande dans le dashboard restaurant (status='confirmed')
   et peut la faire avancer via StaffKiosk ou scan.restafy.shop
```

Côté data, ce flux touche : `orders`, `order_items`, `payments`, `payment_attempts`, `webhook_events`, `webhook_logs`, `notifications`.

### 5.2 Billetterie événement

Même squelette que 5.1 mais via `POST /api/ticket-orders/create` → `ticket_purchases`. Une fois payé, un **QR code** est généré pour le billet et validé à l'entrée via `/restaurant/scanner` ou `scan.restafy.shop/ticket`. La branche `events/:id/checkout` supporte l'iframing (headers CSP permissifs).

### 5.3 Scan billets événement + Scan équipe (token + PIN)

`scan.restafy.shop` est une **PWA offline-first** pensée d'abord pour que l'équipe scanne les **QR codes des billets à l'entrée d'un événement** (validation ticket en 2s) ; une seconde vue permet au staff de suivre les commandes en cuisine. Un seul domaine, trois routes utiles :

| Route | Page | Rôle |
|-------|------|------|
| `/scanner` | `pages/Scanner.tsx` | Scanner QR de billet avec `html5-qrcode`, compteur live de billets scannés vs émis, **fonctionne hors-ligne** (service worker + `IndexedDB`, `useOfflineSync` pousse au retour du réseau). |
| `/validator` | `pages/TicketValidator.tsx` | Validation billet avec caméra **ou** code manuel. Affiche nom de l'événement, type de billet, statut (`valid` / `used` / `invalid` / `expired`) et historique. |
| `/team` | `pages/TeamScanner.tsx` | Liste des commandes en cuisine en temps réel (poll 3s) + avancée des statuts. |

**Primary use case — validation billetterie à l'entrée d'un événement** :

1. Le restaurateur a vendu des billets via la billetterie (section 5.2) → chaque billet a un QR code unique côté client.
2. L'équipe ouvre `scan.restafy.shop/scanner` (ou `/validator`) avec un token d'accès, pointe la caméra sur le QR du billet.
3. L'app valide le billet contre `api.restafy.shop/api/tickets/*` : ticket émis, non encore utilisé, événement en cours → passage autorisé, badge vert, billet marqué `used` côté DB.
4. Hors-ligne : scans sauvegardés localement en IndexedDB, sync automatique au retour du réseau (dédoublonnés côté serveur).

**Secondary flow — Scan équipe (token + PIN) pour le staff cuisine / service** :

_Admin_ (app.restafy.shop → `pages/admin/RestaurantTeamScan.tsx`) :

1. Restaurateur va dans *Paramètres → Équipe → Scan équipe*
2. Saisit un nom + rôle (staff/chef/manager/owner)
3. Le front génère un token (24 chars) + PIN (4 chiffres) aléatoires
4. Insert RLS-gated dans `team_scan_tokens` (propriétaire du restaurant uniquement)
5. Affiche l'URL `https://scan.restafy.shop/team?token=XXX` + le PIN + un QR code

_Staff_ (scan.restafy.shop/team → `qr_scanner_offline/client/src/pages/TeamScanner.tsx`) :

1. Ouvre l'URL partagée → voit un écran "Code PIN"
2. Saisit le PIN → `POST /api/team-scan?action=auth`
3. Serveur vérifie : token existe, `is_active=true`, non expiré, PIN correct → met à jour `usage_count` et `last_used_at`
4. Session stockée dans `sessionStorage` (clear au refresh navigateur)
5. Poll auto-refresh toutes les **3 secondes** via `POST /api/team-scan?action=orders`
6. Mise à jour de statut via `POST /api/team-scan?action=update-order-status` (transition respecte `NEXT_STATUS`)

Statuts gérés : `pending → confirmed → preparing → ready → delivering → delivered` (+ `cancelled` réservé aux rôles manager/owner/admin/chef).

### 5.4 Fidélité, parrainage, récompenses

- **Points fidélité** : accumulés à chaque commande payée, consultables sur `/loyalty` (source : `pages/LoyaltyDashboard.tsx`).
- **Parrainage** : code partageable (`/referral`), crédit appliqué à la première commande du filleul.
- **Catalogue de récompenses** : `/rewards` — échange de points contre plats offerts ou bons.
- **Leaderboard** : `/leaderboard` — gamification des clients.

Tables concernées : `loyalty_points`, `loyalty_events`, `referrals`, `rewards_catalog`, `reward_redemptions`.

---

## 6. Fiabilité paiement (P0 mergé)

Version actuelle en prod : post-merge des PRs [#14](https://github.com/Souraka229/restafy-prod/pull/14), [#15](https://github.com/Souraka229/restafy-prod/pull/15), [#16](https://github.com/Souraka229/restafy-prod/pull/16), [#18](https://github.com/Souraka229/restafy-prod/pull/18).

### 6.1 Ce qui a été corrigé

| Bug | Impact | Fix |
|-----|--------|-----|
| Double-clic "Payer" → deux orders + deux débits | Perte client, facturation en double | `Idempotency-Key` header client + table `payment_attempts` serveur : même clé = même réponse en cache |
| 5 UPDATE non transactionnels dans le webhook | Incohérence si crash au milieu (commande confirmée, notif non envoyée, etc.) | RPC `confirm_payment(...)` en une seule transaction PLpgSQL |
| Webhook livré 2× → double confirmation | Risque double-débit, notifs en double | Table `webhook_events` (PK `webhook_id`) dédup en amont |
| Client ferme l'onglet avant polling → commande bloquée "pending" | Support tickets | Cron `/api/cron?job=reconcile_payments` (daily 02:30 UTC sur plan Hobby) |
| "Problème de confirmation" en sandbox | Tests bloqués, peur de la prod | Fix `lookupLocalStatus` : `payment_ref` retiré du SELECT (schema cache PostgREST), fallback id-only avec vérif d'ownership |
| Status `payment_failed` absent de l'ENUM | Mappé en `cancelled`, reporting faux | Migration 094 ajoute la valeur à l'ENUM `order_status` |

### 6.2 Flux de confirmation atomique

```sql
-- Extrait de scripts/094-payment-reliability-p0.sql
CREATE FUNCTION public.confirm_payment(
  p_reference           TEXT,
  p_transaction_id      TEXT DEFAULT NULL,
  p_provider            TEXT DEFAULT 'geniuspay',
  p_provider_response   JSONB DEFAULT '{}'::jsonb,
  p_payment_method      TEXT DEFAULT NULL,
  p_skip_payments_upsert BOOLEAN DEFAULT FALSE   -- ajouté par 095
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
  -- 1. Mise à jour conditionnelle orders (guard status <> 'confirmed')
  -- 2. Mise à jour conditionnelle ticket_purchases (idem)
  -- 3. Upsert payments (sauf si skip_payments_upsert)
  -- 4. Création notifications (type=order_status OU ticket_confirmed)
  -- Le tout dans une seule transaction implicite.
$$;
```

### 6.3 Actions manuelles restantes sur Supabase

Les PRs ont **toutes été mergées** mais les migrations SQL doivent être appliquées manuellement sur le projet Supabase prod :

1. **SQL Editor → exécuter** `scripts/094-payment-reliability-p0.sql` (idempotent)
2. **SQL Editor → exécuter** `scripts/095-payment-reliability-p0-fixes.sql` (idempotent)
3. **Settings → API → "Reload schema cache"** (ou `NOTIFY pgrst, 'reload schema';`)

Tant que ces 3 étapes ne sont pas faites, **le code tombe sur les anciens chemins** (pas de crash, mais pas de RPC atomique et pas d'update auto `orders.status = 'confirmed'`).

### 6.4 Monitoring & alerting à ajouter (P1)

- Sentry sur `api/*` (webhook_logs est déjà en base mais pas d'alerte)
- Alerte sur `webhook_events.processed = false` > 10 min
- Dashboard Datadog / Metabase sur `payment_attempts.status` pour suivre le taux de succès

---

## 7. API serverless (`/api/*`)

Tous les handlers sont en Node 22 (`@vercel/node`), sous `api/` (Vite + Vercel rewrites).

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/orders/create` | POST | Crée `orders` + `order_items` avec validation RLS contournée côté serveur |
| `/api/ticket-orders/create` | POST | Crée `ticket_purchases` |
| `/api/payments/initiate` | POST | Appel Genius Pay avec idempotency, enregistre `payment_attempts`, retourne `checkout_url` |
| `/api/payments/status` | GET | Polling frontal — interroge Genius Pay + `lookupLocalStatus` + fallback SANDBOX |
| `/api/payments/debug` | GET | Diagnostic (à retirer / restreindre à admin) |
| `/api/webhooks?type=payment` | POST | Webhook Genius Pay : vérif HMAC + dédup + RPC `confirm_payment` |
| `/api/cron?job=cleanup` | GET | Nettoyage réservations et `payment_attempts` expirés (03:00 UTC) |
| `/api/cron?job=reminders` | GET | Rappels réservation (09:00 UTC) |
| `/api/cron?job=reconcile_payments` | GET | Réconcilie les `payment_attempts` pending avec Genius Pay (02:30 UTC) |
| `/api/team-scan?action=auth` | POST | Valide token + PIN, renvoie session staff |
| `/api/team-scan?action=orders` | POST | Liste les 100 dernières commandes du restaurant |
| `/api/team-scan?action=update-order-status` | POST | Transition de statut (respecte `NEXT_STATUS`) |
| `/api/auth/register-confirmed` | POST | Crée un compte avec e-mail pré-confirmé (évite la dépendance aux Edge Functions) |
| `/api/auth/confirm-restaurant-signup` | POST | Finalise un compte restaurateur sans session |
| `/api/partner-join-request` | POST | Réception du formulaire "Rejoindre Restafy" (vitrine) |
| `/api/restaurant/payout-request` | POST | Demande de payout restaurateur |
| `/api/payouts/initiate` | POST | Déclenchement payout (super admin) |
| `/api/send-email` | POST | Envoi transactionnel (Resend) |

**Rewrites Vercel** (cf. `vercel.json`) — quelques routes "physiques" sont alias par `?action=` pour tenir sous la limite de 12 functions du plan Hobby :

```
/api/webhooks/geniuspay  →  /api/webhooks?type=payment
/api/payments/status     →  /api/payments/initiate
/api/account/balance     →  /api/payments/initiate?action=balance
/api/pawapay/providers   →  /api/payments/initiate?action=pawapay_providers
```

**CORS** : `api/team-scan.ts` autorise `*.restafy.shop`, `localhost`, `*.vercel.app`. Autres endpoints restreignent par défaut à même origin + vérification manuelle quand nécessaire.

**Idempotency** : `/api/payments/initiate` refuse un deuxième appel avec même `Idempotency-Key` et renvoie la réponse cachée (clé persistée 14 jours dans `payment_attempts`).

---

## 8. Base de données Supabase

Schéma versionné dans `scripts/` (numérotation chronologique indicative `001-xxx.sql` → `095-xxx.sql`) + `supabase/migrations/` pour quelques scripts récents. À chaque nouvelle migration : **appliquer via SQL Editor** + **Reload schema cache**.

### 8.1 Tables principales

| Domaine | Tables |
|---------|--------|
| Identités | `profiles`, `restaurants`, `restaurant_staff`, `team_scan_tokens` |
| Menu | `menu_categories`, `menu_items`, `menu_item_options`, `menu_item_modifiers` |
| Commandes | `orders`, `order_items`, `notifications` |
| Paiements | `payments`, `payment_attempts`, `webhook_events`, `webhook_logs` |
| Événements | `events`, `ticket_types`, `ticket_purchases`, `ticket_validations` |
| Fidélité | `loyalty_points`, `loyalty_events`, `referrals`, `rewards_catalog`, `reward_redemptions` |
| Réservations | `reservations` |
| Livraison | `livreurs`, `deliveries` |
| Super admin | `partner_join_requests`, `restaurant_invites`, `email_campaigns` |

Types ENUM principaux : `order_status` (`pending | accepted | confirmed | preparing | ready | delivering | delivered | cancelled | payment_failed`), `payment_status` (`pending | paid | failed | refunded`), `payment_method` (`USSD_MTN | USSD_MOOV | USSD_CELTIIS | CASH`), `notif_type`, `order_mode`.

### 8.2 Migrations importantes à connaître

- `scripts/01-create-schema.sql` — schéma initial
- `scripts/054-fix-all-rls-final.sql` — pierre angulaire RLS (doit être en place avant les migrations > 060)
- `scripts/072-staff-kiosk-access.sql` — premier mécanisme kiosk staff
- `scripts/082-handle-new-user-safe-role.sql` — trigger inscription robuste
- `scripts/088-add-payment-ref-column.sql` — colonne `payment_ref` (source de la douleur PostgREST)
- `scripts/094-payment-reliability-p0.sql` — **P0 fiabilité paiement** (RPC atomique + webhook_events + payment_attempts)
- `scripts/095-payment-reliability-p0-fixes.sql` — correctifs de review PR #15
- `supabase/migrations/create_team_scan_tokens.sql` — restaScan

Consultez `DATABASE_SCHEMA.md` pour une vue d'ensemble prose-friendly, et `USERS_AND_ROLES.md` pour la matrice RLS.

---

## 9. Variables d'environnement

### 9.1 Front (SPA)

Toutes préfixées `VITE_*` (exposées dans le bundle client) :

| Variable | Obligatoire | Rôle |
|----------|-------------|------|
| `VITE_SUPABASE_URL` | ✅ | URL projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Clé anonyme (safe côté client car RLS) |
| `VITE_RESTAFY_APP_URL` | ⚙️ | URL de l'app (utilisé par scan.restafy.shop pour cross-origin) |
| `VITE_MAPBOX_TOKEN` | ⚙️ | Carte livraison si activée |
| `VITE_GENIUSPAY_SANDBOX` | ⚙️ | `true` force le mode sandbox |

Voir `.env.example` pour la liste exhaustive.

### 9.2 API serverless (Vercel)

Jamais préfixées `VITE_*` — configurées via **Vercel → Project → Settings → Environment Variables** :

| Variable | Rôle |
|----------|------|
| `SUPABASE_URL` | URL projet (accepte aussi `VITE_SUPABASE_URL` en fallback) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — clé admin Postgres, jamais côté client |
| `GENIUSPAY_API_KEY` | Clé API Genius Pay |
| `GENIUSPAY_WEBHOOK_SECRET` | Secret HMAC pour vérifier les webhooks |
| `GENIUSPAY_BASE_URL` | Ex. `https://api.genius.ci/v1` (ou sandbox) |
| `CRON_SECRET` | Bearer token pour autoriser `/api/cron` (Vercel le passe automatiquement) |
| `RESEND_API_KEY` | Envoi transactionnel |
| `BREVO_API_KEY` | Optionnel — alternative Resend |

### 9.3 Edge Functions Supabase

```bash
supabase secrets set GEMINI_API_KEY=...        # pour gemini-menu-import
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 10. Installation & scripts

### 10.1 Prérequis

- Node.js **22 LTS** recommandé (supporte Vercel Node runtime)
- `pnpm` 9.x (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- Accès à un projet Supabase (URL + anon key)

### 10.2 Démarrage local

```bash
git clone https://github.com/Souraka229/restafy-prod.git
cd restafy-prod

pnpm install
cp .env.example .env       # renseigner VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

pnpm run dev               # http://localhost:3000
```

Pour tester l'API serverless localement, utiliser **`vercel dev`** (pas `pnpm run dev`, qui ne monte pas `api/`).

### 10.3 Scripts NPM

| Commande | Effet |
|----------|-------|
| `pnpm run dev` | Vite dev server, port 3000 |
| `pnpm run build` | Build production → `public/` |
| `pnpm run build:analyze` | Build + rapport rollup-plugin-visualizer |
| `pnpm run preview` | Preview du build local |
| `pnpm run lint` | `tsc --noEmit` (typecheck strict) |
| `pnpm run healthcheck` | `lint` + `build` (CI locale) |
| `pnpm run test` | Vitest (watch) |
| `pnpm run test:run` | Vitest (one-shot, CI) |
| `pnpm run test:ui` | UI Vitest |
| `pnpm run clean` | Supprime `dist/`, `public/`, `node_modules/` |

---

## 11. Déploiement

### 11.1 Vercel (frontend + API)

- `installCommand`: `pnpm install --no-frozen-lockfile`
- `buildCommand`: `pnpm run build`
- `outputDirectory`: `public`
- 3 crons configurés dans `vercel.json` (cleanup, reminders, reconcile_payments)
- Rewrites : `/api/*` → handlers, tout le reste → `index.html` (SPA)

### 11.2 Scan offline (scan.restafy.shop)

Déploiement séparé depuis `qr_scanner_offline/` (voir `qr_scanner_offline/vercel.json`). Même repo GitHub, projet Vercel distinct. Variable clé : `VITE_RESTAFY_APP_URL=https://app.restafy.shop`.

### 11.3 Landing (restafy.shop)

HTML statique sous `landing/` + assets. Peut être servi par Vercel comme projet distinct ou via CNAME sur un bucket.

### 11.4 Déploiement bloqué "commit author" (plan Hobby)

Sur le plan Hobby, seuls les commits dont l'e-mail Git correspond au propriétaire du projet Vercel déclenchent un build. Si besoin : `git config user.email <owner-email>` avant push, ou passer en plan **Pro** pour une vraie équipe.

---

## 12. Sécurité

### 12.1 En place

- **RLS activée** sur toutes les tables (sauf `restaurants` publique en lecture)
- **`service_role` uniquement côté Vercel** — jamais dans le bundle client
- **Webhook HMAC-SHA256** avec `timingSafeEqual` + replay window 5 min
- **Cross-subdomain auth** via cookies `domain=.restafy.shop`, `httpOnly`, `sameSite=none`, `secure=true` (cf. `CROSS_SUBDOMAIN_AUTH.md`)
- **CORS strict** : `app.restafy.shop`, `scan.restafy.shop`, `*.vercel.app` en preview, `localhost` en dev
- **Headers sécurité** via `vercel.json` : `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`
- **Idempotency** paiement pour éviter double-débit
- **PIN token équipe** = 4 chiffres + token 24 chars aléatoires + expiration 6 mois

### 12.2 À durcir (suivi dans `RESTAFY_AUDIT.md` §4)

- **Rate-limit** sur `/api/team-scan?action=auth` (PIN 4 chiffres brute-forçable en < 1 min sans limite)
- **Hash du PIN** côté DB (`team_scan_tokens.pin` stocké en clair aujourd'hui)
- **Sentry / alerting** sur les endpoints critiques
- **Audit log** des actions super admin
- **Export périodique RGPD** du `profiles` (à la demande)

---

## 13. Arborescence

```
restafy-prod/
├── api/                       # Vercel Serverless handlers (Node 22)
│   ├── _shared/               # Utilitaires partagés (withRetry, etc.)
│   ├── auth/                  # /api/auth/register-confirmed, confirm-restaurant
│   ├── cron/                  # /api/cron?job=cleanup|reminders|reconcile_payments
│   ├── orders/                # /api/orders/create
│   ├── payments/              # /api/payments/initiate + /status (rewrite)
│   ├── payouts/               # /api/payouts/initiate
│   ├── restaurant/            # /api/restaurant/payout-request
│   ├── ticket-orders/         # /api/ticket-orders/create
│   ├── webhooks/              # /api/webhooks?type=payment (GeniusPay)
│   ├── team-scan.ts           # /api/team-scan?action=...
│   ├── send-email.ts
│   └── partner-join-request.ts
├── src/                       # SPA app.restafy.shop
│   ├── App.tsx                # Routes React Router
│   ├── pages/
│   │   ├── Home.tsx, Cart.tsx, Orders.tsx, PaymentSuccess.tsx, …
│   │   ├── admin/             # Dashboard restaurateur, TeamScan, POS, etc.
│   │   ├── staff/             # StaffKiosk (legacy)
│   │   ├── superadmin/        # Dashboard Restafy global
│   │   ├── integrations/      # Loyalty, USSD
│   │   └── auth/              # Login, confirm email
│   ├── components/            # UI, events, loyalty, notifications, payment, superadmin, ui
│   ├── hooks/                 # useAuth, useGeniusPay, useCart, …
│   ├── lib/                   # supabase, email, payments, …
│   ├── store/                 # Zustand (auth, cart, kiosk)
│   └── context/               # ThemeProvider
├── qr_scanner_offline/        # PWA scan.restafy.shop (projet Vercel séparé)
│   ├── client/                # React (TeamScanner, TicketValidator, Scanner)
│   └── server/                # Auth helpers (non utilisés côté prod)
├── landing/                   # Site vitrine restafy.shop (HTML statique)
├── scripts/                   # SQL Supabase (001-xxx → 095-xxx)
├── supabase/
│   ├── functions/             # Edge Functions (ex. gemini-menu-import)
│   └── migrations/            # Migrations récentes (format `name.sql`)
├── app/                       # ARCHIVE : routes style Next.js, NON déployées
├── vercel.json                # Rewrites, headers, crons
├── vite.config.ts
├── tsconfig.json              # + api/tsconfig.json (dédié au runtime Node)
├── package.json               # pnpm 9.15.4
└── README.md                  # ce fichier
```

Le dossier **`app/`** est conservé pour référence historique (syntaxe Next.js App Router) — il n'est **pas** déployé. Les routes réelles sont sous `api/`.

---

## 14. Contribuer & conventions

### 14.1 Workflow

1. Créer une branche `devin/$(date +%s)-slug-descriptif` ou `feat/…`, `fix/…`
2. Développer + lancer `pnpm run healthcheck` (lint + build)
3. Ouvrir une PR vers `main` — la CI Vercel vérifie le build automatiquement
4. Review + merge (jamais de force-push sur `main`)

### 14.2 Conventions

- **Commits** : messages en français ou anglais, pas de préfixe obligatoire
- **Branches** : pas de push direct sur `main`
- **Types** : `any` interdit en code nouveau (sauf `_debug` temporaire)
- **Tests** : Vitest pour la logique critique (idempotency, webhook, RPC)
- **Tailwind** : utiliser les tokens existants (couleurs orange/slate), pas de `style=` inline
- **Supabase** : toujours via `createClient` de `src/lib/supabase.ts` côté front, jamais directement `@supabase/supabase-js`

### 14.3 Revue des PRs

- CI Vercel verte obligatoire avant merge
- Review code automatique (Devin / linter) — corriger les findings 🔴 et 🟡 avant merge
- Tester en preview URL avant de merger les changements visibles

---

## 15. Documentation complémentaire

| Doc | Sujet |
|-----|-------|
| [`RESTAFY_AUDIT.md`](./RESTAFY_AUDIT.md) | Audit technique complet : bugs, architecture cible, plan P0/P1/P2 |
| [`CROSS_SUBDOMAIN_AUTH.md`](./CROSS_SUBDOMAIN_AUTH.md) | Cookies partagés app/scan, offline, IndexedDB |
| [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) | Schéma tables + SQL de référence |
| [`USERS_AND_ROLES.md`](./USERS_AND_ROLES.md) | Matrice RLS + rôles |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Steps déploiement Vercel + Supabase |
| [`GENIUSPAY_API_CONFORMANCE_REPORT.md`](./GENIUSPAY_API_CONFORMANCE_REPORT.md) | Audit conformité API Genius Pay |
| [`FLUX_INVITATION_RESTAURANT.md`](./FLUX_INVITATION_RESTAURANT.md) | Onboarding restaurateur |
| [`docs/MARKETING_COMMUNICATION.md`](./docs/MARKETING_COMMUNICATION.md) | Ton de marque, canaux, checklists comm |
| [`LOYALTY_README.md`](./LOYALTY_README.md) | Programme fidélité — index |

---

## Licence & support

Projet **propriétaire** — tous droits réservés.
Support : contacter l'équipe Restafy via https://restafy.shop/#rejoindre

---

**Restafy** — *Ne mangez pas. Savourez.* · Fait avec soin à Cotonou, Bénin.
