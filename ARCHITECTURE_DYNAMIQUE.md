# Architecture 100% Dynamique - Restafy

## Vue d'ensemble

L'application **Restafy** est maintenant entièrement dynamique. Toutes les configurations qui étaient auparavant **codées en dur** dans le code sont désormais stockées dans la base de données Supabase et peuvent être modifiées par les admins **sans redéploiement**.

---

## 1. Tables de Configuration

### 1.1 `payment_methods`
Gère toutes les méthodes de paiement disponibles.

**Champs:**
- `code` (VARCHAR UNIQUE) - Identifiant unique: `mobile_money`, `card`, `wallet`
- `name` - Nom affiché: "Mobile Money", "Carte Bancaire"
- `description` - Description courte
- `icon` - Nom de l'icône Lucide React
- `ussd_template` - Template USSD: `*384*8114*1*{amount}#`
- `is_active` - Activé/Désactivé
- `sort_order` - Ordre d'affichage
- `config` (JSONB) - Configuration additionnelle

**Exemple:**
```json
{
  "code": "mobile_money",
  "name": "Mobile Money",
  "description": "Paiement par code USSD",
  "ussd_template": "*384*8114*1*{amount}#",
  "is_active": true,
  "sort_order": 1
}
```

### 1.2 `order_modes`
Gère les modes de commande (livraison, retrait, sur place).

**Champs:**
- `code` - Identifiant unique: `delivery`, `pickup`, `dine_in`
- `name` - "Livraison", "Retrait", "Sur Place"
- `description` - Description
- `icon` - Icône Lucide React
- `is_active` - Activé/Désactivé
- `sort_order` - Ordre d'affichage
- `config` (JSONB) - Frais additionnels, délais, etc.

**Exemple:**
```json
{
  "code": "delivery",
  "name": "Livraison",
  "description": "Livraison à domicile",
  "icon": "truck",
  "is_active": true,
  "sort_order": 1,
  "config": {
    "delivery_fee": 2000,
    "min_order": 5000,
    "estimated_time_minutes": 30
  }
}
```

### 1.3 `app_features`
Gère les fonctionnalités de l'application.

**Champs:**
- `code` - `loyalty_points`, `recommendations`, `reviews`, `promotions`
- `name` - Nom de la fonctionnalité
- `description` - Description
- `is_enabled` - Activé/Désactivé globalement
- `config` (JSONB) - Configuration spécifique

**Exemple:**
```json
{
  "code": "loyalty_points",
  "name": "Programme de Fidélité",
  "is_enabled": true,
  "config": {
    "points_per_fcfa": 0.5,
    "redemption_ratio": 1000,
    "expiry_days": 365
  }
}
```

### 1.4 `notification_templates`
Templates de notifications (réutilisables).

**Champs:**
- `code` - Identifiant: `order_confirmed`, `payment_received`, etc.
- `title` - Titre de la notification
- `message` - Message avec placeholders: `{customer_name}`, `{order_id}`
- `emoji` - Emoji de la notification
- `type` - `order`, `payment`, `promotion`
- `is_active` - Activé/Désactivé

### 1.5 `system_settings`
Paramètres globaux de l'application.

**Champs:**
- `key` - Identifiant: `app_name`, `support_phone`, `commission_rate`
- `value` (JSONB) - Valeur (peut être complexe)
- `category` - `general`, `payment`, `delivery`, `notification`
- `is_public` - Accessible aux clients

---

## 2. Hooks de Configuration

### 2.1 `usePaymentMethods()`
```typescript
const { methods, loading, error, getMethodByCode } = usePaymentMethods();

// methods: PaymentMethod[]
// Utilisé dans: Cart.tsx, USSDIntegration.tsx, CheckoutModal.tsx
```

### 2.2 `useOrderModes()`
```typescript
const { modes, loading, error, getModeByCode } = useOrderModes();

// modes: OrderMode[]
// Utilisé dans: Cart.tsx pour le sélecteur de livraison
```

### 2.3 `useAppFeatures()`
```typescript
const { features, loading, isFeatureEnabled, getFeatureConfig } = useAppFeatures();

// Exemple: if (isFeatureEnabled('loyalty_points')) { ... }
```

### 2.4 `useSystemSettings()`
```typescript
const { settings, loading, getSetting } = useSystemSettings();

// Exemple: const appName = getSetting('app_name', 'Restafy');
```

---

## 3. Composants Refactorisés

### 3.1 Cart.tsx
**Avant:**
```typescript
const ORDER_MODES = [
  { id: 'delivery', label: 'Livraison', ... },
  { id: 'dine_in', label: 'Sur place', ... },
  { id: 'takeaway', label: 'À emporter', ... },
];
```

**Après:**
```typescript
const { modes: dynamicModes } = useOrderModes();
const uiModes = useMemo(() => 
  dynamicModes.map(mode => ({
    id: mode.code,
    label: mode.name,
    sub: mode.description,
  })),
  [dynamicModes]
);
```

### 3.2 USSDIntegration.tsx
**Avant:**
```typescript
const [providers] = useState([
  { id: 'mtn', name: 'MTN Mobile Money', ussd: '*880*', ... },
  { id: 'moov', name: 'Moov Money', ussd: '*155#1#1#', ... },
]);
```

**Après:**
```typescript
const { methods } = usePaymentMethods();
// Les données viennent directement de payment_methods
```

---

## 4. Panels d'Administration

### 4.1 Méthodes de Paiement
**Route:** `/superadmin/payment-methods`
**Permissions:** `super_admin`

**Fonctionnalités:**
- Voir tous les modes
- Activer/Désactiver
- Modifier le nom, description, template USSD
- Changer l'ordre d'affichage
- Supprimer

### 4.2 Modes de Commande
**Route:** `/superadmin/order-modes`
**Permissions:** `super_admin`

**Fonctionnalités:**
- Voir tous les modes
- Activer/Désactiver
- Modifier la description, l'ordre
- Configuration avancée (frais, délai, etc.)

---

## 5. Flux de Données

```
Utilisateur final (Client)
    ↓
Interface (Cart.tsx)
    ↓
Hook (useOrderModes(), usePaymentMethods())
    ↓
Supabase (order_modes, payment_methods tables)
    ↓
Admin modifie la configuration
    ↓
Hook met à jour automatiquement
    ↓
Interface se met à jour en temps réel
```

---

## 6. Avantages de cette Architecture

✅ **Zéro redéploiement** - Les admins peuvent modifier les configurations via l'UI
✅ **Scalabilité** - Facile d'ajouter de nouvelles méthodes/modes
✅ **Sécurité** - Les permissions sont contrôlées via RLS Supabase
✅ **Performance** - Les hooks cachent les données
✅ **Maintenabilité** - Un seul endroit pour les configurations
✅ **Multi-tenancy** - Chaque restaurant peut avoir ses propres configurations

---

## 7. Exemples d'Utilisation

### Ajouter une nouvelle méthode de paiement
1. Admin va sur `/superadmin/payment-methods`
2. Clique "Ajouter"
3. Remplit: Nom, Code, Template USSD, Ordre
4. Enregistre
5. ✅ La nouvelle méthode apparaît immédiatement dans le checkout

### Désactiver un mode de livraison
1. Admin va sur `/superadmin/order-modes`
2. Trouve "Livraison"
3. Clique le toggle "Actif"
4. ✅ Les clients ne voient plus cette option

### Modifier un template de notification
1. Admin va sur `/superadmin/system-settings` (à implémenter)
2. Modifie le message: "Bonjour {customer_name}, votre commande est prête!"
3. ✅ Les notifications utiliseront le nouveau texte

---

## 8. Points d'Extension Futurs

- `restaurant_settings` - Configuration par restaurant
- `payment_provider_secrets` - API keys pour les fournisseurs
- `delivery_zones` - Zones de livraison et frais
- `pricing_rules` - Stratégies de prix dynamiques
- `feature_toggles` - Contrôle granulaire des fonctionnalités par rôle

---

## Fichiers Modifiés/Créés

### Hooks créés:
- `/src/hooks/usePaymentMethods.ts`
- `/src/hooks/useOrderModes.ts`
- `/src/hooks/useAppFeatures.ts`
- `/src/hooks/useSystemSettings.ts`

### Pages créées:
- `/src/pages/admin/PaymentMethodsAdmin.tsx`
- `/src/pages/admin/OrderModesAdmin.tsx`

### Pages refactorisées:
- `/src/pages/Cart.tsx` - Utilise `useOrderModes()`
- `/src/pages/integrations/USSDIntegration.tsx` - Utilise `usePaymentMethods()`

### Routes ajoutées:
- `/superadmin/payment-methods`
- `/superadmin/order-modes`

---

## Données de démarrage

Les données suivantes sont prédéfinies dans la base:

```sql
-- Méthodes de paiement
INSERT INTO payment_methods (code, name, description, ussd_template, is_active, sort_order)
VALUES 
  ('mobile_money', 'Mobile Money', 'Paiement par code USSD', '*384*8114*1*{amount}#', true, 1),
  ('card', 'Carte Bancaire', 'Visa/Mastercard', NULL, true, 2),
  ('wallet', 'Portefeuille', 'Solde Restafy', NULL, true, 3);

-- Modes de commande
INSERT INTO order_modes (code, name, description, is_active, sort_order)
VALUES
  ('delivery', 'Livraison', 'Livraison à domicile', true, 1),
  ('pickup', 'Retrait', 'Retrait au restaurant', true, 2),
  ('dine_in', 'Sur Place', 'Manger au restaurant', true, 3);

-- Fonctionnalités
INSERT INTO app_features (code, name, description, is_enabled, config)
VALUES
  ('loyalty_points', 'Programme de Fidélité', 'Gagner et utiliser des points', true, '{"points_per_fcfa": 0.5}'),
  ('recommendations', 'Recommandations IA', 'Suggestions personnalisées', true, '{}'),
  ('reviews', 'Avis et Évaluations', 'Système d''avis client', true, '{}'),
  ('promotions', 'Promotions', 'Codes promo et offres', true, '{}');
```

---

**Version:** 1.0  
**Date:** 9 Mars 2026  
**Auteur:** Restafy Dev Team
