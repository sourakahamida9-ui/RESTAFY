# PROMPT POUR CLAUDE - RESTAFY SUPER APP

## INSTRUCTIONS

Tu es un expert fullstack React/TypeScript/Supabase. Je te donne le ZIP complet de mon projet "Restafy" - une application de livraison de nourriture pour le Benin (Afrique de l'Ouest).

**Ta mission:** Analyser tout le code, identifier et corriger TOUS les bugs, problemes de securite, et problemes de performance. Le projet doit etre 100% fonctionnel sans aucune erreur.

---

## STACK TECHNIQUE

- **Frontend:** React 19 + TypeScript + Vite 6 + TailwindCSS 4
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions + Realtime)
- **State:** Zustand + React Query
- **UI:** Lucide icons, Framer Motion, Recharts, Sonner (toasts)
- **Routing:** React Router DOM v7

---

## VARIABLES D'ENVIRONNEMENT REQUISES

```env
VITE_SUPABASE_URL=https://qvumzfcabeaognkcjyng.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_APP_URL=https://restafy.shop
```

---

## BASE DE DONNEES - 43 TABLES

### Tables principales:
- `profiles` - Utilisateurs (customer, restaurant_owner, super_admin)
- `restaurants` - Restaurants avec owner_id, slug, settings
- `categories` - Categories de menu par restaurant
- `items` - Plats avec prix, description, image
- `item_variants` - Variantes de plats (taille, options)
- `orders` - Commandes avec status workflow
- `order_items` - Items dans une commande
- `payments` - Paiements (mobile money, cash)
- `reviews` - Avis clients
- `events` - Evenements organises par restaurants
- `event_tickets` - Types de billets pour evenements
- `ticket_purchases` - Achats de billets avec QR code
- `loyalty_accounts` - Comptes fidelite clients
- `loyalty_transactions` - Historique points fidelite
- `rewards` - Recompenses echangeables
- `promo_codes` - Codes promo
- `delivery_drivers` - Livreurs par restaurant
- `deliveries` - Suivi des livraisons
- `livreurs` - Autre table livreurs (legacy)
- `restaurant_staff` - Personnel restaurant
- `shifts` - Planning equipes
- `table_reservations` - Reservations de table
- `notifications` - Notifications in-app
- `push_tokens` - Tokens pour push notifications
- `email_logs` - Logs emails envoyes
- `email_campaigns` - Campagnes email marketing
- `email_contacts` - Contacts email
- `email_campaign_sends` - Envois de campagnes
- `restaurant_invites` - Invitations pour nouveaux restaurants
- `menu_templates` - Templates de menu
- `menu_imports` - Imports de menu
- `menu_snapshots` - Sauvegardes de menu
- `system_settings` - Configuration systeme
- `app_features` - Features toggles
- `order_modes` - Modes de commande (delivery, dine_in, takeaway)
- `payment_methods` - Methodes de paiement
- `notification_templates` - Templates notifications
- `analytics_events` - Events analytics
- `ai_data_logs` - Logs IA
- `weekly_report_configs` - Config rapports hebdo
- `ussd_template_history` - Historique templates USSD

---

## PROBLEMES CONNUS A CORRIGER

### 1. SECURITE - RLS MANQUANTES
Ces tables n'ont PAS de politiques RLS (Row Level Security):
- `ai_data_logs` (0 policies)
- `analytics_events` (RLS disabled)
- `deliveries` (0 policies)
- `item_variants` (0 policies)
- `loyalty_transactions` (0 policies)
- `payments` (0 policies)
- `push_tokens` (RLS disabled)
- `rewards` (0 policies)
- `shifts` (0 policies)
- `ussd_template_history` (RLS disabled)

**Action:** Creer des politiques RLS appropriees pour chaque table.

### 2. TYPESCRIPT - TYPE `any` EXCESSIF
Le code utilise `any` dans 45+ fichiers. Remplacer par des types stricts.

### 3. ERREURS SILENCIEUSES
Beaucoup de `catch (e) { }` vides ou avec juste `console.error`. Ajouter une gestion d'erreur utilisateur avec des toasts.

### 4. URLS HARDCODEES
Remplacer toutes les occurrences de:
- `restafy.app` -> `restafy.shop`
- `v0-restafy.vercel.app` -> `restafy.shop`
- Emails: utiliser `@restafy.shop` (noreply@, support@, contact@)

### 5. DEPENDENCIES MAL PLACEES
Dans `package.json`, ces packages doivent etre dans `devDependencies`:
- `@tailwindcss/vite`
- `@vitejs/plugin-react`

### 6. PERFORMANCE
- Ajouter `React.memo()` sur les composants de liste (RestaurantCard, OrderCard, etc.)
- Utiliser `useMemo` et `useCallback` ou necessaire
- Eviter les SELECT * dans les requetes Supabase

### 7. FONCTIONNALITES MANQUANTES
- Page restaurant premium pour `/@slug` (restafy.shop/@nomdurestaurant)
- Export CSV des participants aux evenements
- Scan QR code pour validation billets
- Attribution livreur aux commandes

---

## STRUCTURE DU PROJET

```
src/
├── App.tsx                 # Router principal
├── Layout.tsx              # Layout avec navigation
├── index.css               # Styles TailwindCSS
├── main.tsx               # Entry point
├── components/
│   ├── admin/             # Composants dashboard admin
│   ├── ui/                # Composants UI reutilisables
│   └── ...
├── hooks/
│   ├── useAuth.ts         # Hook authentification
│   ├── useCart.ts         # Hook panier
│   └── ...
├── lib/
│   ├── supabase.ts        # Client Supabase
│   ├── appUrl.ts          # URLs de l'app
│   └── ...
├── pages/
│   ├── Home.tsx           # Page accueil
│   ├── RestaurantDetail.tsx # Page restaurant /@slug
│   ├── admin/             # Pages dashboard restaurant
│   ├── superadmin/        # Pages super admin
│   ├── auth/              # Pages authentification
│   └── ...
├── store/
│   └── useCartStore.ts    # Store Zustand panier
└── types/
    └── index.ts           # Types TypeScript
```

---

## ROLES UTILISATEURS

1. **customer** - Client qui commande
2. **restaurant_owner** - Proprietaire de restaurant
3. **super_admin** - Admin de la plateforme Restafy

---

## WORKFLOW COMMANDE

```
pending -> confirmed -> preparing -> ready -> delivering -> delivered
                                                        \-> cancelled
```

---

## CE QUE TU DOIS FAIRE

1. **Lire tout le code** du ZIP
2. **Identifier tous les bugs** (erreurs TypeScript, logique cassee, etc.)
3. **Corriger les problemes de securite** (RLS, validation inputs)
4. **Optimiser les performances** (memo, indexes SQL)
5. **Corriger toutes les URLs** vers restafy.shop
6. **Tester mentalement** chaque flux utilisateur
7. **Me donner le code corrige** avec explications

---

## FORMAT DE REPONSE ATTENDU

Pour chaque fichier modifie:
```
### Fichier: src/path/to/file.tsx

**Probleme:** Description du bug
**Solution:** Explication de la correction

```tsx
// Code corrige ici
```
```

---

## NOTES IMPORTANTES

- Le projet est pour le BENIN - les prix sont en FCFA
- Les paiements sont principalement Mobile Money (MTN, Moov)
- Les templates USSD sont importants pour les paiements
- Le domaine officiel est **restafy.shop**
- Les emails doivent venir de **@restafy.shop**

---

Merci de faire un travail approfondi et de ne rien laisser passer!
