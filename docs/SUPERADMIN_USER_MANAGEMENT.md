# Système de Gestion des Utilisateurs - SuperAdmin

## Vue d'ensemble

Le panneau SuperAdmin dispose maintenant d'un système complet de gestion des utilisateurs avec des fonctionnalités avancées incluant la suppression sécurisée. Ce système respecte les principes de sécurité et prévient les erreurs accidentelles.

## Architecture du Système

### 1. Permissions et Droits

#### Rôles Autorisés
- **Super Admin** : Accès complet (lecture, modification, suppression)
- **Autres rôles** : Pas d'accès au panneau de gestion

#### Protections Intégrées
- Super admins **ne peuvent pas se supprimer eux-mêmes**
- Les super admins **ne peuvent pas supprimer d'autres super admins**
- Les droits sont vérifiés à chaque action via RLS (Row Level Security)

### 2. Flux de Suppression d'Utilisateur

#### Étape 1 : Accès à la Liste des Utilisateurs
```
Super Admin → Panneau Admin → Onglet "Utilisateurs"
```

#### Étape 2 : Localiser l'Utilisateur
- Utiliser la **barre de recherche** pour trouver par:
  - Nom complet
  - Email
  - Numéro de téléphone
- Appliquer des **filtres par rôle**:
  - Tous
  - Clients
  - Restaurants
  - Livreurs
  - Admins

#### Étape 3 : Accéder au Menu d'Actions
- Cliquer sur le bouton **⋮ (trois points)** à droite de la ligne
- Menu contextuel s'affiche avec options:
  - 👁️ Voir le profil
  - 🚫 Bannir/Débannir
  - 🗑️ Supprimer le compte

#### Étape 4 : Ouvrir la Modal de Suppression
- Cliquer sur **"Supprimer le compte"**
- La modal de confirmation s'ouvre avec:
  - Informations de l'utilisateur à confirmer
  - Avertissement des conséquences
  - Champ de confirmation textuel

#### Étape 5 : Confirmation Sécurisée
- Lire les **conséquences de la suppression**:
  - ✓ Compte utilisateur supprimé définitivement
  - ✓ Historique de commandes conservé (anonymisé)
  - ✓ Points de fidélité perdus
  - ✓ L'utilisateur ne pourra plus se connecter

- Taper exactement **"SUPPRIMER"** dans le champ de confirmation
- Le bouton "Supprimer définitivement" s'active uniquement si le texte correspond
- Cliquer sur **"Supprimer définitivement"**

#### Étape 6 : Exécution et Confirmation
- L'action est traitée avec animation de chargement
- En cas de succès:
  - L'utilisateur disparaît de la liste
  - Un message de confirmation s'affiche
  - La modal se ferme
- En cas d'erreur:
  - Un message d'erreur explicite s'affiche
  - L'utilisateur reste dans la liste
  - L'action peut être retentée

## Interface Utilisateur

### Colonne Actions

```
┌─────────────────────────────────┐
│ John Doe                         │ ⋮
│ john@example.com                │
│ 5 commandes - 1,250 points      │
└─────────────────────────────────┘
```

Cliquer sur **⋮** pour afficher:
```
┌──────────────────────────┐
│ 👁️  Voir le profil      │
│ 🚫 Bannir                │
│ ─────────────────────── │
│ 🗑️  Supprimer le compte │
└──────────────────────────┘
```

### Modal de Suppression

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚠️  Supprimer l'utilisateur     ✕┃
┃ Cette action est irréversible    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                   ┃
┃ Utilisateur à supprimer:          ┃
┃ ┌──────────────────────────────┐ ┃
┃ │ J │ John Doe                 │ ┃
┃ │   │ john@example.com         │ ┃
┃ │   │ 5 commandes - 1250 pts   │ ┃
┃ └──────────────────────────────┘ ┃
┃                                   ┃
┃ Conséquences de la suppression:  ┃
┃ ☑ Compte utilisateur supprimé    ┃
┃ ☑ Historique de commandes conservé
┃ ☑ Points de fidélité perdus      ┃
┃ ☑ L'utilisateur ne pourra plus se connecter
┃                                   ┃
┃ Tapez SUPPRIMER pour confirmer:  ┃
┃ ┌──────────────────────────────┐ ┃
┃ │ [SUPPRIMER               ]   │ ┃
┃ └──────────────────────────────┘ ┃
┃                                   ┃
┃ [ Annuler ]  [ Supprimer déf. ] ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## Sécurité Implémentée

### 1. Protections Côté Client

- **Champ de confirmation textuel** : Force le super admin à taper "SUPPRIMER"
- **Affichage des conséquences** : Liste les impacts de la suppression
- **Informations de l'utilisateur** : Permet une double-vérification
- **Désactivation du bouton** : Jusqu'à ce que le texte soit correct
- **Menu d'actions** : Désactive la suppression pour super admins

### 2. Protections Côté Serveur (Supabase)

#### RLS Policies
```sql
-- Super admins peuvent supprimer les utilisateurs
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  USING (
    auth.uid() != id AND -- Pas de self-delete
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'super_admin'
  );

-- Super admins ne peuvent pas supprimer d'autres super admins
CREATE POLICY "profiles_delete_not_superadmin" ON profiles FOR DELETE
  USING (
    role != 'super_admin' OR
    (SELECT role FROM profiles WHERE id = auth.uid()) != 'super_admin'
  );
```

#### Triggers et Transactions
- Les suppressions utilisent une transaction SQL atomique
- Les commandes de l'utilisateur sont conservées mais anonymisées
- L'historique est maintenu pour audit et reporting

### 3. Audit et Logging

#### Table d'Audit
```sql
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id),
  action TEXT,
  target_user_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ
);
```

#### Actions Enregistrées
- Suppression d'utilisateur : `user_deleted`
- Bannissement d'utilisateur : `user_banned`
- Débannissement d'utilisateur : `user_unbanned`

## Gestion des Cas Limites

### Cas 1 : Utilisateur avec Restaurant Actif
**Situation** : Le super admin supprime un user qui possède un restaurant actif

**Comportement** :
1. Le restaurant reste en base de données
2. Les commandes du restaurant sont conservées
3. Seul le profil du propriétaire est supprimé
4. Une notification peut être envoyée au système

**Recommandation** : Avant suppression, archiver le restaurant ou le réassigner

### Cas 2 : Utilisateur avec Commandes en Cours
**Situation** : Suppression d'un client avec des commandes non livrées

**Comportement** :
1. L'utilisateur est supprimé immédiatement
2. Les commandes restent en base (user_id = NULL)
3. Les livreurs reçoivent une notification
4. Le système génère un rapport de dettes éventuelles

**Recommandation** : Contacter le client avant suppression

### Cas 3 : Super Admin Système (ID Fixe)
**Situation** : Tentative de suppression du super admin principal

**Comportement** :
- ❌ Impossible : Le bouton de suppression est désactivé
- ❌ Impossible : La RLS policy refuse la suppression
- ❌ Impossible : Un trigger SQL lance une erreur

## Best Practices pour le Super Admin

### Avant de Supprimer un Utilisateur

1. ✅ **Vérifier l'identité** : Consulter le profil détaillé
2. ✅ **Vérifier l'historique** : Voir les commandes et activités
3. ✅ **Vérifier les dettes** : S'assurer qu'il n'y a pas de paiements en attente
4. ✅ **Vérifier les restaurants** : Si propriétaire, archiver le restaurant
5. ✅ **Envoyer un avertissement** : Notifier l'utilisateur avant suppression
6. ✅ **Documenter la raison** : Conserver un log de pourquoi

### Après la Suppression

1. ✅ **Vérifier la base de données** : S'assurer que la suppression est effectuée
2. ✅ **Consulter les logs d'audit** : Confirmer que l'action a été enregistrée
3. ✅ **Informer l'équipe** : Si besoin, documenter la suppression
4. ✅ **Archiver les données** : Créer un backup pour compliance RGPD

## Implémentation Technique

### Fichiers Impliqués

1. **Frontend**
   - `src/pages/superadmin/Users.tsx` : Composant principal avec logique de suppression
   - `src/pages/superadmin/Users.tsx` : `DeleteConfirmationModal` : Modal de confirmation
   - `src/pages/superadmin/Users.tsx` : `UserActionsMenu` : Menu d'actions

2. **Backend SQL**
   - `scripts/014-secure-user-delete.sql` : Fonctions et RLS policies
   - Table `profiles` : Cible de la suppression
   - Table `admin_audit_logs` : Historique des actions

### Code Clé : Suppression

```typescript
const handleDeleteUser = async () => {
  if (!userToDelete) return;
  
  // Protection: ne pas permettre la suppression d'un super_admin
  if (userToDelete.role === 'super_admin') {
    alert('Impossible de supprimer un compte super admin');
    return;
  }

  try {
    setIsDeleting(true);
    
    // Supprimer le profil (les commandes seront anonymisées)
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userToDelete.id);

    if (error) throw error;

    // Mettre à jour l'interface
    setUsers(users.filter(u => u.id !== userToDelete.id));
    setDeleteModalOpen(false);
    setUserToDelete(null);
    
  } catch (error) {
    console.error('Error deleting user:', error);
    alert(error instanceof Error ? error.message : 'Erreur lors de la suppression');
  } finally {
    setIsDeleting(false);
  }
};
```

## Conformité et Régulation

### RGPD (Règlement Général sur la Protection des Données)

- ✅ **Droit à l'oubli** : L'utilisateur est complètement supprimé
- ✅ **Consentement explicite** : Confirmation avec texte "SUPPRIMER"
- ✅ **Audit trail** : Les suppressions sont enregistrées
- ✅ **Anonymisation** : Les commandes sont anonymisées après suppression

### Recommandations

1. Envoyer un email à l'utilisateur **avant** la suppression
2. Attendre 48h minimum pour validation
3. Enregistrer la date de suppression dans les logs
4. Conserver un backup pour 30 jours (légalement requis)
5. Documenter la raison légale de la suppression

## Dépannage

### Erreur : "Impossible de supprimer un compte super admin"

- **Cause** : Tentative de suppression d'un super admin
- **Solution** : Ce compte ne peut pas être supprimé (c'est une protection)

### Erreur : "Erreur lors de la suppression du profil"

- **Cause** : Problème de permissions Supabase ou de contraintes FK
- **Solution** :
  1. Vérifier que vous êtes super admin
  2. Vérifier que le user_id existe
  3. Vérifier les logs Supabase

### L'utilisateur n'est pas supprimé après clic

- **Cause** : RLS policy refuse la suppression
- **Solution** :
  1. Vérifier votre rôle dans `profiles.role`
  2. Vérifier que `auth.uid()` est correct
  3. Relancer la suppression

## Support et Escalade

Pour les problèmes complexes :
1. Consulter les logs d'audit Supabase
2. Vérifier la table `admin_audit_logs`
3. Contacter le développeur responsable
4. Escalader au lead technique si nécessaire
