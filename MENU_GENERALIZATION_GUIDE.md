# Guide de Généralisation des Menus Restaurants

## Vue d'ensemble

Le système de généralisation des menus permet aux restaurants de Restafy de :
- ✅ **Dupliquer** un menu d'un restaurant à un autre
- ✅ **Sauvegarder** des snapshots (versions) du menu
- ✅ **Restaurer** un menu à partir d'une sauvegarde
- ✅ **Exporter** le menu en JSON
- ✅ **Importer** un menu depuis JSON
- ✅ **Créer des templates** réutilisables

## Accès à la fonctionnalité

**URL:** `/restaurant/dashboard/menu-generalization`

**Rôles autorisés:**
- Restaurant Owner
- Manager
- Staff (lecture seule)

## Les 5 Fonctionnalités Principales

### 1. Dupliquer (Duplicate Menu)

Copie l'intégralité du menu d'un restaurant vers un autre.

#### Comment ça marche:
1. Cliquez sur le bouton **Dupliquer**
2. Sélectionnez le restaurant source
3. Configurez les options:
   - **Inclure les variantes** : Copie aussi les variantes de produits (tailles, saveurs, etc.)
   - **Multiplicateur de prix** : Ajuste automatiquement les prix (ex: 1.1 = +10%, 0.9 = -10%)
4. Confirmer

#### Exemple d'utilisation:
- Vous ouvrez un 2ème restaurant avec le même concept
- Dupliquez le menu du 1er restaurant
- Ajustez les prix si nécessaire (ex: 1.2 pour +20%)

#### Données copiées:
```
✓ Catégories
✓ Articles
✓ Variantes (optionnel)
✓ Descriptions
✓ Images
✗ Commandes historiques
```

---

### 2. Sauvegarder (Save Snapshot)

Crée une sauvegarde du menu actuel à un moment donné.

#### Comment ça marche:
1. Cliquez sur **Sauvegarder**
2. Entrez un nom (ex: "Menu Hiver 2025", "Avant restructuration")
3. Optionnel: Ajoutez des notes
4. Confirmer

#### Où sont les snapshots?
Vous les voyez dans la section **Snapshots sauvegardés** avec:
- Nom du snapshot
- Date de création
- Notes
- Bouton "Restaurer"

#### Cas d'usage:
- Avant de changer le menu (pour pouvoir revenir en arrière)
- Avant une grande modification
- Versioning du menu par saison

---

### 3. Restaurer (Restore Snapshot)

Retrouve le menu à partir d'une sauvegarde antérieure.

#### Comment ça marche:
1. Trouvez le snapshot dans la liste
2. Cliquez sur **Restaurer**
3. Confirmez (cela remplacera le menu actuel)

#### Important:
⚠️ Cette action est **irreversible**. Faites un snapshot du menu actuel avant de restaurer!

#### Exemple:
Menu 1er Janvier → Vous faites un changement → Vous regrettez → Vous restaurez le snapshot du 1er Janvier

---

### 4. Exporter (Export as JSON)

Télécharge le menu entier en fichier JSON.

#### Comment ça marche:
1. Cliquez sur **Exporter**
2. Un fichier `menu_[id]_[date].json` se télécharge

#### Format du fichier:
```json
{
  "version": "1.0",
  "exportDate": "2025-03-10T10:30:00Z",
  "categories": [...],
  "items": [...],
  "variants": [...]
}
```

#### Utilité:
- Sauvegarde hors-ligne du menu
- Partage avec d'autres restaurants
- Intégration avec d'autres systèmes
- Backup régulier

---

### 5. Importer (Import from JSON)

Importe un menu depuis un fichier JSON.

#### Comment ça marche:
1. Préparez un fichier JSON (exporté ou créé)
2. Cliquez sur **Importer**
3. Téléchargez le fichier
4. Configurez les options (prix, variantes, etc.)
5. Confirmer

#### Options d'import:
- **Inclure les variantes** : Active/désactive les variantes
- **Multiplicateur de prix** : Ajuste les prix (+10%, -20%, etc.)
- **Préfixe du nom** : Ajoute un préfixe à tous les noms

#### Exemple:
Importer un menu avec:
- Multiplicateur: 0.85 (réduction de 15%)
- Préfixe: "SPECIAL" → "SPECIAL - Burger Classic"

---

## Tables de Base de Données

### menu_snapshots
Sauvegarde l'état du menu à un moment donné.

```sql
- id (UUID)
- restaurant_id (FK)
- snapshot_name (VARCHAR)
- categories_data (JSONB) -- dump JSON
- items_data (JSONB) -- dump JSON
- variants_data (JSONB) -- dump JSON
- notes (TEXT)
- created_at
- created_by (FK à profiles)
```

### menu_imports
Trace les opérations d'import/duplication.

```sql
- id (UUID)
- restaurant_id (FK)
- source_restaurant_id (FK)
- import_type ('duplicate', 'import', 'template')
- status ('pending', 'in_progress', 'completed', 'failed')
- total_items, imported_items (INT)
- error_message (TEXT)
- created_at, started_at, completed_at
- created_by (FK)
```

### menu_templates (optionnel)
Templates pré-configurés réutilisables.

```sql
- id (UUID)
- name (VARCHAR)
- cuisine_type (TEXT)
- preview_data (JSONB)
- is_global (BOOLEAN)
- created_by (FK)
```

### Colonnes ajoutées à items
```sql
ALTER TABLE items ADD:
- source_restaurant_id (FK) -- d'où vient l'article
- is_template (BOOLEAN) -- si c'est un template
- template_tags (JSONB) -- tags pour classement
```

---

## Sécurité & Permissions

### Politiques RLS

```sql
-- menu_snapshots: Propriétaire du restaurant peut faire CRUD complet
-- menu_imports: Propriétaire du restaurant peut voir ses imports
-- menu_templates: Lecture seule pour tous, création admin seulement
```

### Validations

- ✅ Restaurant owner verrouillé (on utilise `profile.restaurant_id`)
- ✅ Données validées avant insert (nom requis, prix > 0, etc.)
- ✅ Import limité à 1000 articles par batch
- ✅ Snapshots limités à 50 par restaurant

---

## Workflow Complet : Exemple

### Scénario: "Je veux ouvrir un 2ème restaurant avec le même menu"

**Jour 1:**

1. Créez le 2ème restaurant (page `/create-restaurant`)
2. Connectez-vous au 2ème restaurant
3. Allez à `/restaurant/dashboard/menu-generalization`
4. Cliquez **Dupliquer** → Sélectionnez le 1er restaurant
5. Paramètres:
   - ✓ Inclure les variantes
   - Multiplicateur: 1.0 (même prix)
6. Attendez que le menu se duplique (~2-5 secondes)

**Jour 2:**

7. Ajustez les articles spécifiques au local (photos, descriptions)
8. Avant toute modification majeure, **Sauvegardez** un snapshot: "Après duplication"

**Jour 7:**

9. Vous changez le menu pour l'été
10. Vous regrettez → **Restaurez** le snapshot "Après duplication"

**Fin du mois:**

11. **Exportez** le menu → Stockez le JSON dans votre système

---

## Erreurs Courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| "Restaurant non lié" | `profile.restaurant_id` est NULL | Contactez admin |
| "Erreur lors de la duplication" | Variantes sans item_id | Vérifiez la BDD |
| "Fichier import invalide" | JSON mal formé | Téléchargez un export valide |
| "Dépassement de limite" | > 1000 articles | Divisez l'import en 2 |

---

## Limites Actuelles

- Maximum **50 snapshots** par restaurant
- Maximum **1000 articles** par import
- Snapshots limités à **30 jours** de conservation
- Aucun versioning des snapshots

## Améliorations Futures

- [ ] Versioning complet des snapshots
- [ ] Compression JSON pour réduire la taille
- [ ] Historique d'import avec logs détaillés
- [ ] Merge de 2 menus
- [ ] Templates pré-existants (pizzerias, restaurants fast-food, etc.)
- [ ] Synchronisation multi-restaurant en temps réel
- [ ] Audit trail complet (qui a changé quoi, quand)

---

## Support & Questions

Pour toute question:
- Consultez cette documentation
- Vérifiez les logs navigateur (F12 → Console)
- Contactez le support admin

