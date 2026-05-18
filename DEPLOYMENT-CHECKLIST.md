# ✅ Checklist de Déploiement Restafy

## 🔧 Avant le déploiement local

- [ ] Node.js 18+ installé
- [ ] `pnpm` installé globalement (`npm install -g pnpm`)
- [ ] Cloner le repository
- [ ] `pnpm install` exécuté avec succès
- [ ] `.env.local` créé avec les variables Supabase
- [ ] `pnpm dev` fonctionne sans erreurs
- [ ] Page d'accueil s'affiche correctement

## 🗄️ Configuration Supabase

- [ ] Projet Supabase créé
- [ ] Base de données PostgreSQL active
- [ ] Tables créées (via les scripts SQL)
  - [ ] `001-fix-restaurants-table.sql`
  - [ ] `002-fix-profiles-table.sql`
  - [ ] `003-fix-orders-table.sql`
  - [ ] `004-fix-order-items-table.sql`
  - [ ] `005-create-restaurant-staff-table.sql`
  - [ ] `006-create-notifications-table.sql`
  - [ ] `007-create-rls-policies.sql`
  - [ ] `008-loyalty-points-function.sql`
  - [ ] `009-promo-codes-and-order-type.sql`
  - [ ] `010-fix-storage-bucket.sql`
  - [ ] `011-restaurant-invites-table.sql`
- [ ] Bucket Storage `restaurants` créé avec RLS
- [ ] Authentication activée (Email/Password)
- [ ] CORS configuré pour `localhost:5173`

## 🌐 Configuration Vercel

- [ ] Compte Vercel créé
- [ ] Repository GitHub connecté
- [ ] Project créé sur Vercel
- [ ] Environment variables configurées :
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `VITE_ADMIN_EMAIL`
  - [ ] `VITE_ADMIN_PASSWORD`
  - [ ] `VITE_KKIAPAY_PUBLIC_KEY`
  - [ ] `VITE_KKIAPAY_ENVIRONMENT` (sandbox ou live)

## 📱 Testage Local Complet

### Pages d'authentification
- [ ] `/signup` - Inscription client fonctionne
- [ ] `/login` - Connexion fonctionne
- [ ] `/restaurant/signup?token=RESTAFY-PARTNER-2024` - Inscription restaurant fonctionne
- [ ] `/superadmin/login` - Connexion admin fonctionne

### Pages client
- [ ] `/` - Accueil affiche les restaurants
- [ ] `/restaurant/:id` - Détail restaurant charge
- [ ] `/cart` - Panier fonctionne
- [ ] `/orders` - Historique commandes visible
- [ ] `/loyalty` - Dashboard fidélité visible
- [ ] `/events` - Événements affichent

### Pages restaurant
- [ ] `/restaurant/dashboard` - Orders affichent
- [ ] `/restaurant/dashboard/menu` - Menu management fonctionne
- [ ] `/restaurant/dashboard/team` - Team management fonctionne
- [ ] `/restaurant/dashboard/analytics` - Analytics visible
- [ ] `/restaurant/dashboard/promos` - Promo codes management fonctionne
- [ ] `/restaurant/dashboard/settings` - Paramètres chargent

### Pages admin
- [ ] `/superadmin/dashboard` - Stats s'affichent
- [ ] `/superadmin/invites` - Gestion invitations fonctionne

## 🎨 SEO & Assets

- [ ] Favicons générés dans `/public/`
  - [ ] `favicon.svg`
  - [ ] `favicon-32x32.png`
  - [ ] `favicon-16x16.png`
  - [ ] `apple-touch-icon.png`
  - [ ] `og-image.png`
  - [ ] `icons/icon-192.png`
  - [ ] `icons/icon-512.png`
- [ ] `index.html` contient tous les meta tags SEO
- [ ] `robots.txt` est présent
- [ ] `sitemap.xml` est présent
- [ ] Manifests présents :
  - [ ] `manifest.json`
  - [ ] `manifest-restaurant.json`
- [ ] Service Worker (`sw.js`) enregistré

## 🔑 Identifiants & Tokens

- [ ] Super admin credentials configurés (changés des defaults)
- [ ] Token d'invitation restaurant généré et testé
- [ ] Lien d'invitation format : `/restaurant/signup?token=RESTAFY-PARTNER-2024`

## 🚀 Déploiement Vercel

- [ ] Repository poussé vers GitHub (`main` branch)
- [ ] Vercel déploiement déclenché
- [ ] Build successful
- [ ] Domaine personnalisé configuré (optionnel)
- [ ] HTTPS actif
- [ ] SSL certificate valide

## 🔍 Post-déploiement

- [ ] Application accessible sur le domaine
- [ ] Pages chargent sans erreurs
- [ ] Images/assets affichent correctement
- [ ] PWA installable (prompt affiche)
- [ ] Console browser sans erreurs critiques
- [ ] Network requests vers Supabase OK

## 📊 Analytics & SEO

- [ ] Google Search Console setup
  - [ ] Propriété vérifiée
  - [ ] Sitemap soumis
- [ ] Google Analytics configuré (optionnel)
- [ ] Meta tags vérifiés avec Facebook Debugger
- [ ] og-image preview affiche correctement

## 🔐 Sécurité

- [ ] Supabase RLS policies activées
- [ ] Credentiels secrets en env variables
- [ ] Pas de secrets en git
- [ ] CORS restricté aux domaines autorisés
- [ ] Rate limiting configuré (optionnel)

## 📞 Configuration Finale

- [ ] Email de support configuré
- [ ] Liens réseaux sociaux mis à jour
- [ ] Documentation accessible
- [ ] Termes & Conditions page (optionnel)
- [ ] Privacy Policy page (optionnel)

## ✨ Fonctionnalités Optionnelles

- [ ] Notifications push activées
- [ ] Paiement USSD intégré
- [ ] Maps & géolocalisation configurée
- [ ] Email notifications pour restaurants
- [ ] SMS notifications configuré

## 📋 Checklist Finale

- [ ] Test complet du flux client (inscription → commande)
- [ ] Test complet du flux restaurant (inscription → gestion commande)
- [ ] Test admin (génération tokens, stats)
- [ ] Pas d'erreurs console
- [ ] Performance satisfaisante (Lighthouse > 80)
- [ ] Mobile responsive OK
- [ ] Tout est documenté
- [ ] Backup de la BD pris
- [ ] Monitoring en place

---

**Avant de lancer la version 1.0 en production, assurer que 100% des items sont cochés ✅**

**Date de déploiement :** _________________

**Responsable :** _________________________

**Signature :** ____________________________
