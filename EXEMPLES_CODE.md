## 📚 Exemples de Code - Comment Ajouter/Étendre

### 1. Ajouter une Nouvelle Méthode de Paiement

#### Option A: Via Admin Panel
```
1. Aller à /superadmin/payment-methods
2. Cliquer "Ajouter une méthode"
3. Remplir formulaire:
   - Code: "crypto_pay"
   - Nom: "Paiement Crypto"
   - USSD Template: (laisser vide pour crypto)
   - Est actif: ✓
4. Sauvegarder
5. Refresh le panier → nouveau paiement visible!
```

#### Option B: Directement dans la BD
```sql
INSERT INTO payment_methods (code, name, description, is_active, sort_order) 
VALUES ('crypto_pay', 'Bitcoin', 'Paiement en Bitcoin', true, 4);

-- Immédiatement visible dans usePaymentMethods()
```

---

### 2. Ajouter un Nouveau Mode de Livraison

#### Via Admin Panel (Recommandé)
```
1. /superadmin/order-modes
2. "Ajouter un mode"
3. Code: "drone"
4. Nom: "Livraison par Drone"
5. Description: "Livraison rapide par drone"
6. Sauvegarder
7. Le panier affichera automatiquement "Livraison par Drone"!
```

#### Via Code (Development)
```typescript
// Ajouter dans la seed data:
INSERT INTO order_modes (code, name, description, is_active, sort_order)
VALUES ('drone', 'Drone', 'Livraison rapide par drone', true, 4);

// Rien d'autre à faire! Le composant le chargera automatiquement
```

---

### 3. Ajouter une Nouvelle Fonctionnalité Activable

```typescript
// 1. Ajouter dans BD:
INSERT INTO app_features (code, name, description, is_enabled, config)
VALUES 
  ('nft_rewards', 'Rewards NFT', 'Gagner des NFT au lieu de points', true, '{"contract": "0x..."}'),
  ('ai_menu_optimizer', 'Menu AI', 'Suggestions IA pour menus', true, '{"model": "gpt-4"}');

// 2. Utiliser dans le code:
const { features } = useAppFeatures();
const nftEnabled = features.find(f => f.code === 'nft_rewards')?.is_enabled;

if (nftEnabled) {
  // Afficher module NFT rewards
}
```

---

### 4. Envoyer un Email Personnalisé

```typescript
import { sendEmail } from '@/lib/email';

// Envoyer email simple
const result = await sendEmail({
  to: 'customer@example.com',
  subject: 'Votre commande est prête!',
  htmlContent: `
    <h2>Commande #ORD001</h2>
    <p>Votre commande est prête à être retirée!</p>
    <a href="https://restafy.app/track/ORDER_ID">Suivre</a>
  `,
});

if (result.success) {
  console.log('Email envoyé');
} else {
  console.error('Erreur email:', result.error);
}
```

---

### 5. Créer un Template d'Email Réutilisable

```typescript
// src/lib/emailTemplates.ts
export function generateOrderEmail(data: {
  customerName: string;
  orderId: string;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
}) {
  return `
    <h2>Commande #${data.orderId}</h2>
    <p>Bonjour ${data.customerName},</p>
    
    <h3>Détails:</h3>
    <ul>
      ${data.items.map(item => `
        <li>${item.qty}x ${item.name}: ${item.price} FCFA</li>
      `).join('')}
    </ul>
    
    <h3>Total: ${data.total} FCFA</h3>
  `;
}

// Utiliser:
const htmlContent = generateOrderEmail({
  customerName: 'M. Salami',
  orderId: 'ORD001',
  items: [{ name: 'Sandwich', qty: 2, price: 2500 }],
  total: 5000,
});

await sendEmail({
  to: 'customer@example.com',
  subject: 'Votre commande',
  htmlContent,
});
```

---

### 6. Modifier le Flux POS

#### Ajouter une Colonne Personnalisée
```typescript
// Dans CaissePOS.tsx, modifier OrderCard:
<div className="p-4">
  <h3>{order.customer_name}</h3>
  <p>⏰ {getTimeElapsed(order.created_at)}m</p>
  
  {/* Ajouter colonne personnalisée */}
  <p>🏠 {order.delivery_address}</p>
  
  {/* Ajouter actions personnalisées */}
  <button onClick={() => sendSMS(order.customer_phone)}>
    📱 Envoyer SMS au client
  </button>
</div>
```

#### Ajouter Statut Personnalisé
```typescript
// Ajouter dans order_modes une "sous-étape":
const EXTENDED_STATUSES = [
  'pending',
  'confirmed',
  'preparing', 
  'preparing_sauce',  // ← Nouveau
  'preparing_cooking', // ← Nouveau
  'ready',
  'delivering',
  'delivered',
];

// Afficher dans POS comme mini-steps
```

---

### 7. Ajouter Logging/Monitoring

```typescript
// Dans n'importe quel hook:
import { logEmailAttempt } from '@/lib/emailLog';

// Enregistrer action:
await logEmailAttempt({
  recipient: 'customer@example.com',
  subject: 'Commande confirmée',
  type: 'order',
  order_id: orderData.id,
  success: true,
});

// Consulter logs:
// 1. Console browser (F12)
// 2. BD (si LOG_EMAILS_TO_DB=true)
// 3. Brevo dashboard
```

---

### 8. Créer un Webhook pour Paiement Externe

```typescript
// src/pages/api/webhooks/payment.ts
export async function POST(req: Request) {
  const body = await req.json();
  const { event, data } = body;

  if (event === 'payment.completed') {
    // Créer la commande automatiquement
    const { createOrder } = useOrderManager();
    
    await createOrder({
      restaurantId: data.restaurant_id,
      customerId: data.customer_id,
      items: data.items,
      totalAmount: data.amount,
      orderType: 'delivery',
    });

    return new Response(JSON.stringify({ ok: true }));
  }
}

// Webhook URL à configurer chez le payment provider:
// https://restafy.app/api/webhooks/payment
```

---

### 9. Modifier le Calcul des Frais

```typescript
// Dans Cart.tsx, modifier calculateDeliveryFee():
function calculateDeliveryFee(distance: number): number {
  // Logique simple:
  if (distance < 2) return 1000;
  if (distance < 5) return 2000;
  return 3000;
  
  // OU: Charger depuis BD (app_settings)
  // const { settings } = useSystemSettings();
  // const BASE_FEE = settings.find(s => s.key === 'delivery_base_fee')?.value;
}
```

---

### 10. Ajouter Analytics

```typescript
// Dans useOrderManager.ts, après success:
async function trackOrderAnalytics(order: Order) {
  // Envoyer à analytics (Google, Mixpanel, etc):
  if (window.gtag) {
    gtag('event', 'order_placed', {
      value: order.total_amount,
      currency: 'XOF',
      items: order.items.length,
      restaurant_id: order.restaurant_id,
    });
  }
}

// Dans POS, tracker acceptation:
async function acceptOrder(orderId: string) {
  // ...
  gtag('event', 'order_accepted', {
    order_id: orderId,
    restaurant_id: restaurantId,
  });
}
```

---

### 11. Créer une Notification SMS

```typescript
// src/lib/sms.ts
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendOrderSMS(phone: string, orderId: string) {
  await twilioClient.messages.create({
    body: `Votre commande #${orderId} est acceptée! Suivi: restafy.app/track/${orderId}`,
    from: process.env.TWILIO_PHONE,
    to: phone,
  });
}

// Utiliser:
await sendOrderSMS(order.customer_phone, order.id);
```

---

### 12. Ajouter Branche Conditionnelle dans Emails

```typescript
// Emails différents selon le mode de livraison
export async function sendOrderEmail(order: Order) {
  let subject = '✅ Commande confirmée!';
  let template = 'default';

  if (order.type === 'delivery') {
    subject = '🚚 Commande en chemin!';
    template = 'delivery';
  } else if (order.type === 'pickup') {
    subject = '🏪 Prête à retirer!';
    template = 'pickup';
  } else if (order.type === 'dine_in') {
    subject = '🍽️ Table #5 prête!';
    template = 'dine_in';
  }

  const htmlContent = getEmailTemplate(template, order);
  
  return sendEmail({
    to: order.customer_email,
    subject,
    htmlContent,
  });
}
```

---

## 🚀 Résumé: Ajouter Quelque Chose de Nouveau

**Pattern général:**
```
1. Ajouter data dans la BD (INSERT)
2. Créer/utiliser un hook pour charger (useXxx)
3. Utiliser le hook dans le composant (const { data } = useXxx())
4. Afficher dynamiquement
5. Admin peut modifier via panel
6. RIEN d'autre à faire! Redéploiement pas nécessaire
```

**C'est ça l'architecture dynamique!** ✨
