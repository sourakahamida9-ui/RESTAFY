# Intégration Genius Pay pour Restafy

## 📋 Configuration

### 1. Variables d'environnement

Créer un fichier `.env.local` à la racine du projet :

```bash
# ==========================================
# GENIUS PAY CONFIGURATION
# ==========================================

# Mode: 'sandbox' pour les tests, 'production' pour les vrais paiements
VITE_GENIUSPAY_ENVIRONMENT=sandbox

# Clés API (obtenues depuis https://geniuspay.ci/dashboard)
VITE_GENIUSPAY_API_KEY=gp_test_xxx_xxx        # Clé de test
VITE_GENIUSPAY_MERCHANT_ID=your_merchant_id # ID du marchand

# Backend API (serverless Vercel)
GENIUSPAY_API_KEY=gp_test_xxx_xxx           # Même clé pour le backend
GENIUSPAY_MERCHANT_ID=your_merchant_id      # Même merchant ID
GENIUSPAY_WEBHOOK_SECRET=your_webhook_secret # Secret pour signer les webhooks
```

### 2. Déploiement Vercel

Dans le dashboard Vercel, ajouter ces variables d'environnement :

| Variable | Valeur | Environnement |
|----------|--------|---------------|
| `VITE_GENIUSPAY_ENVIRONMENT` | `sandbox` ou `production` | Production |
| `VITE_GENIUSPAY_API_KEY` | `gp_live_xxx` ou `gp_test_xxx` | Production |
| `VITE_GENIUSPAY_MERCHANT_ID` | Votre merchant ID | Production |
| `GENIUSPAY_WEBHOOK_SECRET` | Secret webhook | Production |

## 🧪 Tests avec Sandbox

### Méthode 1: Test via l'interface

1. Allez sur `/events/{id}?ticketId={ticketId}`
2. Remplissez le formulaire
3. Cliquez sur "Payer"
4. Sur la page Genius Pay (sandbox), utilisez les identifiants de test :
   - **Succès** : Numéro: `+2250700000000`, Code: `1234`
   - **Échec** : Numéro: `+2250700000001`, Code: `0000`

### Méthode 2: Test avec cURL

```bash
# Initier un paiement test
curl -X POST https://app.restafy.shop/api/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "currency": "XOF",
    "description": "Test billet",
    "customer_name": "Test User",
    "customer_email": "test@example.com",
    "customer_phone": "+22990123456",
    "ticket_purchase_id": "uuid-test"
  }'
```

### Méthode 3: Test webhook

```bash
# Simuler un webhook de succès
curl -X POST http://localhost:3000/api/webhooks/geniuspay \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: test_signature" \
  -H "x-webhook-timestamp: 1234567890" \
  -H "x-webhook-event: payment.success" \
  -d '{
    "id": "evt_test",
    "event": "payment.success",
    "data": {
      "reference": "RESTAFY-TEST123",
      "amount": 5000,
      "status": "success",
      "metadata": {
        "ticket_purchase_id": "your-ticket-uuid"
      }
    }
  }'
```

## 📊 Vérification en base de données

```sql
-- Vérifier un paiement par référence
SELECT * FROM payments 
WHERE transaction_ref = 'RESTAFY-XXXXXX';

-- Vérifier le statut d'un ticket
SELECT 
  tp.id,
  tp.status,
  tp.ticket_number,
  tp.confirmed_at,
  p.transaction_ref,
  p.amount,
  p.status as payment_status,
  p.confirmed_at as payment_confirmed_at
FROM ticket_purchases tp
LEFT JOIN payments p ON tp.payment_id = p.id
WHERE tp.id = 'votre-uuid-ticket';

-- Liste des paiements récents
SELECT 
  transaction_ref,
  amount,
  currency,
  status,
  method,
  created_at,
  confirmed_at
FROM payments
ORDER BY created_at DESC
LIMIT 10;
```

## 🎯 Flow de paiement complet

```
1. Client remplit formulaire événement
   ↓
2. Frontend: GeniusPayButton.onClick()
   ↓
3. API /api/payments/initiate
   ↓
4. Genius Pay créé session → retourne checkout_url
   ↓
5. Redirection client vers page Genius Pay
   ↓
6. Client valide paiement (USSD/Mobile Money)
   ↓
7. Genius Pay envoie webhook POST /api/webhooks/geniuspay
   ↓
8. Webhook met à jour:
   - payments.status = 'confirmed'
   - ticket_purchases.status = 'confirmed'
   - ticket_purchases.payment_id = payments.id
   ↓
9. Client redirigé vers /payment/success
   ↓
10. Email de confirmation envoyé
```

## 🔧 Tarification Genius Pay

| Montant | Commission (1%) | Fixe (100 XOF) | Reçu |
|---------|----------------|----------------|------|
| 1 000 XOF | 10 XOF | 100 XOF | ~890 XOF |
| 5 000 XOF | 50 XOF | 100 XOF | ~4 850 XOF |
| 10 000 XOF | 100 XOF | 100 XOF | ~9 800 XOF |
| 50 000 XOF | 500 XOF | 100 XOF | ~49 400 XOF |

**Note:** Les frais opérateur (~150 XOF) sont déduits en plus.

## 🚨 Dépannage

### Erreur: "Unexpected token 'A', "A server e"... is not valid JSON"
**Cause:** Genius Pay retourne une page HTML d'erreur au lieu de JSON.
**Solution:** Les clés API sont probablement incorrectes ou expirées.
- Vérifier que `GENIUSPAY_PUBLIC_KEY` commence par `pk_sandbox_` (sandbox) ou `pk_live_` (production)
- Vérifier que `GENIUSPAY_SECRET_KEY` commence par `sk_sandbox_` ou `sk_live_`
- Tester avec l'endpoint health check: `GET /api/payments/initiate?check=health`

### Erreur: "Service de paiement temporairement indisponible"
**Cause:** Genius Pay retourne une réponse HTML (maintenance, erreur serveur).
**Solution:** Attendre que Genius Pay résolve le problème, ou contacter leur support.

### Erreur: "Configuration GeniusPay invalide"
**Cause:** Format des clés API incorrect.
**Solution:** Les clés doivent respecter le format:
- Public: `pk_sandbox_xxxxx` ou `pk_live_xxxxx`
- Secret: `sk_sandbox_xxxxx` ou `sk_live_xxxxx`

### Health Check Endpoint
```bash
# Vérifier la configuration (développement uniquement)
curl "https://app.restafy.shop/api/payments/initiate?check=health"
```

### Erreur: "Payment service not configured"
→ Vérifier que `GENIUSPAY_PUBLIC_KEY` et `GENIUSPAY_SECRET_KEY` sont bien définis dans Vercel.

### Erreur: "Invalid signature" sur webhook
→ Le `GENIUSPAY_WEBHOOK_SECRET` ne correspond pas. Récupérer le bon secret depuis le dashboard Genius Pay.

### Paiement en attente infini
→ Vérifier que le webhook URL est accessible publiquement (pas localhost).
→ URL webhook: `https://app.restafy.shop/api/webhooks/geniuspay`

## 📞 Support Genius Pay

- **Email:** pay@genius.ci
- **Téléphone:** +225 27 22 25 26 28
- **Documentation:** https://geniuspay.ci/docs
- **Dashboard:** https://geniuspay.ci/dashboard

## 🚀 Passage en Production

1. Créer compte sur https://geniuspay.ci
2. Obtenir clé API production (`gp_live_xxx`)
3. Configurer webhook URL
4. Mettre à jour variables Vercel :
   - `VITE_GENIUSPAY_ENVIRONMENT=production`
   - `VITE_GENIUSPAY_API_KEY=gp_live_xxx`
   - `GENIUSPAY_API_KEY=gp_live_xxx`
5. Redéployer

## ✅ Checklist avant production

- [ ] Tests sandbox réussis
- [ ] Webhook configuré et testé
- [ ] Variables d'environnement mises à jour
- [ ] Fallback erreurs paiement implémenté
- [ ] Monitoring/logs activés
- [ ] Support client informé
