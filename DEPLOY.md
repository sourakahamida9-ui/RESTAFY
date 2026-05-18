# 🚀 RESTAFY — Guide de déploiement

## Ce qui a été ajouté / corrigé

### ✅ Bugs corrigés
- Routes `/fidelite`, `/mes-billets`, `/orders` → maintenant fonctionnelles
- `useUserStore` → ajout de `hasOnboarded` persisté (Zustand persist)
- Onboarding → redirige vers le bon dashboard selon le rôle
- Import `framer-motion` unifié (certains fichiers utilisaient `motion/react`, d'autres `framer-motion`)

### ✅ Nouvelles pages
- `/orders` → Mes Commandes avec statuts temps réel
- `/notifications` → Centre de notifications complet
- `/superadmin` → Super Admin (6 sous-pages)

### ✅ Super Admin (`/superadmin`)
- Dashboard global avec KPIs temps réel
- Gestion restaurants (approbation, suspension)
- Gestion utilisateurs (blocage, points)
- Finances (GMV, commissions, répartition USSD)
- IA & Data Center (export dataset JSONL)
- Monitoring (latence live, état services)

### ✅ Notifications
- Store Zustand persisté avec 4 types
- Page `/notifications` avec mark-as-read
- Badge compteur dans le header
- Push browser (si permission accordée)

### ✅ PWA
- `manifest.json` avec shortcuts
- `sw.js` Service Worker basique
- `index.html` avec meta PWA

---

## Installation

```bash
npm install
npm run dev
```

## Variables d'environnement

Créer `.env` à la racine (voir aussi [`.env.example`](./.env.example)) :

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Gemini (import menu photo)** : ne pas mettre la clé Google en `VITE_*` — le front n’appelle pas Google. Déployer la fonction `gemini-menu-import` et : `supabase secrets set GEMINI_API_KEY=…`.

**Vercel (routes `/api/auth/*`, cron)** : en plus des variables ci-dessus, ajouter **`SUPABASE_SERVICE_ROLE_KEY`** et **`SUPABASE_URL`** (même valeur que `VITE_SUPABASE_URL`). Sans elles, inscription / confirmation renvoient des **500**.

## Structure des accès

| URL | Rôle |
|-----|------|
| `/` | Client (après onboarding) |
| `/admin` | Restaurant owner |
| `/pos` | Caissier |
| `/superadmin` | Super administrateur |

## GitHub Push

```bash
cd Restafy-main
git init
git add .
git commit -m "feat: add superadmin, notifications, PWA, fix all routes"
git remote add origin https://github.com/TON_USER/restafy.git
git push -u origin main
```

## Déploiement Vercel

```bash
npm i -g vercel
vercel --prod
```
