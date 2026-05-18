# ANALYSE TECHNIQUE DÉTAILLÉE - 5 PROBLÈMES MAJEURS

## Vue d'ensemble
Analyse technique complète des 5 problèmes reportés dans l'application Restafy, avec causes possibles, solutions techniques et étapes de vérification.

---

## 🔴 PROBLÈME 1: Module "Rapport et Analytics" Statique

### Description c
- Page `/restaurant/dashboard/analytics` affiche des données **en dur** (hardcodées)
- Aucune intégration avec la base de données Supabase
- Pas de paramètres configurables (timeRange ne change rien)

### Fichiers impliqués
```
📄 src/pages/admin/Analytics.tsx (PROBLÉMATIQUE)
📊 Données en dur: REVENUE_DATA, TOP_DISHES (lignes 35-51)
```

### Causes identifiées

#### ❌ Cause 1: Données Hardcodées
```typescript
// Ligne 35-43 - MAUVAIS
const REVENUE_DATA = [
  { name: 'Lun', revenue: 45000, orders: 12 },
  { name: 'Mar', revenue: 52000, orders: 15 },
  // ... données statiques
];
```

#### ❌ Cause 2: Timerange non utilisé
```typescript
// Ligne 54: const timeRange = '7d' / '30d'
// Mais cette variable N'EST UTILISÉE NULLE PART
// Aucune requête API n'existe pour charger les données
```

#### ❌ Cause 3: Pas de Hook de Data Fetching
- Pas de `useEffect` pour charger les données
- Pas d'appel à Supabase pour récupérer `analytics_events`
- Pas de traitement des données temps réel

### Solutions techniques

#### ✅ Solution 1.1: Créer un Hook `useAnalyticsData`
```typescript
// src/hooks/useAnalyticsData.ts (À CRÉER)
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useAnalyticsData(restaurantId: string, timeRange: '7d' | '30d' | '90d') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        
        // Calculer la date de début
        const now = new Date();
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        // Requête Supabase
        const { data: events, error } = await supabase
          .from('analytics_events')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Traiter et agréger les données
        const processed = processAnalyticsData(events);
        setData(processed);
      } catch (error) {
        console.error('Analytics error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [restaurantId, timeRange]);

  return { data, loading };
}
```

#### ✅ Solution 1.2: Intégrer le Hook dans Analytics.tsx
```typescript
// src/pages/admin/Analytics.tsx - À MODIFIER
import { useAnalyticsData } from '@/hooks/useAnalyticsData';

export default function Analytics() {
  const { profile } = useAuth(); // récupère restaurant_id
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const { data: analyticsData, loading } = useAnalyticsData(
    profile?.restaurant_id || '',
    timeRange
  );

  if (loading) return <LoadingSpinner />;
  if (!analyticsData) return <ErrorState />;

  // Utiliser analyticsData au lieu de REVENUE_DATA
  return (
    <div className="space-y-8">
      {/* ... composants avec analyticsData.revenues, analyticsData.topDishes ... */}
    </div>
  );
}
```

### Base de données à vérifier
- Table `analytics_events` : ✅ EXISTE (colonnes: id, restaurant_id, user_id, event_name, properties, created_at)
- RLS Policies: ❌ MANQUANTES (0 policies actuellement)
- Triggers pour enregistrer les événements: ❌ À CRÉER

### Checklist de vérification

**Backend Supabase:**
- [ ] Créer une RLS policy pour que les restaurants voient leurs propres events
- [ ] Ajouter un trigger qui enregistre automatiquement les commandes comme `order_created` event
- [ ] Créer des vues SQL pour les KPIs (revenu total, nombre commandes, etc.)

**Frontend:**
- [ ] Créer le hook `useAnalyticsData`
- [ ] Modifier Analytics.tsx pour utiliser le hook
- [ ] Ajouter états loading/error
- [ ] Tester avec différentes timerange

**Test:**
```bash
# Vérifier la table analytics_events
SELECT COUNT(*) FROM analytics_events;
SELECT DISTINCT event_name FROM analytics_events;

# Vérifier les RLS
SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'analytics_events';
```

---

## 🔴 PROBLÈME 2: Format USSD Non Modifiable

### Description
- Format USSD actuellement en dur: `*880*CODE*MONTANT#`
- Pas d'interface pour modifier le format (par ex: `*895*CODE*MONTANT#`)
- Les restaurants ne peuvent pas adapter leurs codes USSD

### Fichiers impliqués
```
📄 src/pages/admin/Settings.tsx (ligne 52-54)
🗄️ table restaurants (colonnes: ussd_mtn, ussd_moov, ussd_celtiis)
📄 src/pages/admin/PaymentMethodsAdmin.tsx
```

### Architecture actuelle
```typescript
// Settings.tsx - Ligne 52-54 (MAUVAIS)
ussd_mtn: '',      // juste le code, pas le FORMAT
ussd_moov: '',
ussd_celtiis: '',
```

### Causes identifiées

#### ❌ Cause 1: Format en dur dans le code
- Format hardcodé lors du paiement USSD (probablement dans useOrderManager ou similar)
- Aucune configuration stockée en base de données

#### ❌ Cause 2: Colonnes restaurants insuffisantes
- `ussd_mtn/moov/celtiis` stocke seulement le CODE
- Pas de colonne pour le FORMAT ou le TEMPLATE

#### ❌ Cause 3: Pas d'interface de configuration
- Page Settings.tsx ne montre pas d'option pour modifier le format
- Aucun formulaire pour éditer les templates USSD

### Solutions techniques

#### ✅ Solution 2.1: Migrer la structure de données
```sql
-- scripts/015-ussd-format-config.sql (À CRÉER)

-- 1. Ajouter colonne template à payment_methods
ALTER TABLE payment_methods 
ADD COLUMN IF NOT EXISTS ussd_template VARCHAR(255) DEFAULT '*880*{CODE}*{AMOUNT}#';

-- 2. Ajouter des templates prédéfinis
UPDATE payment_methods 
SET ussd_template = '*880*{CODE}*{AMOUNT}#'
WHERE code = 'mtn' AND ussd_template IS NULL;

UPDATE payment_methods 
SET ussd_template = '*895*{CODE}*{AMOUNT}#'
WHERE code = 'moov' AND ussd_template IS NULL;

UPDATE payment_methods 
SET ussd_template = '*140*{CODE}*{AMOUNT}#'
WHERE code = 'celtiis' AND ussd_template IS NULL;

-- 3. Index pour performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_template ON payment_methods(code);
```

#### ✅ Solution 2.2: Interface de configuration dans Settings
```typescript
// src/pages/admin/Settings.tsx - À AJOUTER dans le tab "Paiements USSD"

function USSDConfigSection() {
  const [templates, setTemplates] = useState({
    mtn: '*880*{CODE}*{AMOUNT}#',
    moov: '*895*{CODE}*{AMOUNT}#',
    celtiis: '*140*{CODE}*{AMOUNT}#',
  });

  const handleSaveTemplate = async (provider: string, template: string) => {
    // Valider le template
    if (!template.includes('{CODE}') || !template.includes('{AMOUNT}')) {
      alert('Template doit contenir {CODE} et {AMOUNT}');
      return;
    }

    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({ ussd_template: template })
        .eq('code', provider);

      if (error) throw error;
      alert('Format USSD mis à jour');
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-bold">Configuration Format USSD</h3>
      
      {Object.entries(templates).map(([provider, template]) => (
        <div key={provider} className="border rounded-lg p-4">
          <label className="block font-semibold capitalize mb-2">{provider}</label>
          
          {/* Preview */}
          <div className="bg-zinc-100 p-3 rounded mb-3 text-sm font-mono">
            Preview: {template
              .replace('{CODE}', 'ABC123')
              .replace('{AMOUNT}', '5000')}
          </div>

          {/* Input */}
          <input
            type="text"
            value={template}
            onChange={(e) => setTemplates({...templates, [provider]: e.target.value})}
            placeholder="Ex: *880*{CODE}*{AMOUNT}#"
            className="w-full border rounded-lg px-3 py-2 mb-2 font-mono text-sm"
          />

          {/* Aide */}
          <p className="text-xs text-zinc-500 mb-3">
            Utilisez &#123;CODE&#125; pour le code USSD et &#123;AMOUNT&#125; pour le montant
          </p>

          {/* Bouton save */}
          <button
            onClick={() => handleSaveTemplate(provider, template)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold"
          >
            Enregistrer
          </button>
        </div>
      ))}
    </div>
  );
}
```

#### ✅ Solution 2.3: Utiliser le template au moment du paiement
```typescript
// src/hooks/useOrderManager.ts - À MODIFIER

export function useOrderManager() {
  // ... code existant ...

  const generateUSSDCode = async (
    provider: 'mtn' | 'moov' | 'celtiis',
    amount: number,
    code: string // CODE généré pour cette commande
  ) => {
    try {
      // Récupérer le template du provider
      const { data: paymentMethod, error } = await supabase
        .from('payment_methods')
        .select('ussd_template')
        .eq('code', provider)
        .single();

      if (error) throw error;

      const template = paymentMethod?.ussd_template || '*880*{CODE}*{AMOUNT}#';
      
      // Remplacer les placeholders
      const ussdCode = template
        .replace('{CODE}', code)
        .replace('{AMOUNT}', amount.toString());

      return ussdCode;
    } catch (error) {
      console.error('Error generating USSD code:', error);
      return null;
    }
  };

  return { generateUSSDCode, /* ... autres exports ... */ };
}
```

### Checklist de vérification

**Database:**
- [ ] Créer et exécuter la migration `015-ussd-format-config.sql`
- [ ] Vérifier que `payment_methods.ussd_template` est bien rempli
- [ ] Ajouter des templates par défaut pour chaque provider

**Frontend:**
- [ ] Créer le composant `USSDConfigSection`
- [ ] Intégrer dans Settings.tsx au tab "Paiements USSD"
- [ ] Tester la modification du template
- [ ] Vérifier que le preview fonctionne

**Paiement:**
- [ ] Modifier `useOrderManager.ts` pour utiliser `generateUSSDCode`
- [ ] Tester avec différents templates
- [ ] Vérifier que le code USSD généré correspond au template

---

## 🔴 PROBLÈME 3: Restaurants ne Créent Pas de Comptes/Menus

### Description
- Les restaurants ne peuvent pas créer de comptes (accès bloqué?)
- Pas de possibilité de créer des menus/catégories
- Erreurs d'accès ou formulaires manquants

### Causes possibles identifiées

#### ❌ Cause 1: Permissions RLS incorrectes
- Table `restaurants`: RLS policies existantes mais restrictives
- Les `restaurant_owner` ne peuvent peut-être pas insérer

```sql
-- Vérifier les policies actuelles
SELECT * FROM pg_policies WHERE tablename = 'restaurants';
```

#### ❌ Cause 2: Formulaire de création manquant
- Pas de page `/restaurant/setup` ou `/admin/create-menu`
- L'onboarding n'existe peut-être pas

#### ❌ Cause 3: Validation côté serveur trop stricte
- Fields obligatoires manquants
- Validations échouent silencieusement

### Solutions techniques

#### ✅ Solution 3.1: Créer la page de Setup Restaurant
```typescript
// src/pages/RestaurantSetup.tsx (À CRÉER)
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function RestaurantSetup() {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    phone: '',
    cuisine_type: 'local',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Vérifier que tous les champs requis sont remplis
      if (!formData.name || !formData.address || !formData.city) {
        setError('Tous les champs marqués * sont obligatoires');
        setLoading(false);
        return;
      }

      const slug = formData.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const { data, error: insertError } = await supabase
        .from('restaurants')
        .insert({
          name: formData.name,
          slug,
          description: formData.description,
          address: formData.address,
          city: formData.city,
          phone: formData.phone || null,
          cuisine_type: formData.cuisine_type,
          owner_id: profile?.id,
          is_active: false, // À valider par admin
          is_open: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Lier le restaurant au profil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ restaurant_id: data.id })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      alert('Restaurant créé avec succès!');
      window.location.href = '/admin/menu'; // Rediriger
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Créer mon restaurant</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block font-bold mb-2">Nom du restaurant *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full border rounded-lg px-4 py-2"
            placeholder="Ex: Restaurant La Saveur"
            required
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full border rounded-lg px-4 py-2"
            placeholder="Décrivez votre restaurant..."
            rows={4}
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Adresse *</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
            className="w-full border rounded-lg px-4 py-2"
            placeholder="Ex: 123 Rue Principale"
            required
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Ville *</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({...formData, city: e.target.value})}
            className="w-full border rounded-lg px-4 py-2"
            placeholder="Ex: Yaoundé"
            required
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Téléphone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            className="w-full border rounded-lg px-4 py-2"
            placeholder="Ex: +237 6 XX XX XX XX"
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Type de cuisine</label>
          <select
            value={formData.cuisine_type}
            onChange={(e) => setFormData({...formData, cuisine_type: e.target.value})}
            className="w-full border rounded-lg px-4 py-2"
          >
            <option value="local">Cuisine locale</option>
            <option value="pizza">Pizzeria</option>
            <option value="kebab">Kebab</option>
            <option value="seafood">Fruits de mer</option>
            <option value="other">Autre</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-3 rounded-lg disabled:opacity-50"
        >
          {loading ? 'Création en cours...' : 'Créer mon restaurant'}
        </button>
      </form>
    </div>
  );
}
```

#### ✅ Solution 3.2: Page de gestion des menus/catégories
```typescript
// src/pages/admin/MenuManager.tsx (À CRÉER - partie simplifiée)
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function MenuManager() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id;
  const [categories, setCategories] = useState([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (restaurantId) fetchCategories();
  }, [restaurantId]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('Veuillez entrer un nom');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          restaurant_id: restaurantId,
          name: newCategoryName,
          sort_order: (categories.length || 0) + 1,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories([...categories, data]);
      setNewCategoryName('');
      setShowAddCategory(false);
    } catch (error) {
      alert('Erreur: ' + (error as Error).message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Gérer mon menu</h1>

      <div className="space-y-4">
        {categories.map((category: any) => (
          <div key={category.id} className="border rounded-lg p-4">
            <h3 className="font-bold text-lg">{category.name}</h3>
            <p className="text-sm text-zinc-600">{category.items_count || 0} articles</p>
          </div>
        ))}
      </div>

      {showAddCategory ? (
        <div className="mt-6 border rounded-lg p-4 bg-zinc-50">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nom de la catégorie (ex: Plats)"
            className="w-full border rounded-lg px-4 py-2 mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddCategory}
              className="px-4 py-2 bg-primary text-white rounded-lg font-bold"
            >
              Créer
            </button>
            <button
              onClick={() => setShowAddCategory(false)}
              className="px-4 py-2 border rounded-lg"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddCategory(true)}
          className="mt-6 w-full py-3 border-2 border-primary rounded-lg text-primary font-bold hover:bg-primary/5"
        >
          + Ajouter une catégorie
        </button>
      )}
    </div>
  );
}
```

#### ✅ Solution 3.3: Vérifier et corriger les RLS policies
```sql
-- scripts/016-fix-restaurant-creation-permissions.sql (À CRÉER)

-- 1. Vérifier les policies existantes
SELECT * FROM pg_policies WHERE tablename = 'restaurants';

-- 2. Garantir que restaurant_owner peut créer son restaurant
DROP POLICY IF EXISTS "owner_insert_restaurant" ON restaurants;
CREATE POLICY "owner_insert_restaurant" ON restaurants
FOR INSERT WITH CHECK (
  auth.uid() = owner_id
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'restaurant_owner'
);

-- 3. Garantir que restaurant_owner peut voir son restaurant
DROP POLICY IF EXISTS "owner_select_restaurant" ON restaurants;
CREATE POLICY "owner_select_restaurant" ON restaurants
FOR SELECT USING (
  auth.uid() = owner_id
  OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'manager')
);

-- 4. Pour les catégories
DROP POLICY IF EXISTS "owner_insert_categories" ON categories;
CREATE POLICY "owner_insert_categories" ON categories
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = categories.restaurant_id
    AND restaurants.owner_id = auth.uid()
  )
);
```

### Checklist de vérification

**Database:**
- [ ] Exécuter migration `016-fix-restaurant-creation-permissions.sql`
- [ ] Vérifier les RLS policies sur `restaurants`, `categories`, `items`
- [ ] S'assurer que `owner_id` n'est jamais NULL

**Frontend:**
- [ ] Créer RestaurantSetup.tsx
- [ ] Créer MenuManager.tsx
- [ ] Ajouter les routes dans App.tsx
- [ ] Tester la création de restaurant avec un account restaurant_owner

**Test:**
```bash
# Vérifier qu'un restaurant_owner peut créer un restaurant
SELECT * FROM restaurants WHERE owner_id = 'UUID_DE_TEST';

# Vérifier les RLS
SHOW ROLE;
```

---

## 🔴 PROBLÈME 4: Codes Promo Non Fonctionnels

### Description
- Codes promo créés dans le manager mais non appliqués lors du paiement
- Pas de réduction dans le panier/checkout
- Validation du code silencieuse/échouée

### Fichiers impliqués
```
📄 src/pages/admin/PromoManager.tsx (✅ création OK)
📄 src/pages/Cart.tsx (❌ application CODE PAS TROUVÉ)
📄 src/hooks/useOrderManager.ts (❌ intégration CODE MANQUANTE)
🗄️ scripts/009-promo-codes-and-order-type.sql (✅ table OK, mais validation?)
```

### Causes identifiées

#### ❌ Cause 1: Pas d'interface pour saisir le code dans le panier
- Cart.tsx n'a PAS d'input pour entrer un code promo
- L'utilisateur ne peut PAS appliquer de code

#### ❌ Cause 2: Pas de logique de validation côté frontend
- Pas de fonction qui valide et applique la réduction
- Pas d'appel à la fonction SQL `validate_promo_code()`

#### ❌ Cause 3: Pas d'intégration dans la création de commande
- `useOrderManager` ne lie pas `promo_code_id` à la commande
- La réduction n'est jamais calculée

### Solutions techniques

#### ✅ Solution 4.1: Ajouter input promo dans Cart
```typescript
// src/pages/Cart.tsx - À AJOUTER dans la section "Récapitulatif"

const [promoCode, setPromoCode] = useState('');
const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
const [promoLoading, setPromoLoading] = useState(false);
const [promoError, setPromoError] = useState<string | null>(null);

// Interface pour typage
interface PromoCode {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number | null;
  used_count: number;
  max_uses: number | null;
  is_active: boolean;
  expires_at: string | null;
}

// Fonction pour appliquer le code
const handleApplyPromo = async () => {
  if (!promoCode.trim()) return;

  setPromoLoading(true);
  setPromoError(null);

  try {
    // Récupérer le code promo
    const { data: promo, error: fetchError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', promoCode.toUpperCase())
      .eq('restaurant_id', restaurantId) // OU match le restaurant du panier
      .single();

    if (fetchError || !promo) {
      setPromoError('Code invalide ou expiré');
      setPromoLoading(false);
      return;
    }

    // Valider les conditions
    if (!promo.is_active) {
      setPromoError('Ce code n\'est pas actif');
      setPromoLoading(false);
      return;
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      setPromoError('Ce code a expiré');
      setPromoLoading(false);
      return;
    }

    if (promo.max_uses && promo.used_count >= promo.max_uses) {
      setPromoError('Ce code a atteint sa limite d\'utilisation');
      setPromoLoading(false);
      return;
    }

    // Vérifier le montant minimum
    if (promo.min_order_amount && subtotal < promo.min_order_amount) {
      setPromoError(`Montant minimum: ${promo.min_order_amount} FCFA`);
      setPromoLoading(false);
      return;
    }

    // Code valide!
    setAppliedPromo(promo);
    setPromoCode('');
  } catch (error) {
    setPromoError('Erreur lors de la vérification du code');
    console.error(error);
  } finally {
    setPromoLoading(false);
  }
};

// Fonction pour retirer le code
const handleRemovePromo = () => {
  setAppliedPromo(null);
};

// JSX du formulaire promo (à ajouter dans la section "Récapitulatif")
return (
  <div className="space-y-4">
    {/* ... autres sections ... */}

    {/* Formulaire Code Promo */}
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
      <label className="block text-sm font-bold text-blue-900 mb-2">
        Avez-vous un code promo? 🎉
      </label>

      {appliedPromo ? (
        // Afficher le code appliqué
        <div className="flex items-center justify-between bg-white rounded-lg p-3 mb-3">
          <div>
            <p className="font-bold text-green-600">{appliedPromo.code}</p>
            <p className="text-xs text-zinc-600">
              {appliedPromo.discount_type === 'percent'
                ? `-${appliedPromo.discount_value}%`
                : `-${appliedPromo.discount_value} FCFA`}
            </p>
          </div>
          <button
            onClick={handleRemovePromo}
            className="text-red-500 hover:text-red-700 font-bold"
          >
            ✕
          </button>
        </div>
      ) : (
        // Formulaire pour entrer le code
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => {
              setPromoCode(e.target.value.toUpperCase());
              setPromoError(null);
            }}
            placeholder="Ex: SUMMER20"
            disabled={promoLoading}
            className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleApplyPromo}
            disabled={promoLoading || !promoCode.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-blue-700"
          >
            {promoLoading ? 'Vérification...' : 'Appliquer'}
          </button>
        </div>
      )}

      {promoError && (
        <p className="text-xs text-red-600 font-semibold">{promoError}</p>
      )}
    </div>

    {/* Récapitulatif avec réduction */}
    <div className="space-y-2 border-t pt-4">
      <div className="flex justify-between text-sm">
        <span>Sous-total</span>
        <span className="font-bold">{subtotal.toLocaleString()} FCFA</span>
      </div>

      {/* Afficher la réduction si promo appliqué */}
      {appliedPromo && (
        <div className="flex justify-between text-sm text-green-600">
          <span>
            Réduction ({appliedPromo.code})
          </span>
          <span className="font-bold">
            -
            {appliedPromo.discount_type === 'percent'
              ? Math.round(subtotal * (appliedPromo.discount_value / 100))
              : appliedPromo.discount_value}
            {' FCFA'}
          </span>
        </div>
      )}

      {/* Frais livraison */}
      {orderMode === 'delivery' && (
        <div className="flex justify-between text-sm">
          <span>Frais livraison</span>
          <span className="font-bold">{deliveryFee.toLocaleString()} FCFA</span>
        </div>
      )}

      {/* Total */}
      <div className="flex justify-between text-lg font-bold border-t pt-2">
        <span>Total</span>
        <span>
          {(
            subtotal -
            (appliedPromo
              ? appliedPromo.discount_type === 'percent'
                ? Math.round(subtotal * (appliedPromo.discount_value / 100))
                : appliedPromo.discount_value
              : 0) +
            (orderMode === 'delivery' ? deliveryFee : 0)
          ).toLocaleString()}{' FCFA'}
        </span>
      </div>
    </div>

    {/* Bouton commander */}
    <button
      onClick={handleCheckout}
      disabled={!cartItems.length || loading}
      className="w-full bg-primary text-white font-bold py-4 rounded-xl disabled:opacity-50"
    >
      {loading ? 'Traitement...' : 'Commander'}
    </button>
  </div>
);
```

#### ✅ Solution 4.2: Intégrer la réduction dans useOrderManager
```typescript
// src/hooks/useOrderManager.ts - À MODIFIER

export function useOrderManager() {
  // ... code existant ...

  const createOrder = async (
    restaurantId: string,
    items: CartItem[],
    orderMode: OrderMode,
    promoCodeId?: string | null,
    promoCode?: PromoCode | null
  ) => {
    try {
      // Calculer la réduction
      let discount = 0;
      if (promoCode) {
        if (promoCode.discount_type === 'percent') {
          discount = Math.round(subtotal * (promoCode.discount_value / 100));
        } else {
          discount = promoCode.discount_value;
        }
      }

      const totalAmount = subtotal - discount + (orderMode === 'delivery' ? deliveryFee : 0);

      // Créer la commande
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId,
          customer_id: profile?.id,
          order_type: orderMode,
          subtotal: subtotal,
          discount: discount,
          delivery_fee: orderMode === 'delivery' ? deliveryFee : 0,
          total_amount: totalAmount,
          promo_code_id: promoCodeId || null,
          promo_code: promoCode?.code || null,
          status: 'pending',
          // ... autres champs ...
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Incrémenter le used_count du promo code
      if (promoCodeId) {
        await supabase
          .from('promo_codes')
          .update({ used_count: promo.used_count + 1 })
          .eq('id', promoCodeId);
      }

      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  };

  return { createOrder, /* ... autres exports ... */ };
}
```

#### ✅ Solution 4.3: Passer le promo code au checkout
```typescript
// src/pages/EventCheckout.tsx ou checkout logic

const handleCheckout = async () => {
  if (!appliedPromo) {
    console.warn('No promo applied');
  }

  const order = await createOrder(
    restaurantId,
    cartItems,
    orderMode,
    appliedPromo?.id, // promoCodeId
    appliedPromo      // promoCode object
  );

  // Rediriger vers payment
  navigate(`/payment/${order.id}`);
};
```

### Checklist de vérification

**Database:**
- [ ] Vérifier la table `promo_codes` a bien les colonnes requises
- [ ] Vérifier la fonction `validate_promo_code()` existe et fonctionne
- [ ] Tester: `SELECT * FROM validate_promo_code('CODE123', 5000);`

**Frontend:**
- [ ] Ajouter l'input promo dans Cart.tsx
- [ ] Implémenter `handleApplyPromo()` et `handleRemovePromo()`
- [ ] Modifier `useOrderManager.ts` pour passer `promo_code_id` à la commande
- [ ] Tester avec un code promo valide

**Test:**
```sql
-- Créer un code test
INSERT INTO promo_codes (
  code, restaurant_id, discount_type, discount_value,
  is_active, min_order_amount, max_uses
) VALUES (
  'TEST20', 'restaurant-uuid', 'percent', 20, true, 5000, NULL
);

-- Vérifier l'utilisation
SELECT code, used_count, max_uses FROM promo_codes WHERE code = 'TEST20';
```

---

## 🔴 PROBLÈME 5: Création d'Équipe - Champs Manquants Non Affichés

### Description
- Erreur: "Certains champs obligatoires manquent"
- Aucun champ supplémentaire n'apparaît dans le formulaire
- L'utilisateur ne sait pas quoi remplir

### Causes possibles identifiées

#### ❌ Cause 1: Validation côté serveur trop stricte
- Les règles de validation ne correspondent pas aux champs affichés
- Exemple: validation require `shift_start`/`shift_end` mais champs pas affichés

#### ❌ Cause 2: Formulaire incomplet
- Pas tous les champs du form ne sont affichés
- HTML conditionnel cache les champs nécessaires

#### ❌ Cause 3: Messages d'erreur génériques
- Erreur dit "champs manquants" sans préciser lesquels
- Pas de guide pour l'utilisateur

### Solutions techniques

#### ✅ Solution 5.1: Créer un formulaire d'équipe robuste
```typescript
// src/pages/admin/TeamManager.tsx (À CRÉER)
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Users, Plus, Mail, Lock, Briefcase, Clock, AlertCircle } from 'lucide-react';

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  role: 'manager' | 'staff' | 'delivery';
  shift_start?: string;
  shift_end?: string;
}

const REQUIRED_FIELDS: Record<string, string> = {
  full_name: 'Nom complet',
  email: 'Email',
  phone: 'Téléphone',
  role: 'Rôle',
  shift_start: 'Heure de début',
  shift_end: 'Heure de fin',
};

export default function TeamManager() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id;

  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    email: '',
    phone: '',
    role: 'staff',
    shift_start: '09:00',
    shift_end: '18:00',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Tous les champs requis
    if (!formData.full_name?.trim()) {
      newErrors.full_name = 'Nom complet requis';
    }

    if (!formData.email?.trim()) {
      newErrors.email = 'Email requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.phone?.trim()) {
      newErrors.phone = 'Téléphone requis';
    }

    if (!formData.role) {
      newErrors.role = 'Rôle requis';
    }

    // Horaires requis pour les staff
    if (['staff', 'manager'].includes(formData.role)) {
      if (!formData.shift_start) {
        newErrors.shift_start = 'Heure de début requise';
      }
      if (!formData.shift_end) {
        newErrors.shift_end = 'Heure de fin requise';
      }

      // Valider que fin > début
      if (
        formData.shift_start &&
        formData.shift_end &&
        formData.shift_start >= formData.shift_end
      ) {
        newErrors.shift_end = 'L\'heure de fin doit être après le début';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return; // Les erreurs sont affichées
    }

    setLoading(true);
    setSuccess(null);

    try {
      // 1. Créer le profil/utilisateur
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: formData.email,
        password: `TempPassword${Math.random().toString(36).substring(7)}`, // Mot de passe temporaire
      });

      if (signupError) throw signupError;
      if (!signupData.user) throw new Error('User creation failed');

      // 2. Créer ou mettre à jour le profil
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: signupData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          restaurant_id: restaurantId,
        });

      if (profileError) throw profileError;

      // 3. Ajouter à la table restaurant_staff avec horaires
      const { error: staffError } = await supabase
        .from('restaurant_staff')
        .insert({
          restaurant_id: restaurantId,
          profile_id: signupData.user.id,
          role: formData.role,
          shift_start: formData.shift_start || null,
          shift_end: formData.shift_end || null,
          is_active: true,
        });

      if (staffError) throw staffError;

      setSuccess(`${formData.full_name} a été ajouté à l'équipe!`);

      // Réinitialiser le formulaire
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        role: 'staff',
        shift_start: '09:00',
        shift_end: '18:00',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      setErrors({ submit: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8" />
        <h1 className="text-3xl font-bold">Gérer mon équipe</h1>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg font-semibold">
          ✓ {success}
        </div>
      )}

      {errors.submit && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Erreur</p>
            <p className="text-sm">{errors.submit}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-xl p-6 border">
        {/* Nom complet */}
        <div>
          <label className="block font-bold mb-2 text-red-600">
            Nom complet <span>*</span>
          </label>
          <input
            type="text"
            value={formData.full_name}
            onChange={(e) => setFormData({...formData, full_name: e.target.value})}
            className={`w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${
              errors.full_name
                ? 'border-red-500 focus:ring-red-200'
                : 'border-zinc-200 focus:ring-primary/20'
            }`}
            placeholder="Ex: Jean Dupont"
          />
          {errors.full_name && (
            <p className="text-red-600 text-sm mt-1">{errors.full_name}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block font-bold mb-2 text-red-600 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email <span>*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className={`w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${
              errors.email
                ? 'border-red-500 focus:ring-red-200'
                : 'border-zinc-200 focus:ring-primary/20'
            }`}
            placeholder="jean@exemple.com"
          />
          {errors.email && (
            <p className="text-red-600 text-sm mt-1">{errors.email}</p>
          )}
        </div>

        {/* Téléphone */}
        <div>
          <label className="block font-bold mb-2 text-red-600">
            Téléphone <span>*</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            className={`w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${
              errors.phone
                ? 'border-red-500 focus:ring-red-200'
                : 'border-zinc-200 focus:ring-primary/20'
            }`}
            placeholder="+237 6 XX XX XX XX"
          />
          {errors.phone && (
            <p className="text-red-600 text-sm mt-1">{errors.phone}</p>
          )}
        </div>

        {/* Rôle */}
        <div>
          <label className="block font-bold mb-2 text-red-600 flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Rôle <span>*</span>
          </label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({...formData, role: e.target.value as any})}
            className="w-full border border-zinc-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="staff">Personnel (Cuisine/Service)</option>
            <option value="manager">Gestionnaire</option>
            <option value="delivery">Livreur</option>
          </select>
          {errors.role && (
            <p className="text-red-600 text-sm mt-1">{errors.role}</p>
          )}
        </div>

        {/* Horaires - affichés conditionnellement */}
        {['staff', 'manager'].includes(formData.role) && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Horaires de travail
              </p>

              {/* Heure de début */}
              <div className="mb-4">
                <label className="block font-bold mb-2 text-red-600">
                  Heure de début <span>*</span>
                </label>
                <input
                  type="time"
                  value={formData.shift_start || '09:00'}
                  onChange={(e) => setFormData({...formData, shift_start: e.target.value})}
                  className={`w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${
                    errors.shift_start
                      ? 'border-red-500 focus:ring-red-200'
                      : 'border-zinc-200 focus:ring-primary/20'
                  }`}
                />
                {errors.shift_start && (
                  <p className="text-red-600 text-sm mt-1">{errors.shift_start}</p>
                )}
              </div>

              {/* Heure de fin */}
              <div>
                <label className="block font-bold mb-2 text-red-600">
                  Heure de fin <span>*</span>
                </label>
                <input
                  type="time"
                  value={formData.shift_end || '18:00'}
                  onChange={(e) => setFormData({...formData, shift_end: e.target.value})}
                  className={`w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${
                    errors.shift_end
                      ? 'border-red-500 focus:ring-red-200'
                      : 'border-zinc-200 focus:ring-primary/20'
                  }`}
                />
                {errors.shift_end && (
                  <p className="text-red-600 text-sm mt-1">{errors.shift_end}</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Bouton soumettre */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {loading ? 'Création en cours...' : 'Ajouter à l\'équipe'}
        </button>
      </form>

      {/* Aide */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <p className="font-bold text-blue-900 mb-2">💡 Aide</p>
        <ul className="space-y-1 text-blue-800">
          <li>• Les champs marqués <span className="text-red-600">*</span> sont obligatoires</li>
          <li>• Les horaires n'apparaissent que pour les rôles Staff/Manager</li>
          <li>• Les livreurs n'ont pas d'horaires fixes</li>
          <li>• Un email de confirmation sera envoyé au nouvel employé</li>
        </ul>
      </div>
    </div>
  );
}
```

#### ✅ Solution 5.2: Ajouter validation claire côté serveur
```sql
-- scripts/017-team-management-fixes.sql (À CRÉER)

-- 1. RLS policy pour restaurant_staff
ALTER TABLE restaurant_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_restaurant_manage" ON restaurant_staff;
CREATE POLICY "staff_restaurant_manage" ON restaurant_staff
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = restaurant_staff.restaurant_id
    AND (restaurants.owner_id = auth.uid() OR
         EXISTS (
           SELECT 1 FROM profiles p
           WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'manager')
         ))
  )
);

DROP POLICY IF EXISTS "staff_restaurant_read" ON restaurant_staff;
CREATE POLICY "staff_restaurant_read" ON restaurant_staff
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = restaurant_staff.restaurant_id
    AND (restaurants.owner_id = auth.uid() OR
         restaurant_staff.profile_id = auth.uid() OR
         EXISTS (
           SELECT 1 FROM profiles p
           WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'manager')
         ))
  )
);

-- 2. Trigger pour valider les horaires
CREATE OR REPLACE FUNCTION validate_staff_shifts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Valider que shift_end > shift_start
  IF NEW.shift_end IS NOT NULL AND NEW.shift_start IS NOT NULL THEN
    IF NEW.shift_end <= NEW.shift_start THEN
      RAISE EXCEPTION 'Heure de fin doit être après l''heure de début';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_staff_shifts ON restaurant_staff;
CREATE TRIGGER check_staff_shifts BEFORE INSERT OR UPDATE ON restaurant_staff
FOR EACH ROW EXECUTE FUNCTION validate_staff_shifts();
```

#### ✅ Solution 5.3: Ajouter la route dans App.tsx
```typescript
// src/App.tsx - À AJOUTER dans les routes

import TeamManager from './pages/admin/TeamManager';

// Dans <Routes>:
<Route path="/admin/team" element={<ProtectedRoute requiredRole="restaurant_owner">
  <TeamManager />
</ProtectedRoute>} />
```

### Checklist de vérification

**Database:**
- [ ] Exécuter `017-team-management-fixes.sql`
- [ ] Vérifier que `restaurant_staff` a les colonnes: profile_id, role, shift_start, shift_end
- [ ] Vérifier les RLS policies sur `restaurant_staff`

**Frontend:**
- [ ] Créer TeamManager.tsx avec tous les champs
- [ ] Implémenter la validation complète
- [ ] Afficher les erreurs pour CHAQUE champ
- [ ] Afficher/cacher les horaires selon le rôle

**Test:**
```sql
-- Vérifier la structure
\d restaurant_staff

-- Vérifier les RLS
SELECT * FROM pg_policies WHERE tablename = 'restaurant_staff';

-- Tester l'insertion
INSERT INTO restaurant_staff (restaurant_id, profile_id, role, shift_start, shift_end, is_active)
VALUES ('restaurant-uuid', 'profile-uuid', 'staff', '09:00', '18:00', true);
```

---

## 📋 RÉSUMÉ DES FICHIERS À CRÉER/MODIFIER

### À CRÉER (Nouveaux fichiers):
1. `src/hooks/useAnalyticsData.ts` - Hook pour charger les analytics
2. `src/pages/RestaurantSetup.tsx` - Création de restaurant
3. `src/pages/admin/MenuManager.tsx` - Gestion du menu
4. `src/pages/admin/TeamManager.tsx` - Gestion de l'équipe

### À MODIFIER:
1. `src/pages/admin/Analytics.tsx` - Intégrer le hook useAnalyticsData
2. `src/pages/admin/Settings.tsx` - Ajouter configuration format USSD
3. `src/pages/Cart.tsx` - Ajouter interface code promo + application
4. `src/hooks/useOrderManager.ts` - Intégrer promo_code_id et discount
5. `src/App.tsx` - Ajouter les 4 nouvelles routes

### À CRÉER (Scripts SQL):
1. `scripts/015-ussd-format-config.sql` - Configuration format USSD
2. `scripts/016-fix-restaurant-creation-permissions.sql` - RLS restaurant/categories
3. `scripts/017-team-management-fixes.sql` - RLS restaurant_staff + validation

---

## ✅ CONCLUSIONS

**Problème 1 (Analytics):** Données hardcodées + pas de hook → Créer `useAnalyticsData` + intégrer  
**Problème 2 (Format USSD):** Format en dur + pas de config → Ajouter `ussd_template` à payment_methods + UI  
**Problème 3 (Restaurant/Menus):** Pas d'interface + RLS confuses → Créer RestaurantSetup + MenuManager + fixer RLS  
**Problème 4 (Codes Promo):** Pas d'input + pas de logique → Ajouter promo input dans Cart + intégrer useOrderManager  
**Problème 5 (Équipe):** Champs cachés + erreurs génériques → Créer TeamManager avec validation claire + horaires conditionnels

Tous les problèmes peuvent être résolus avec les solutions ci-dessus. Priorité: **Problèmes 3, 4, 5** (bloquent la fonctionnalité).
