# 🍽️ Liens Importants pour les Restaurants - Guide Complet

## 📍 URLs de Base

| Section | URL | Accès | Description |
|---------|-----|-------|-------------|
| **Dashboard Principal** | `/restaurant/dashboard` | Restaurant Owner | Vue d'ensemble + KPIs |
| **Gestion Menu** | `/restaurant/dashboard/menu` | Restaurant Owner | Ajouter/modifier plats |
| **Généralisation Menu** | `/restaurant/dashboard/menu-generalization` | Restaurant Owner | Dupliquer/importer menus |
| **Gestion Équipe** | `/restaurant/dashboard/team` | Restaurant Owner | Ajouter staff/livreurs |
| **Analytics** | `/restaurant/dashboard/analytics` | Restaurant Owner | Statistiques ventes |
| **Paramètres** | `/restaurant/dashboard/settings` | Restaurant Owner | Config restaurant |
| **Événements** | `/restaurant/dashboard/events` | Restaurant Owner | Créer soirées/promos |
| **Codes Promo** | `/restaurant/dashboard/promos` | Restaurant Owner | Gérer réductions |
| **Caisse POS** | `/restaurant/dashboard/pos` | Staff/Manager | Ventes en boutique |

---

## 🛒 URLs Client (Public)

| Section | URL | Description |
|---------|-----|-------------|
| **Home** | `/` | Voir tous les restaurants |
| **Restaurant** | `/restaurant/{slug}` | Voir menu d'un restaurant |
| **Panier** | `/cart` | Passer commande |
| **Profil Client** | `/profile` | Mes commandes/profil |
| **Événements** | `/events` | Consulter les soirées |
| **Tickets** | `/my-tickets` | Mes billets d'événements |

---

## 🔐 URLs Super Admin

| Section | URL | Accès | Description |
|---------|-----|-------|-------------|
| **Login** | `/superadmin/login` | Public | Connexion admin |
| **Dashboard** | `/superadmin` ou `/superadmin/dashboard` | Super Admin | Vue globale |
| **Restaurants** | `/superadmin/restaurants` | Super Admin | Approuver/gérer restaurants |
| **Utilisateurs** | `/superadmin/users` | Super Admin | Bannir/supprimer users |
| **Finances** | `/superadmin/finances` | Super Admin | Revenus/transactions |
| **Data Center** | `/superadmin/data` | Super Admin | Sauvegardes/exports |
| **Monitoring** | `/superadmin/monitoring` | Super Admin | Logs/erreurs système |
| **Invitations** | `/superadmin/invites` | Super Admin | Invitations restaurants |
| **Méthodes Paiement** | `/superadmin/payment-methods` | Super Admin | Gérer paiements USSD |
| **Modes Commande** | `/superadmin/order-modes` | Super Admin | Gérer livraison/retrait |
| **Guide Gestion Users** | `/superadmin/user-management-guide` | Super Admin | Tutoriel suppression users |

---

## 🔑 Authentification

| URL | Description |
|-----|-------------|
| `/auth/login` | Se connecter |
| `/auth/signup` | S'inscrire |
| `/auth/callback` | Email confirmation (redirected after signup) |

---

## 📊 Flux Utilisateur Principal

```
1. CLIENT
   / (home) 
   → /restaurant/{slug} (voir menu)
   → /cart (commander)
   → /profile (historique)

2. RESTAURANT OWNER
   /restaurant/dashboard (accueil)
   → /restaurant/dashboard/menu (gérer plats)
   → /restaurant/dashboard/settings (configuration)
   → /restaurant/dashboard/analytics (voir ventes)
   → /restaurant/dashboard/team (staff)
   → /restaurant/dashboard/pos (ventes comptoir)

3. SUPER ADMIN
   /superadmin (accueil)
   → /superadmin/restaurants (valider)
   → /superadmin/users (modérer)
   → /superadmin/finances (revenus)
   → /superadmin/monitoring (logs)
```

---

## ⭐ Les Plus Critiques pour un Restaurant

### 1️⃣ `/restaurant/dashboard` 
- **Quand**: Chaque jour
- **Pourquoi**: Vue d'ensemble des commandes + KPIs
- **Action**: Valider commandes, voir revenus du jour

### 2️⃣ `/restaurant/dashboard/menu`
- **Quand**: Lors du lancement ou changements saisonniers
- **Pourquoi**: C'est là qu'on ajoute les plats
- **Action**: Ajouter plats, gérer stock, modifier prix

### 3️⃣ `/restaurant/dashboard/settings`
- **Quand**: Configuration initiale + modifications rares
- **Pourquoi**: Infos restaurant, horaires, frais livraison
- **Action**: Mettre à jour adresse, téléphone, codes USSD

### 4️⃣ `/restaurant/dashboard/analytics`
- **Quand**: Hebdomadaire ou mensuel
- **Pourquoi**: Analyser les ventes
- **Action**: Voir plats populaires, revenus, tendances

### 5️⃣ `/restaurant/dashboard/team`
- **Quand**: Lors d'embauche
- **Pourquoi**: Ajouter staff/livreurs
- **Action**: Inviter team members, assigner rôles

### 6️⃣ `/restaurant/dashboard/promos`
- **Quand**: Campagnes marketing
- **Pourquoi**: Créer codes promo pour fidéliser
- **Action**: Ajouter réductions, limiter utilisation

### 7️⃣ `/restaurant/dashboard/events`
- **Quand**: Événements spéciaux
- **Pourquoi**: Organiser soirées, concerts, promos
- **Action**: Créer événement, vendre tickets

---

## 🔧 Configuration Initiale Checklist

```
[ ] /restaurant/dashboard/settings
    - Infos restaurant (nom, adresse, téléphone)
    - Horaires d'ouverture
    - Frais de livraison
    - Codes USSD MTN/Moov/Celtiis

[ ] /restaurant/dashboard/menu
    - Ajouter catégories (Petit-déj, Entrées, Plats, Desserts)
    - Ajouter premiers plats avec images/prix
    - Configurer variantes (taille, options)

[ ] /restaurant/dashboard/team
    - Inviter manager(s)
    - Inviter livreurs
    - Assigner permissions

[ ] /restaurant/dashboard/analytics
    - Vérifier tableau de bord
    - Configurer alertes

[ ] /restaurant/dashboard/promos
    - Créer code promo de bienvenue
```

---

## 🚨 URLs de Secours/Debug

| URL | Utilité |
|-----|---------|
| `/` | Reset - revenir à l'accueil |
| `/auth/login` | Reconnecter si déconnecté |
| `/restaurant/dashboard` | Reset si vous êtes perdu |
| `/superadmin` | Reset si super admin perdu |

---

## 📱 Raccourcis Clavier Utiles

```
G D    = Go to Dashboard
G M    = Go to Menu
G A    = Go to Analytics
G S    = Go to Settings
? ou H = Help (aide)
```

*(À implémenter si souhaité)*

---

## 🔗 Intégrations Externes

| Service | Détails |
|---------|---------|
| **Brevo Email** | Confirmations commande, emails restaurant |
| **Supabase** | Base de données + auth |
| **Vercel Blob** | Images plats + photos profil |
| **USSD Providers** | MTN, Moov, Celtiis pour paiements |

---

## 📞 Support

- **Documentation**: Voir `README.md`
- **Signaler un bug**: Contact admin
- **Feature request**: Contact super admin

---

**Dernière mise à jour**: 10 Mars 2026
**Version**: 1.0
