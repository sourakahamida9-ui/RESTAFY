# 🏪 Guide Complet : POS et Emails - Restafy

## Vue d'ensemble
Le POS (Point of Sale) de Restafy est conçu pour être **ultra-simple** - **zéro code**, **zéro configuration**. Il charge automatiquement les commandes du restaurant depuis la base de données et gère tout : paiement, notifications, emails.

---

## 📍 Accès au POS

**URL:** `/restaurant/dashboard/pos`

**Prérequis:**
- Être connecté avec un compte restaurant
- Le restaurant doit être **activé** (`is_active: true` dans la base de données)

**Qui peut accéder?**
- Restaurant owner (propriétaire du restaurant)
- Restaurant staff (si la permission est attribuée)

---

## 🎯 Flux POS Simplifié

### 1️⃣ Le restaurant ouvre le POS
```
Restaurant Admin
    ↓
Clique sur "Caisse POS"
    ↓
Le système charge automatiquement les commandes en attente
```

### 2️⃣ Les commandes s'affichent en temps réel

```
┌─────────────────────────────────────┐
│      COMMANDES EN ATTENTE (3)       │
├─────────────────────────────────────┤
│ #ORD001 - M. Salami - 12,500 FCFA   │
│ Items: 2x Sandwich + 1x Jus         │
│ Livraison à: Cocody, rue 254        │
│ [Accepter] [Rejeter]                │
├─────────────────────────────────────┤
│ #ORD002 - Mme Hamida - 8,300 FCFA   │
│ Items: 1x Plat + 2x Dessert         │
│ Sur place - Table 5                 │
│ [Accepter] [Rejeter]                │
└─────────────────────────────────────┘
```

### 3️⃣ Le restaurant accepte ou refuse

**Si ACCEPTER:**
- ✅ Statut passe à "confirming"
- 📧 Email de confirmation envoyé au client
- 📱 Notification push au client
- 🔔 Notification dans l'app client

**Si REJETER:**
- ❌ Statut passe à "cancelled"
- 📧 Email d'annulation envoyé
- 💰 Remboursement lancé automatiquement

### 4️⃣ Suivi de la commande

```
En Attente → Acceptée → En Préparation → Prête → En Livraison → Livrée
```

Le restaurant peut **changer le statut** directement dans le POS en glissant la commande ou en cliquant sur les boutons.

---

## 📧 Système d'Emails Automatique

### Quand les emails sont-ils envoyés?

| Événement | Email | Destinataire | Template |
|-----------|-------|--------------|----------|
| Commande créée | ✅ Confirmation | Client | `order_confirmation.html` |
| Restaurant accepte | ✅ Acceptée | Client | `order_accepted.html` |
| Restaurant rejette | ❌ Annulée | Client | `order_cancelled.html` |
| Commande prête | 🚚 Prête pour retrait | Client | `order_ready.html` |
| Livraison en cours | 📍 En route | Client | `delivery_started.html` |
| Commande livrée | 🎉 Livrée | Client | `order_delivered.html` |

### Contenu des Emails

**Email de Confirmation (Après paiement):**
```
Sujet: ✅ Votre commande #ORD001 est confirmée!

Bonjour M. Salami,

Merci d'avoir commandé chez nous!

📋 Détails de la commande:
- #ORD001
- 2x Sandwich Kébab: 5,000 FCFA
- 1x Jus Frais: 2,500 FCFA
- Frais de livraison: 1,000 FCFA
- Remise: -500 FCFA
───────────────────────────
TOTAL: 8,000 FCFA ✓

📍 Livraison à: Cocody, rue 254
⏱️ Estimation: 30-45 minutes

🎁 Vous avez gagné 4,000 points de fidélité!

🔗 Suivi en temps réel: [Lien de tracking]

Questions? Contactez-nous: +225 XX XX XX XX
```

**Email d'Acceptation (Restaurant accepte):**
```
Sujet: 🍽️ Votre commande est acceptée!

Bonjour M. Salami,

Excellente nouvelle! Le restaurant a accepté votre commande.

✅ Statut: En préparation
⏱️ Estimation mise à jour: 25-35 minutes

Vous recevrez un SMS quand votre commande sera prête!

🔗 Suivi: [Lien de tracking]
```

---

## ⚙️ Configuration des Emails

### API Brevo (Sendinblue)
L'envoi d'emails utilise **Brevo** (Sendinblue), une plateforme d'email marketing.

**Configuration requise:**
- ✅ API Key Brevo: `VITE_BREVO_API_KEY` (configurée)
- ✅ Email d'expédition: défini dans Brevo
- ✅ Domaine validé: pour éviter les emails en spam

**Vérifier que les emails sont bien envoyés:**
1. Créez une commande de test
2. Attendez 5-10 secondes
3. Vérifiez la boîte mail du client
4. Vérifiez les logs Brevo: https://app.brevo.com/logs

**Si les emails ne sont pas reçus:**
```
Causes possibles:
1. Clé API invalide ou expirée
2. Email de test en spam (ajouter à contacts)
3. Domaine non validé dans Brevo
4. Réseau client bloque les emails
5. Trigger de notification échoue (logs: check console)
```

---

## 🔄 Flux Complet: Du Paiement à la Livraison

```
Client effectue paiement (USSD/Mobile Money)
    ↓ [Webhook paiement]
    ↓
Statut: "pending" 
    ↓
📧 EMAIL #1: "Commande confirmée" → Client
📱 NOTIFICATION: "Commande reçue" → Client
    ↓
Restaurant ouvre le POS
    ↓
Restaurant clique "ACCEPTER"
    ↓
Statut: "confirmed"
    ↓
📧 EMAIL #2: "Acceptée en préparation" → Client
📱 NOTIFICATION: "En préparation" → Client
    ↓
Restaurant marque "En préparation"
    ↓
Statut: "preparing"
📱 NOTIFICATION: "Cuisson en cours" → Client
    ↓
Restaurant marque "Prête"
    ↓
Statut: "ready"
    ↓
📧 EMAIL #3: "Prête pour retrait/livraison" → Client
📱 NOTIFICATION: "Prête!" → Client
    ↓
Livreur accepte la commande
    ↓
Statut: "delivering"
    ↓
📧 EMAIL #4: "En route vers vous" → Client
📱 GPS en temps réel: [Lien de tracking]
    ↓
Livreur marque "Livrée"
    ↓
Statut: "delivered"
    ↓
📧 EMAIL #5: "Merci! Laissez un avis" → Client
🎁 +4000 POINTS DE FIDÉLITÉ → Client
```

---

## 🛠️ Troubleshooting

### Les commandes ne s'affichent pas?
```javascript
// Vérifier les logs:
console.log("[v0] Loading orders for restaurant:", restaurantId);

// Problème possible:
1. Restaurant n'est pas activé (is_active: false)
2. Restaurant ID manquant dans le profil
3. Pas de commandes en attente
```

### Les emails ne sont pas envoyés?
```javascript
// Vérifier dans la console:
- "[v0] Order confirmation email sent: true"
- "[v0] Email error (non-blocking): ..."

// Actions:
1. Vérifier VITE_BREVO_API_KEY dans .env
2. Vérifier la boîte spam
3. Consulter les logs Brevo
```

### Le POS est lent?
```javascript
// Raisons possibles:
1. Trop de commandes en attente (>100)
   → Implémenter pagination
2. Base de données surchargée
   → Vérifier les indices (indexes)
3. Connexion réseau lente
   → Vérifier la latence API
```

---

## 📊 Données Affichées dans le POS

Pour chaque commande, le POS affiche:

```json
{
  "id": "UUID",
  "order_id": "#ORD001",
  "customer": {
    "name": "M. Salami",
    "email": "salami@example.com",
    "phone": "+225..."
  },
  "items": [
    {
      "name": "Sandwich Kébab",
      "quantity": 2,
      "price": 2500
    }
  ],
  "delivery": {
    "type": "delivery",  // or "pickup", "dine_in"
    "address": "Cocody, rue 254",
    "table": null
  },
  "payment": {
    "method": "mobile_money",
    "status": "confirmed",
    "total": 8000,
    "timestamp": "2025-03-09T22:20:00Z"
  },
  "status": "pending",
  "created_at": "2025-03-09T22:20:00Z"
}
```

---

## 🚀 Optimisations Futures

- [ ] Notifications SMS (par Twilio)
- [ ] Impression automatique des reçus
- [ ] Caméra de reconnaissance des paiements
- [ ] Dashboard en temps réel avec graphiques
- [ ] Exportation des données (CSV/PDF)
- [ ] Multi-restaurants sur 1 POS

---

## 📞 Support

**Problème?** Consultez:
1. Les logs de la console (F12 → Console)
2. Les logs Supabase (Dashboard → Logs)
3. Les logs Brevo (app.brevo.com → Logs)
4. La documentation technique: `ARCHITECTURE_DYNAMIQUE.md`
