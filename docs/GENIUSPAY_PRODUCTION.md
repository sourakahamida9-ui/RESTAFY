# 🚀 Passer Genius Pay en Mode Production

## ⚠️ IMPORTANT : Configuration requise

Pour passer des paiements TEST (sandbox) aux paiements RÉELS (production), vous devez :

### 1. Obtenir vos clés API Production

Rendez-vous sur https://geniuspay.ci/dashboard :

1. **Créer un compte Business** (si pas déjà fait)
2. **Vérifier votre identité** (KYC requis)
3. **Récupérer vos clés API Production** :
   - `pk_live_xxx` (Public Key)
   - `sk_live_xxx` (Secret Key)

### 2. Configurer Vercel (Variables d'environnement)

Dans le Vercel Dashboard :
```
Dashboard → Settings → Environment Variables
```

| Variable | Ancienne valeur (TEST) | Nouvelle valeur (PRODUCTION) |
|----------|------------------------|------------------------------|
| `GENIUSPAY_PUBLIC_KEY` | `pk_sandbox_xxx` | `pk_live_xxx` |
| `GENIUSPAY_SECRET_KEY` | `sk_sandbox_xxx` | `sk_live_xxx` |
| `GENIUSPAY_WEBHOOK_SECRET` | `whsec_sandbox_xxx` | `whsec_live_xxx` |

**⚠️ NE PAS modifier ces variables côté client :**
- `VITE_GENIUSPAY_API_KEY` (reste en sandbox pour les tests UI)
- `VITE_GENIUSPAY_ENVIRONMENT` (reste "sandbox" jusqu'à validation complète)

### 3. Redéployer

```bash
git push origin main
# ou
vercel --prod
```

---

## 💰 Tarifs en Production

| Transaction | Commission (1%) | Fixe (100 XOF) | Reçu net |
|-------------|-----------------|----------------|----------|
| 1 000 XOF | 10 XOF | 100 XOF | ~890 XOF |
| 5 000 XOF | 50 XOF | 100 XOF | ~4 850 XOF |
| 10 000 XOF | 100 XOF | 100 XOF | ~9 800 XOF |
| 50 000 XOF | 500 XOF | 100 XOF | ~49 400 XOF |

Frais opérateur : ~150 XOF supplémentaires (déduits automatiquement)

---

## 🧪 Test avant Production

Avant de passer en production, vérifiez :

### 1. Test Sandbox OK
```bash
# Créer un paiement test
curl -X POST https://app.restafy.shop/api/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "XOF", "description": "Test", "customer_name": "Test", "customer_email": "test@test.com"}'
```

### 2. Webhook fonctionnel
- Payer un billet test
- Vérifier que le statut passe à "confirmed" en base
- Vérifier que l'email de confirmation est envoyé

### 3. URLs de retour correctes
- ✅ `/payment/success` - Paiement réussi
- ✅ `/payment/cancel` - Paiement échoué/annulé

---

## 🔒 Sécurité Production

### Webhook Signature
Le webhook vérifie automatiquement la signature avec `GENIUSPAY_WEBHOOK_SECRET`.

**Ne JAMAIS désactiver cette vérification en production !**

### Idempotence
Les webhooks sont traités de manière idempotente :
- Un paiement déjà confirmé ne sera pas re-traité
- Évite les doubles commandes/billets

### Logs
Surveiller les logs Vercel :
```
[Payment] Initiating GeniusPay payment...
[GeniusPay Webhook] Received event: payment.success
[GeniusPay Webhook] Ticket confirmed: xxx
```

---

## 🆘 Support Genius Pay

Si problème en production :
- **Email** : pay@genius.ci
- **Téléphone** : +225 27 22 25 26 28
- **Dashboard** : https://geniuspay.ci/dashboard

---

## ✅ Checklist Production

- [ ] Compte Genius Pay Business vérifié (KYC)
- [ ] Clés API Production récupérées
- [ ] Variables Vercel mises à jour
- [ ] Test sandbox réussi end-to-end
- [ ] Webhook testé avec signature
- [ ] Email de confirmation reçu
- [ ] Redéploiement effectué
- [ ] Test paiement réel (petit montant)
- [ ] Monitoring/logs activés

---

**⚠️ Attention** : Les paiements en production sont RÉELS et débitent vraiment les clients. Testez bien en sandbox d'abord !
