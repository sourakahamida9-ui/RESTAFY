# GUIDE D'IMPLÉMENTATION - ÉTAPE PAR ÉTAPE

## Phase 1: Setup Database (Jour 1)

### Étape 1.1: Exécuter les migrations SQL
```bash
# Connexion à Supabase SQL Editor et exécuter dans l'ordre:

# 1. Configuration Format USSD
-- Copier le contenu de scripts/015-ussd-format-config.sql

# 2. Permissions Restaurant/Catégories
-- Copier le contenu de scripts/016-fix-restaurant-creation-permissions.sql

# 3. Gestion Équipe
-- Copier le contenu de scripts/017-team-management-fixes.sql
```

### Étape 1.2: Vérifier les tables
```sql
-- Vérifier que les colonnes existent
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'payment_methods' AND column_name = 'ussd_template';

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'restaurant_staff';

-- Devrait montrer: profile_id, restaurant_id, role, shift_start, shift_end, is_active
```

---

## Phase 2: Backend - Hooks (Jour 2)

### Étape 2.1: Créer `useAnalyticsData.ts`
Fichier: `src/hooks/useAnalyticsData.ts`

```typescript
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AnalyticsData {
  revenues: Array<{ name: string; revenue: number; orders: number }>;
  topDishes: Array<{ name: string; sales: number; revenue: number }>;
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    satisfaction: number;
  };
}

export function useAnalyticsData(restaurantId: string, timeRange: '7d' | '30d' | '90d') {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Récupérer les commandes
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('created_at, total_amount, subtotal, discount')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate.toISOString())
        .eq('status', 'completed');

      if (ordersError) throw ordersError;

      // Récupérer les items les plus vendus
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('item_name, quantity, unit_price')
        .in('order_id', orders?.map(o => o.id) || []);

      if (itemsError) throw itemsError;

      // Traiter les données
      const processed = processAnalyticsData(orders || [], items || []);
      setData(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur analytics');
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, loading, error };
}

// Fonction helper pour traiter les données
function processAnalyticsData(orders: any[], items: any[]): AnalyticsData {
  // Agréger par jour
  const dailyData: Record<string, { revenue: number; count: number }> = {};
  
  orders.forEach(order => {
    const date = new Date(order.created_at);
    const key = date.toLocaleDateString('fr-FR', { weekday: 'short' });
    
    if (!dailyData[key]) {
      dailyData[key] = { revenue: 0, count: 0 };
    }
    
    dailyData[key].revenue += order.total_amount || 0;
    dailyData[key].count += 1;
  });

  const revenues = Object.entries(dailyData).map(([name, data]) => ({
    name,
    revenue: data.revenue,
    orders: data.count,
  }));

  // Top dishes
  const dishSales: Record<string, { sales: number; revenue: number }> = {};
  
  items.forEach(item => {
    if (!dishSales[item.item_name]) {
      dishSales[item.item_name] = { sales: 0, revenue: 0 };
    }
    dishSales[item.item_name].sales += item.quantity || 1;
    dishSales[item.item_name].revenue += (item.unit_price || 0) * (item.quantity || 1);
  });

  const topDishes = Object.entries(dishSales)
    .map(([name, data]) => ({ name, ...data, color: '#' + Math.floor(Math.random()*16777215).toString(16) }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  // KPIs
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    revenues: revenues.length > 0 ? revenues : generateDummyData(),
    topDishes: topDishes.length > 0 ? topDishes : [],
    kpis: {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      satisfaction: 4.8, // À récupérer de la table reviews
    },
  };
}

function generateDummyData() {
  return [
    { name: 'Lun', revenue: 0, orders: 0 },
    { name: 'Mar', revenue: 0, orders: 0 },
    { name: 'Mer', revenue: 0, orders: 0 },
    { name: 'Jeu', revenue: 0, orders: 0 },
    { name: 'Ven', revenue: 0, orders: 0 },
    { name: 'Sam', revenue: 0, orders: 0 },
    { name: 'Dim', revenue: 0, orders: 0 },
  ];
}
```

### Étape 2.2: Mettre à jour Analytics.tsx
Fichier: `src/pages/admin/Analytics.tsx`

- Importer le hook: `import { useAnalyticsData } from '@/hooks/useAnalyticsData';`
- Utiliser dans le composant:
```typescript
export default function Analytics() {
  const { profile } = useAuth();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const { data: analyticsData, loading } = useAnalyticsData(profile?.restaurant_id || '', timeRange);

  if (loading) return <div>Chargement...</div>;
  
  // Utiliser analyticsData au lieu de REVENUE_DATA
}
```

---

## Phase 3: Frontend - Formulaires (Jour 3)

### Étape 3.1: Créer `RestaurantSetup.tsx`
Fichier: `src/pages/RestaurantSetup.tsx`
(Voir le code complet dans ANALYSIS_5_PROBLEMS.md - Problème 3, Solution 3.1)

### Étape 3.2: Créer `MenuManager.tsx`
Fichier: `src/pages/admin/MenuManager.tsx`
(Voir le code complet dans ANALYSIS_5_PROBLEMS.md - Problème 3, Solution 3.2)

### Étape 3.3: Créer `TeamManager.tsx`
Fichier: `src/pages/admin/TeamManager.tsx`
(Voir le code complet dans ANALYSIS_5_PROBLEMS.md - Problème 5, Solution 5.1)

---

## Phase 4: Frontend - Configuration USSD (Jour 4)

### Étape 4.1: Ajouter section USSD dans Settings.tsx

Localiser le tab "Paiements USSD" dans `src/pages/admin/Settings.tsx` et ajouter:

```typescript
function USSDConfigSection({ restaurantId }: { restaurantId: string }) {
  const [templates, setTemplates] = useState({
    mtn: '*880*{CODE}*{AMOUNT}#',
    moov: '*895*{CODE}*{AMOUNT}#',
    celtiis: '*140*{CODE}*{AMOUNT}#',
  });
  const [saving, setSaving] = useState(false);

  const handleSaveTemplate = async (provider: string, template: string) => {
    if (!template.includes('{CODE}') || !template.includes('{AMOUNT}')) {
      alert('Template doit contenir {CODE} et {AMOUNT}');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({ ussd_template: template })
        .eq('code', provider);

      if (error) throw error;
      alert('✓ Format USSD mis à jour');
    } catch (error) {
      alert('Erreur: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Configuration Format USSD</h3>

      {Object.entries(templates).map(([provider, template]) => (
        <div key={provider} className="border rounded-lg p-4">
          <label className="block font-semibold capitalize mb-2">{provider}</label>

          <div className="bg-zinc-100 p-3 rounded mb-3 text-sm font-mono">
            Preview: {template.replace('{CODE}', 'ABC123').replace('{AMOUNT}', '5000')}
          </div>

          <input
            type="text"
            value={template}
            onChange={(e) => setTemplates({...templates, [provider]: e.target.value})}
            className="w-full border rounded-lg px-3 py-2 mb-3 font-mono text-sm"
            placeholder="Ex: *880*{CODE}*{AMOUNT}#"
          />

          <button
            onClick={() => handleSaveTemplate(provider, template)}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## Phase 5: Frontend - Codes Promo (Jour 5)

### Étape 5.1: Modifier Cart.tsx pour ajouter section promo

Localiser la section "Récapitulatif" et ajouter (voir ANALYSIS_5_PROBLEMS.md - Problème 4, Solution 4.1):

- State pour promo: `const [promoCode, setPromoCode] = useState('');`
- Fonction `handleApplyPromo()`
- Section HTML pour afficher le formulaire promo
- Calcul de la réduction dans le total

### Étape 5.2: Modifier useOrderManager.ts

Dans `src/hooks/useOrderManager.ts`, modifier `createOrder()` pour:
- Accepter `promoCodeId` et `promoCode` en paramètres
- Calculer le discount
- Passer `promo_code_id` et `discount` à l'insertion dans `orders`
- Incrémenter `used_count` dans `promo_codes`

---

## Phase 6: Routes dans App.tsx (Jour 6)

### Étape 6.1: Ajouter les imports
```typescript
import RestaurantSetup from './pages/RestaurantSetup';
import MenuManager from './pages/admin/MenuManager';
import TeamManager from './pages/admin/TeamManager';
```

### Étape 6.2: Ajouter les routes
```typescript
<Route path="/setup/restaurant" element={<ProtectedRoute requiredRole="restaurant_owner">
  <RestaurantSetup />
</ProtectedRoute>} />

<Route path="/admin/menu" element={<ProtectedRoute requiredRole="restaurant_owner">
  <MenuManager />
</ProtectedRoute>} />

<Route path="/admin/team" element={<ProtectedRoute requiredRole="restaurant_owner">
  <TeamManager />
</ProtectedRoute>} />
```

---

## Checklist de Vérification

### Base de Données ✓
- [ ] Migration 015 exécutée (USSD templates)
- [ ] Migration 016 exécutée (Restaurant/categories RLS)
- [ ] Migration 017 exécutée (Team management)
- [ ] Toutes les colonnes existent et RLS activé

### Backend ✓
- [ ] Hook `useAnalyticsData` créé et fonctionnel
- [ ] Requêtes Supabase testées
- [ ] Gestion des erreurs correcte

### Frontend - Phase 1 (Analytics) ✓
- [ ] Analytics.tsx utilise le hook
- [ ] TimeRange fonctionne
- [ ] Graphiques affichent les vraies données

### Frontend - Phase 2 (Restaurant) ✓
- [ ] RestaurantSetup.tsx créé et accessible
- [ ] Formulaire crée un restaurant
- [ ] Profil lié au restaurant
- [ ] MenuManager.tsx fonctionne
- [ ] Catégories créées

### Frontend - Phase 3 (Équipe) ✓
- [ ] TeamManager.tsx créé et accessible
- [ ] Horaires affichés/masqués selon le rôle
- [ ] Erreurs affichées par champ
- [ ] Équipe peut être créée

### Frontend - Phase 4 (USSD) ✓
- [ ] Section USSD visible dans Settings
- [ ] Templates modifiables
- [ ] Preview fonctionne
- [ ] Changements sauvegardés

### Frontend - Phase 5 (Promo) ✓
- [ ] Section promo visible dans Cart
- [ ] Code peut être saisi
- [ ] Code validé et appliqué
- [ ] Réduction affichée
- [ ] Commande créée avec `promo_code_id`

---

## Tests Fonctionnels Recommandés

### Test 1: Créer un Restaurant
1. Login avec account `restaurant_owner`
2. Aller à `/setup/restaurant`
3. Remplir le formulaire
4. Vérifier que le restaurant est créé dans Supabase

### Test 2: Créer une Catégorie
1. Aller à `/admin/menu`
2. Cliquer "Ajouter une catégorie"
3. Entrer "Plats chauds"
4. Vérifier dans Supabase

### Test 3: Ajouter un Employé
1. Aller à `/admin/team`
2. Remplir tous les champs
3. Sélectionner "Staff"
4. Horaires doivent apparaître
5. Soumettre et vérifier création

### Test 4: Modifier Format USSD
1. Aller à `/admin/settings`
2. Tab "Paiements USSD"
3. Modifier un template (ex: `*999*{CODE}*{AMOUNT}#`)
4. Sauvegarder
5. Vérifier dans Supabase

### Test 5: Utiliser Code Promo
1. Ajouter des articles au panier
2. Voir section "Avez-vous un code promo?"
3. Créer d'abord un code promo via PromoManager
4. Entrer le code dans le cart
5. Réduction doit s'appliquer
6. Passer la commande
7. Vérifier que `promo_code_id` est rempli dans `orders`

---

## Dépannage

### Analytics affichent "Pas de données"
- Vérifier que des commandes existent dans la BD avec `created_at` récent
- Vérifier les RLS sur `orders` et `order_items`
- Tester: `SELECT COUNT(*) FROM orders WHERE restaurant_id = 'XXX';`

### Erreur "Champs manquants" dans formulaires
- Vérifier chaque input a un `required` ou validation
- Vérifier que l'erreur est bien affichée
- Tester avec JS console open: `handleSubmit` devrait log les erreurs

### Promo code pas appliqué
- Vérifier que le code est bien inséré dans `promo_codes`
- Vérifier les colonnes: `is_active=true`, `expires_at` pas expiré, `used_count < max_uses`
- Tester manuellement la validation SQL:
  ```sql
  SELECT * FROM promo_codes WHERE code = 'TEST20' AND is_active = true;
  ```

### USSD template pas sauvegardé
- Vérifier que le template contient `{CODE}` et `{AMOUNT}`
- Vérifier que la mise à jour dans `payment_methods` a bien lieu
- Tester: `SELECT ussd_template FROM payment_methods WHERE code = 'mtn';`

---

## Prochaines étapes

Après avoir suivi ce guide:
1. Tous les 5 problèmes seront résolus
2. L'application sera prête pour les restaurants
3. Les données seront dynamiques et en temps réel
4. Les utilisateurs pourront créer des équipes sans confusion

Estimé: **6 jours** de développement (1 jour par phase)
