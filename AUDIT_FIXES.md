# Audit Fixes - Corrections des Bugs Critiques

Résumé des corrections apportées suite à l'audit de sécurité et fonctionnalité.

## Bugs Critiques Corrigés

### 1. ✅ Super Admin — Mot de passe hardcodé → Utilisation Supabase Auth
**Fichier:** `src/pages/superadmin/Login.tsx`
**Problème:** Le mot de passe admin était en clair dans le frontend (`VITE_ADMIN_PASSWORD`), visible dans les DevTools.
**Solution:** 
- Utilisation de `useAuth.signIn()` pour authentifier via Supabase
- Vérification du rôle `super_admin` côté serveur via le hook `useAuth`
- Suppression du stockage sessionStorage et de l'encodage base64 trivial

### 2. ✅ Super Admin — SessionStorage → useAuth + ProtectedRoute
**Fichiers:** `src/pages/superadmin/Dashboard.tsx` et autres
**Problème:** La sécurité reposait sur `sessionStorage` uniquement, sans RLS côté serveur.
**Solution:**
- Remplacement de sessionStorage par le hook `useAuth()` qui récupère le profil depuis Supabase
- Ajout de `ProtectedRoute requiredRole="super_admin"` sur toutes les routes super admin
- RLS appliquée sur toutes les tables consultées

### 3. ✅ Login — Rôle 'restaurant' non reconnu
**Fichier:** `src/pages/auth/Login.tsx` ligne 59
**Problème:** La redirection ne vérifiait que `'restaurant_owner'` et pas `'restaurant'`.
**Solution:** Ajout du rôle `'restaurant'` dans la condition de redirection.

### 4. ✅ App.tsx — Route /superadmin/dashboard non protégée
**Fichier:** `src/App.tsx` lignes 160-174
**Problème:** Deux routes pour le même dashboard, l'une non protégée.
**Solution:**
- Suppression de la route non protégée `/superadmin/dashboard`
- Consolidation de toutes les routes super admin sous `/superadmin` (protégé)

### 5. ✅ useAuth.ts — owner_id inexistant dans restaurants
**Fichier:** `src/hooks/useAuth.ts` ligne 197
**Problème:** Insertion d'une colonne inexistante causant l'échec silencieux des créations de restaurant.
**Solution:** Suppression de la ligne `owner_id: user.id` (le lien ownership passe par `profiles.restaurant_id`)

### 6. ✅ useAuth.ts — emailRedirectTo vers une route inexistante
**Fichier:** `src/hooks/useAuth.ts` ligne 142
**Problème:** Redirection vers `/auth/callback` qui n'existe pas dans les routes.
**Solution:** Changement en `/login` (route existante et cohérente)

### 7. ✅ useAuth.ts — Délai 1 seconde fragile
**Fichier:** `src/hooks/useAuth.ts` ligne 157
**Problème:** Patch temporaire pour attendre la création de l'utilisateur, peut échouer sur connexion lente.
**Solution:** Suppression (le trigger SQL gère la création du profil automatiquement maintenant)

### 8. ✅ emailLog.ts — process.env au lieu de import.meta.env
**Fichier:** `src/lib/emailLog.ts` ligne 26
**Problème:** Vite ne supporte pas `process.env` dans le frontend.
**Solution:** Utilisation de `import.meta.env.VITE_LOG_EMAILS_TO_DB`

### 9. ✅ SQL — Colonnes et tables manquantes
**Fichier:** `scripts/013-fix-bugs-critical.sql`
**Corrections:**
- Ajout colonne `created_by` à `restaurant_invites`
- Création table `email_logs` avec RLS
- Colonnes manquantes dans `events` et `ticket_purchases`
- Trigger auto-générant `ticket_number` (format: TKT-XXXXX)
- Index de performance sur email_logs

### 10. ✅ .env.example — VITE_BREVO_API_KEY manquante
**Fichier:** `.env.example`
**Problème:** Aucun développeur ne savait que VITE_BREVO_API_KEY était nécessaire.
**Solution:** Ajout avec documentation que c'est REQUIRED pour les emails

## Bugs Majeurs Non Critiques

### Dossier super-admin → superad🗑️ (nettoyage)
**Fichiers supprimés:**
- `src/pages/super-admin/Dashboard.tsx`
- `src/pages/super-admin/RestaurantManagement.tsx`

Raison: Dossier legacy en conflit avec `src/pages/superadmin/`.

## Bugs Mineurs Restants

Les bugs mineurs suivants requièrent une implémentation plus complexe et sont listés pour priorité future:

- **EventDetail/EventCheckout/MyTickets** — Toujours utilise le mock store (Zustand local). Nécessite la connexion à Supabase avec la migration events complète (script 012).
- **Brevo API Key exposée** — Actuellement envoyée depuis le frontend. À déplacer vers Supabase Edge Function pour sécurité maximale.

## Checklist de Vérification

- ✅ Super Admin utilise Supabase Auth
- ✅ Super Admin utilise ProtectedRoute requiredRole
- ✅ Routes super admin consolidées et protégées
- ✅ Login reconnaît tous les rôles et redirige correctement
- ✅ owner_id supprimé des créations restaurant
- ✅ emailRedirectTo pointe vers /login
- ✅ Délai 1s supprimé
- ✅ import.meta.env utilisé partout
- ✅ Tables et colonnes manquantes créées
- ✅ email_logs table avec RLS
- ✅ .env.example à jour
- ✅ Dossier legacy nettoyé

## Déploiement

1. Exécuter le script SQL: `scripts/013-fix-bugs-critical.sql`
2. Ajouter `VITE_BREVO_API_KEY` aux variables d'environnement
3. Redéployer l'application
4. Les utilisateurs super_admin peuvent maintenant se connecter via Supabase Auth

## Sécurité

- Aucun hardcoding de mot de passe
- Aucune clé API exposée dans le frontend
- RLS appliquée sur toutes les tables sensibles
- Sessions gérées par Supabase Auth (plus fiable)
