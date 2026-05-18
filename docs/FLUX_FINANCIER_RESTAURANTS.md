# 💰 Flux Financier Restafy - Comment l'argent arrive aux restaurants

## 🎯 Vue d'ensemble du flux

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   CLIENT    │────▶│  GENIUS PAY  │────▶│   RESTAFY   │────▶│ RESTAURANT  │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
     Paiement            Encaissement        Distribution         Reçu
   Mobile Money            (1%+100 XOF)      (Compte Resto)
```

---

## 🔄 Étape par étape

### **1. Paiement Client**
```
Client → Genius Pay (Wave, Orange Money, MTN, etc.)
```
- Le client paie via Mobile Money ou carte
- L'argent va directement chez **Genius Pay** (agrégateur)
- **Délai** : Instantané (quelques secondes)

### **2. Traitement par Genius Pay**
```
Genius Pay → Traitement → Mise à disposition
```
**Frais déduits automatiquement :**
| Frais | Montant |
|-------|---------|
| Commission Genius Pay | 1% du montant |
| Frais fixes | 100 XOF |
| Frais opérateur | ~150 XOF (estimé) |

**Exemple sur 10 000 XOF :**
- Commission (1%) : 100 XOF
- Frais fixes : 100 XOF
- Frais opérateur : ~150 XOF
- **Total frais** : ~350 XOF
- **Net reçu** : ~9 650 XOF

### **3. Crédit sur compte Genius Pay Restaurant**

**Option A : Compte Genius Pay direct (Recommandé)**
```
Restaurant a un compte Genius Pay Business
↓
Argent crédité sur leur dashboard Genius Pay
↓
Retrait vers compte bancaire ou Mobile Money
```

**Option B : Compte Restafy (Intermédiaire)**
```
Argent collecté par Restafy
↓
Retrait périodique vers le restaurant
↓
Virement ou Mobile Money
```

---

## ⏱️ Délais de transfert

| Étape | Délais |
|-------|--------|
| Paiement client → Confirmation | **Instantané** (2-5 secondes) |
| Confirmation → Disponibilité | **Immédiat** (dashboard Genius Pay) |
| Dashboard → Retrait compte banque | **24-48h** (selon méthode) |
| Dashboard → Mobile Money | **Instantané** (si même opérateur) |

---

## 🏦 Configuration compte Restaurant

### **Pour que l'argent arrive directement au restaurant :**

#### 1. **Restaurant crée compte Genius Pay Business**
```
https://geniuspay.ci → Inscription Business
```
**Documents requis :**
- RCCM (Registre du Commerce)
- IFU (Identifiant Fiscal Unique)
- Pièce d'identité du représentant légal
- Justificatif de domicile

#### 2. **Récupération clés API**
```
Dashboard Genius Pay → API → Clés
↓
Merchant ID: merch_xxx
Public Key: pk_live_xxx
Secret Key: sk_live_xxx
```

#### 3. **Configuration dans Restafy**
```sql
-- Lier le compte Genius Pay au restaurant
UPDATE restaurants
SET geniuspay_merchant_id = 'merch_restaurant_xxx',
    geniuspay_public_key = 'pk_live_xxx',
    geniuspay_secret_key = 'sk_live_xxx',
    payout_method = 'direct_geniuspay',
    updated_at = NOW()
WHERE id = 'uuid-restaurant';
```

---

## 💳 Méthodes de retrait pour restaurants

### **1. Mobile Money (Recommandé pour petits montants)**
- **Délai** : Instantané
- **Frais** : 0-1% selon opérateur
- **Plafond** : 5 000 000 FCFA/jour (selon opérateur)

### **2. Virement bancaire**
- **Délai** : 24-48h ouvrés
- **Frais** : ~2 000-5 000 FCFA
- **Plafond** : Illimité

### **3. Compte virtuels / Wallets**
- **Wave** : Instantané
- **Orange Money** : Instantané
- **MTN MoMo** : Instantané

---

## 📊 Tracking des paiements en base

### **Pour suivre où est l'argent :**

```sql
-- Voir tous les paiements d'un restaurant
SELECT 
  p.transaction_ref,
  p.amount,
  p.currency,
  p.status,
  p.method,
  p.created_at,
  p.confirmed_at,
  p.provider_response->>'geniuspay_status' as geniuspay_status,
  p.provider_response->>'payout_status' as payout_status,
  r.name as restaurant_name
FROM payments p
JOIN restaurants r ON p.restaurant_id = r.id
WHERE p.restaurant_id = 'uuid-restaurant'
ORDER BY p.created_at DESC;
```

### **Voir les revenus par période :**

```sql
-- Revenus du restaurant ce mois
SELECT 
  DATE_TRUNC('day', p.confirmed_at) as date,
  COUNT(*) as nb_transactions,
  SUM(p.amount) as total_encaisse,
  SUM(p.amount * 0.01 + 100) as frais_geniuspay,
  SUM(p.amount - (p.amount * 0.01 + 100)) as net_revenu
FROM payments p
WHERE p.restaurant_id = 'uuid-restaurant'
  AND p.status = 'confirmed'
  AND p.confirmed_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY DATE_TRUNC('day', p.confirmed_at)
ORDER BY date DESC;
```

---

## 🔧 Implémentation technique

### **Dans le webhook (`api/webhooks/geniuspay.ts`)**

Quand un paiement est confirmé, on doit :
1. Créditer le compte Genius Pay du restaurant
2. Ou marquer pour retrait périodique

```typescript
// Exemple de mise à jour après paiement confirmé
const { error: restaurantError } = await supabase
  .from('restaurants')
  .update({
    pending_payout_amount: supabase.rpc('increment', { 
      amount: data.amount - (data.amount * 0.01 + 100)
    }),
    last_payment_at: new Date().toISOString(),
  })
  .eq('id', data.metadata.restaurant_id);
```

### **Table pour suivre les retraits**

```sql
-- Créer table tracking des retraits
CREATE TABLE IF NOT EXISTS restaurant_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'XOF',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payout_method TEXT NOT NULL, -- 'mobile_money', 'bank_transfer', 'geniuspay_wallet'
  destination_info JSONB, -- { phone: 'xxx', bank_account: 'xxx', etc }
  geniuspay_payout_id TEXT,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_payouts_restaurant ON restaurant_payouts(restaurant_id);
CREATE INDEX idx_payouts_status ON restaurant_payouts(status);
```

---

## 🚨 Points d'attention

### **1. Sécurité**
- **Jamais** stocker les clés API en clair côté client
- Utiliser `SUPABASE_SERVICE_ROLE_KEY` pour les opérations sensibles
- Vérifier les signatures webhook

### **2. Compliance**
- KYC obligatoire pour les restaurants (>500 000 FCFA/mois)
- Factures automatiques pour les commissions
- Traçabilité fiscale

### **3. Support client**
```
Problème paiement → support@restafy.shop
Problème retrait → pay@genius.ci
Urgence → +225 XX XX XX XX
```

---

## ✅ Résumé rapide

| Question | Réponse |
|----------|---------|
| **Qui reçoit l'argent ?** | Genius Pay d'abord, puis le restaurant |
| **Quand ?** | Instantané sur Genius Pay, 24-48h en banque |
| **Combien de frais ?** | 1% + 100 XOF + ~150 XOF opérateur |
| **Comment retirer ?** | Mobile Money instantané ou virement 24-48h |
| **Plafond ?** | 5M/jour (MM), illimité (banque) |

---

**Besoin de configurer les retraits automatiques pour un restaurant spécifique ?**
