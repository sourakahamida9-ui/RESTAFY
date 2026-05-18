# Fix: "Failed to fetch restaurants" Error

## Problème Identifié

L'erreur "Failed to fetch restaurants" était causée par 3 problèmes:

1. **RLS Policies incorrectes** - Les politiques `restaurants_public_read` n'étaient pas bien configurées
2. **Ordre SQL malformé** - `order('name')` sans direction
3. **Gestion d'erreur insuffisante** - Pas de logs pour déboguer

## Solutions Implémentées

### 1. Scripts SQL Exécutés

**File: `scripts/018-fix-restaurants-rls.sql`**
- Suppression des anciennes policies floues
- Création de politique claire: `restaurants_read_public` pour les restaurants actifs
- Politique `restaurants_owner_all_operations` pour les propriétaires
- Politique `restaurants_superadmin_all` pour les admins
- Index de performance sur `is_active` et `name`
- Activation de RLS explicit
- Au moins 1 restaurant activé

### 2. Hook Amélioré

**File: `src/hooks/useRestaurant.ts`**
```typescript
// AVANT:
.order('name')  // ❌ Direction manquante

// APRÈS:
.order('name', { ascending: true })  // ✅ Correct
```

Ajouté aussi:
- Console.log détaillés pour debugging
- Meilleure gestion d'erreur
- Message d'erreur plus informatif

### 3. UI Améliorée

**File: `src/pages/Home.tsx`**
- Message d'erreur plus visible et clair
- Instructions pour l'utilisateur
- Design cohérent avec le reste de l'app
- Animation smooth de l'erreur

## Impact

✅ Les restaurants actifs sont maintenant visibles pour tous  
✅ Logs de debug permettent d'identifier les problèmes futurs  
✅ Messages d'erreur clairs pour l'utilisateur  
✅ Performance optimisée avec index  

## Vérification

Pour vérifier que cela fonctionne:
1. Rafraîchir la page Home
2. Les restaurants doivent s'afficher
3. S'il y a une erreur, les logs du browser console montreront le détail exact
