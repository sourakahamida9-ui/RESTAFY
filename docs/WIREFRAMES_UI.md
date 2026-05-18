# Wireframes et Visuels - Système de Gestion des Utilisateurs

## 1. Interface Principale - Liste des Utilisateurs

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  SuperAdmin Dashboard                                           ⌚ 14:32    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                              ┃
┃  Utilisateurs                                                               ┃
┃                                                                              ┃
┃  ┌──────────────────────────────────────┐  [Tous] [Clients] [Restaurants]   ┃
┃  │ 🔍 Rechercher par nom, email...      │  [Livreurs] [Admins]               ┃
┃  └──────────────────────────────────────┘                                    ┃
┃                                                                              ┃
┃  ┌────────────────────────────────────────────────────────────────────────┐ ┃
┃  │ Avatar │ Nom                 │ Email              │ Rôle         │ ⋮   │ ┃
┃  ├────────────────────────────────────────────────────────────────────────┤ ┃
┃  │  JD   │ John Doe             │ john@example.com   │ Client       │ ⋮   │ ┃
┃  │       │ +229 01234567 │ 5 cmd │ 1,250 pts         │              │     │ ┃
┃  ├────────────────────────────────────────────────────────────────────────┤ ┃
┃  │  SD   │ Sarah Davis          │ sarah@example.com  │ Restaurant   │ ⋮   │ ┃
┃  │       │ +229 02345678 │ 23 cmd│ 5,890 pts         │              │     │ ┃
┃  ├────────────────────────────────────────────────────────────────────────┤ ┃
┃  │  MB   │ Marcus Brown         │ marcus@example.com │ Livreur      │ ⋮   │ ┃
┃  │       │ +229 03456789 │ 142 cmd│ 12,500 pts       │              │     │ ┃
┃  ├────────────────────────────────────────────────────────────────────────┤ ┃
┃  │  AA   │ Admin A (BANNISED)   │ admin.a@example.com│ Super Admin  │ ⋮   │ ┃
┃  │       │ +229 04567890 │ 1,200 │ 50,000 pts        │              │     │ ┃
┃  └────────────────────────────────────────────────────────────────────────┘ ┃
┃                                                                              ┃
┃  Affichage: 1-20 / 1,245 utilisateurs                                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## 2. Menu d'Actions (Contextuel)

```
                                        ┏━━━━━━━━━━━━━━━━━━━━━━┓
                                        ┃ 👁️  Voir le profil  ┃
                                        ┣━━━━━━━━━━━━━━━━━━━━━━┫
                                        ┃ 🚫 Bannir            ┃
                                        ┣━━━━━━━━━━━━━━━━━━━━━━┫
                                        ┃ 🗑️  Supprimer...    ┃
                                        ┗━━━━━━━━━━━━━━━━━━━━━━┛
```

### Menu pour Super Admin (Verrouillé)

```
                                        ┏━━━━━━━━━━━━━━━━━━━━━━┓
                                        ┃ 👁️  Voir le profil  ┃
                                        ┣━━━━━━━━━━━━━━━━━━━━━━┫
                                        ┃ 🚫 Bannir            ┃
                                        ┣━━━━━━━━━━━━━━━━━━━━━━┫
                                        ┃ 🗑️  Supprimer...    ┃ [DÉSACTIVÉ]
                                        ┗━━━━━━━━━━━━━━━━━━━━━━┛
```

## 3. Modal de Suppression - Étape 1 (Information)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ║
║  ┃  ⚠️  Supprimer l'utilisateur                                    ✕     ┃  ║
║  ┃  Cette action est irréversible                                        ┃  ║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ║
║                                                                              ║
║  Utilisateur à supprimer:                                                   ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ JD │ John Doe                                                           │ ║
║  │    │ john@example.com                                                   │ ║
║  │    │ 5 commandes - 1,250 points de fidélité                             │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║  ⚠️ Conséquences de la suppression:                                          ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ ✓ Compte utilisateur supprimé définitivement                            │ ║
║  │ ✓ Historique de commandes conservé (anonymisé)                          │ ║
║  │ ✓ Points de fidélité perdus                                             │ ║
║  │ ✓ L'utilisateur ne pourra plus se connecter                             │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║  Tapez SUPPRIMER pour confirmer:                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ [SUPPRIMER                                              ]                │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║  Exemple: Taper "SUPPRIMER" exactement (majuscules/minuscules importante)   ║
║                                                                              ║
║  ┌──────────────┐  ┌──────────────────────────────────┐                     ║
║  │   Annuler    │  │ Supprimer définitivement [INACTIF]│                    ║
║  └──────────────┘  └──────────────────────────────────┘                     ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## 4. Modal de Suppression - Étape 2 (Après Confirmation)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ║
║  ┃  ⚠️  Supprimer l'utilisateur                                    ✕     ┃  ║
║  ┃  Cette action est irréversible                                        ┃  ║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ║
║                                                                              ║
║  Utilisateur à supprimer:                                                   ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ JD │ John Doe                                                           │ ║
║  │    │ john@example.com                                                   │ ║
║  │    │ 5 commandes - 1,250 points de fidélité                             │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║  ⚠️ Conséquences de la suppression:                                          ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ ✓ Compte utilisateur supprimé définitivement                            │ ║
║  │ ✓ Historique de commandes conservé (anonymisé)                          │ ║
║  │ ✓ Points de fidélité perdus                                             │ ║
║  │ ✓ L'utilisateur ne pourra plus se connecter                             │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║  Tapez SUPPRIMER pour confirmer:                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ [SUPPRIMER                                              ]                │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║  ┌──────────────┐  ┌──────────────────────────────────┐                     ║
║  │   Annuler    │  │ Supprimer définitivement [ACTIF]  │                    ║
║  └──────────────┘  └──────────────────────────────────┘                     ║
║                        ↑                                                     ║
║                   Bouton maintenant actif!                                   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## 5. Modal de Suppression - Étape 3 (Traitement)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ║
║  ┃  ⚠️  Supprimer l'utilisateur                                    ✕     ┃  ║
║  ┃  Cette action est irréversible                                        ┃  ║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ║
║                                                                              ║
║  Utilisateur à supprimer:                                                   ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ JD │ John Doe                                                           │ ║
║  │    │ john@example.com                                                   │ ║
║  │    │ 5 commandes - 1,250 points de fidélité                             │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║  ⚠️ Conséquences de la suppression:                                          ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ ✓ Compte utilisateur supprimé définitivement                            │ ║
║  │ ✓ Historique de commandes conservé (anonymisé)                          │ ║
║  │ ✓ Points de fidélité perdus                                             │ ║
║  │ ✓ L'utilisateur ne pourra plus se connecter                             │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║  Tapez SUPPRIMER pour confirmer:                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ [SUPPRIMER                                              ]                │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║  ┌──────────────┐  ┌──────────────────────────────────┐                     ║
║  │   Annuler    │  │ ⏳ Suppression...                 │                    ║
║  │ [DÉSACTIVÉ]  │  │ [DÉSACTIVÉ PENDANT TRAITEMENT]   │                    ║
║  └──────────────┘  └──────────────────────────────────┘                     ║
║                                                                              ║
║              Animation: ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧                                      ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## 6. Diagramme de Flux

```
┌─────────────────────┐
│  SuperAdmin         │
│  Panel              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Cliquer sur        │
│  "Utilisateurs"     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│  Voir la liste des      │
│  utilisateurs avec:     │
│  - Barre de recherche   │
│  - Filtres par rôle     │
│  - Menu d'actions (⋮)   │
└──────────┬──────────────┘
           │
           ├─► [Bannir] ──────────► Utilisateur banni
           │
           ├─► [Voir profil] ──────► Page de profil
           │
           └─► [Supprimer] ────────┐
                                    ▼
                    ┌───────────────────────────┐
                    │  Modal de suppression     │
                    │  s'ouvre                  │
                    └───────────┬───────────────┘
                                │
                                ├─► [Annuler] ──► Modal se ferme
                                │
                                └─► Lire les conséquences
                                    Taper "SUPPRIMER"
                                           │
                                           ▼
                                    ┌──────────────────┐
                                    │ Bouton activé?   │
                                    └────┬────────┬────┘
                                         │ Non    │ Oui
                                         │        │
                                         │        ▼
                                         │   Cliquer le bouton
                                         │   "Supprimer"
                                         │        │
                                         │        ▼
                                    ┌─────────────────────┐
                                    │ Traitement côté     │
                                    │ serveur (Supabase)  │
                                    └────────┬────────────┘
                                             │
                                    ┌────────┴────────┐
                                    │ Succès?         │
                                    └────┬────────┬───┘
                                         │ Non    │ Oui
                                         │        │
                                         ▼        ▼
                                    [Erreur]  [Succès]
                                    Afficher  Utilisateur
                                    message   disparaît
```

## 7. Schéma de Sécurité

```
┌─────────────────────────────────────────────────────────────────┐
│                      SUPPRIMER UN UTILISATEUR                  │
│                                                                 │
│  PROTECTIONS CLIENT                 PROTECTIONS SERVEUR        │
│  ────────────────────               ────────────────────        │
│  ✓ Confirmation                     ✓ RLS Policy               │
│    textuelle                          (row-level security)     │
│  ✓ Affichage des                   ✓ Vérification du           │
│    conséquences                       rôle (super_admin)       │
│  ✓ Infos utilisateur               ✓ Transaction              │
│    pour vérification                 atomique                  │
│  ✓ Bouton désactivé               ✓ Anonymisation            │
│  ✓ Protection pour                 ✓ Audit logging             │
│    super admins                                                 │
│                                                                 │
│  ➜ Utilisateur clique sur "Supprimer"                           │
│       │                                                         │
│       ├─► Modal de confirmation                                │
│       │   (Client-side)                                        │
│       │                                                         │
│       └─► Supabase API                                         │
│           (Server-side)                                        │
│               │                                                │
│               ├─► RLS Policy vérifie les droits               │
│               ├─► Trigger vérifie les contraintes             │
│               └─► Audit logging de l'action                   │
│                                                                 │
│  ➜ Résultat: Suppression réussie et enregistrée                │
└─────────────────────────────────────────────────────────────────┘
```

## 8. États de l'Interface

### État 1: Liste Normale
```
Affichage: Utilisateur normal
├─ Avatar
├─ Nom et email
├─ Téléphone
├─ Rôle (Client)
├─ Commandes: 5
├─ Points: 1,250
└─ Menu d'actions: ⋮ [Disponible]
```

### État 2: Super Admin
```
Affichage: Super Admin
├─ Avatar
├─ Nom et email
├─ Téléphone
├─ Rôle (Super Admin) [Badge distinctif]
├─ Commandes: 1,200
├─ Points: 50,000
└─ Menu d'actions: ⋮ [Suppression grisée/désactivée]
```

### État 3: Utilisateur Banni
```
Affichage: Utilisateur Banni
├─ Avatar [Semi-transparent]
├─ Nom et email [Barré/Grisé]
├─ Téléphone
├─ Rôle (Client) [Badge BANNED]
├─ Commandes: 5
├─ Points: 0 (perdus)
└─ Menu d'actions: ⋮ [Debannir disponible]
```

## 9. Palette de Couleurs

```
┌─────────────────────────┐
│ Fond principal          │  #1A1A1A (Dark)
│ Texte principal         │  #FFFFFF (White)
│ Texte secondaire        │  #A1A1A1 (Gray)
├─────────────────────────┤
│ Bouton actif            │  #FF6B00 (Orange)
│ Bouton hover            │  #FF8C00 (Lighter Orange)
├─────────────────────────┤
│ Modal - Warning         │  #DC2626 (Red) + #7F1D1D (Dark Red BG)
│ Modal - Consequence     │  #FBBF24 (Amber) + #78350F (Dark Amber BG)
│ Modal - Success         │  #10B981 (Green) + #065F46 (Dark Green BG)
├─────────────────────────┤
│ Badge - Super Admin     │  #3B82F6 (Blue)
│ Badge - Restaurant      │  #8B5CF6 (Purple)
│ Badge - Livreur         │  #EC4899 (Pink)
│ Badge - Banni           │  #EF4444 (Red)
└─────────────────────────┘
```

## 10. Responsive Design

### Desktop (1200px+)
```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │  Tableau pleine largeur avec toutes les colonnes   │
│          │                                                     │
│          │  Avatar │ Nom │ Email │ Tel │ Role │ Cmd │ Pts │ ⋮ │
└─────────────────────────────────────────────────────────────────┘
```

### Tablet (768px-1199px)
```
┌──────────────────────────────────────────────────┐
│ ≡ │  Tableau adapté (colonnes cachées)          │
│   │                                              │
│   │  Avatar │ Nom │ Email │ Role │ ⋮            │
└──────────────────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌──────────────────────────────┐
│ ≡ │  Cartes empilées         │
│   │                          │
│   │  ┌────────────────────┐  │
│   │  │ Avatar             │  │
│   │  │ Nom: John Doe      │  │
│   │  │ Email: ...         │  │
│   │  │ Rôle: Client       │  │
│   │  │ [⋮ Menu]           │  │
│   │  └────────────────────┘  │
└──────────────────────────────┘
```
