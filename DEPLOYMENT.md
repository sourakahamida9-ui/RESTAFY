# Restafy - Guide de Déploiement & Configuration

## 📋 Table des matières
1. [Installation & Configuration](#installation--configuration)
2. [Structure du Projet](#structure-du-projet)
3. [Accès Admin](#accès-admin)
4. [Variables d'Environnement](#variables-denvironnement)
5. [Déploiement Vercel](#déploiement-vercel)
6. [SEO & Favicons](#seo--favicons)
7. [PWA Installation](#pwa-installation)

---

## Installation & Configuration

### 1. Cloner le projet
```bash
git clone <repository-url>
cd restafy
```

### 2. Installer les dépendances
```bash
pnpm install
```

### 3. Configurer les variables d'environnement

**Créer un fichier `.env.local` à la racine :**

```bash
cp .env.example .env.local
```

**Remplir les variables Supabase :**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Lancer le serveur de développement
```bash
pnpm dev
```

L'application sera disponible sur `http://localhost:5173`

---

## Structure du Projet

```
restafy/
├── src/
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   ├── ClientSignup.tsx
│   │   │   └── RestaurantSignup.tsx
│   │   ├── admin/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── MenuManagement.tsx
│   │   │   ├── TeamManagement.tsx
│   │   │   └── PromoManager.tsx
│   │   ├── superadmin/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── RestaurantInvites.tsx
│   │   ├── Home.tsx
│   │   ├── Cart.tsx
│   │   ├── Orders.tsx
│   │   └── ...
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── PWAInstallPrompt.tsx
│   │   ├── admin/AdminLayout.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── ...
│   ├── lib/
│   │   └── supabase.ts
│   └── App.tsx
├── public/
│   ├── favicon.svg
│   ├── favicon-32x32.png
│   ├── favicon-16x16.png
│   ├── apple-touch-icon.png
│   ├── og-image.png
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── manifest.json
│   ├── manifest-restaurant.json
│   ├── robots.txt
│   ├── sitemap.xml
│   └── sw.js (Service Worker)
├── scripts/
│   ├── 001-fix-restaurants-table.sql
│   ├── 002-fix-profiles-table.sql
│   └── ... (migrations SQL)
├── .env.example
├── index.html
└── package.json
```

---

## Accès Admin

### Super Admin Dashboard

**URL :** `/superadmin/login`

**Identifiants par défaut :**
```
Email: admin@restafy.com
Mot de passe: admin123
```

> ⚠️ **IMPORTANT** : Changer ces identifiants en production !

**Fonctionnalités du dashboard super admin :**
- 📊 Statistiques globales (GMV, restaurants, utilisateurs)
- 🎫 Génération de liens d'invitation pour restaurants
- 📈 Analytics en temps réel
- 🔧 Gestion de la plateforme

### Restaurant Dashboard

**URL :** `/restaurant/dashboard`

**Accès :** Se connecter avec un compte `restaurant_owner`

**Fonctionnalités :**
- 📋 Gestion des commandes
- 🍽️ Menu et catégories
- 👥 Gestion de l'équipe
- 💰 Gestion des promos
- 📊 Analytics restaurant

---

## Variables d'Environnement

### Obligatoires
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Recommandées
```env
VITE_APP_URL=https://restafy.app
VITE_ENVIRONMENT=production
VITE_ADMIN_EMAIL=admin@restafy.com
VITE_ADMIN_PASSWORD=your-secure-password
```

### Optionnelles
```env
VITE_USSD_MTN_API_KEY=    # Paiement USSD MTN
VITE_USSD_MOOV_API_KEY=   # Paiement USSD Moov
VITE_MAPBOX_TOKEN=        # Géolocalisation
```

---

## Déploiement Vercel

### 1. Connecter le repository GitHub
```bash
git push origin main
```

### 2. Importer le projet dans Vercel
- Aller sur [vercel.com](https://vercel.com)
- Cliquer "New Project"
- Sélectionner le repository GitHub
- Configurer les variables d'environnement

### 3. Configurer les variables sur Vercel
Dans les paramètres du projet :
```
Settings → Environment Variables
```

Ajouter :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_EMAIL`
- `VITE_ADMIN_PASSWORD`

### 4. Déployer
```bash
git push origin main
```

Vercel déploiera automatiquement la branche `main`.

---

## SEO & Favicons

### Favicons générés
Tous les fichiers sont dans `/public/` :

| Fichier | Utilisation |
|---------|------------|
| `favicon.svg` | Navigateurs modernes (scalable) |
| `favicon-32x32.png` | Onglet navigateur |
| `favicon-16x16.png` | Onglet navigateur (legacy) |
| `apple-touch-icon.png` | iPhone/iPad home screen |
| `og-image.png` | Partage sur réseaux sociaux |
| `icons/icon-192.png` | PWA Android |
| `icons/icon-512.png` | PWA app store |

### SEO intégré
- ✅ `index.html` optimisé avec meta tags
- ✅ `robots.txt` pour Google Search Console
- ✅ `sitemap.xml` pour indexation
- ✅ JSON-LD Schema.org (Organisation, WebSite, MobileApplication)
- ✅ Open Graph & Twitter Card pour les réseaux sociaux
- ✅ Geo-targeting pour Bénin/Cotonou

### Ajouter à Google Search Console
1. Aller sur [search.google.com/search-console](https://search.google.com/search-console)
2. Ajouter votre domaine
3. Vérifier la propriété
4. Soumettre le `sitemap.xml`

---

## PWA Installation

### Installation sur Desktop
1. Aller sur https://restafy.app
2. Cliquer le bouton "Installer" (coin supérieur droit, desktop)
3. Choisir "Installer Restafy"

### Installation sur Mobile
1. Ouvrir l'app dans le navigateur
2. Menu → "Ajouter à l'écran d'accueil"
3. L'app s'installe avec les icônes branding

### Service Worker
Le Service Worker (`sw.js`) active :
- ✅ Cahce du contenu statique
- ✅ Fonctionnement offline (partiel)
- ✅ Notifications push (optionnel)
- ✅ Sync en arrière-plan

---

## 📞 Support

**Email :** support@restafy.app  
**Site :** https://restafy.app  
**Docs :** https://docs.restafy.app (à créer)

---

## 🚀 Prochaines étapes

1. ✅ Configuration Supabase complète
2. ✅ Déployer sur Vercel
3. ✅ Ajouter à Google Search Console
4. ✅ Configurer le domaine personnalisé
5. ⏳ Ajouter les paiements USSD
6. ⏳ Intégrer les notifications push
7. ⏳ Mettre en place les analytics (Mixpanel/Posthog)

---

**Dernière mise à jour :** 9 mars 2026
