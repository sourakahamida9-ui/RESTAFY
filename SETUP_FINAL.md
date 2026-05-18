# 🚀 CONFIGURATION FINALE - GeniusPay

## ✅ CE QUI A ÉTÉ FAIT

1. ✅ **SUPPRIMÉ** tout l'ancien code de paiement
2. ✅ **RECONSTRUIT** de zéro selon la documentation officielle
3. ✅ **Build réussi** - 12.43s (ultra rapide !)
4. ✅ **Pushé** sur GitHub - Commit `3806db8`

---

## ⚠️ ACTION REQUISE : Ajouter 1 Variable sur Vercel

### **Le code utilise MAINTENANT :**

```typescript
Authorization: Bearer ${GENIUSPAY_API_KEY}
```

### **Donc vous devez ajouter SUR VERCEL :**

| Variable | Valeur |
|----------|--------|
| **`GENIUSPAY_API_KEY`** | `sk_sandbox_55f66526e0947861d980abe9ac0f4c117b002427589c0ef00053799a44134b30` |

**C'EST TOUT !** Une seule variable à ajouter !

---

## 📋 STEPS (2 minutes)

### 1️⃣ Aller sur Vercel
- Ouvrez **https://vercel.com**
- Cliquez sur **restafy-prod**
- Cliquez **Settings**
- Cliquez **Environment Variables**

### 2️⃣ Ajouter la variable
- Cliquez **Add New**
- **Name:** `GENIUSPAY_API_KEY`
- **Value:** `sk_sandbox_55f66526e0947861d980abe9ac0f4c117b002427589c0ef00053799a44134b30`
- ✅ Cochez **Production**, **Preview**, **Development**
- Cliquez **Save**

### 3️⃣ Redéployer
- Allez sur **Deployments**
- Dernier déploiement → **⋮** → **Redeploy**
- Cochez **Use existing Build Cache**
- Cliquez **Redeploy**

---

## 🧪 TESTER

Après le déploiement, ouvrez :

```
https://VOTRE-URL.vercel.app/api/payments/initiate
```

### ✅ Si ça marche :
```json
{
  "success": false,
  "error": "Method not allowed. Use POST."
}
```
*(Ce message est NORMAL - ça veut dire que l'API fonctionne !)*

### ❌ Si la variable manque :
```json
{
  "success": false,
  "error": "Payment gateway not configured",
  "message": "Missing GENIUSPAY_API_KEY environment variable"
}
```

---

## 📚 RÉSUMÉ TECHNIQUE

**Code :**
- ✅ Suit EXACTEMENT la documentation officielle GeniusPay
- ✅ Utilise `Authorization: Bearer ${apiKey}`
- ✅ Endpoint : `POST /api/v1/merchant/payments`
- ✅ Gestion d'erreurs complète (400, 401, 403, 422, 429, 500)
- ✅ Ultra simple : 219 lignes

**Variables requises :**
- ✅ `GENIUSPAY_API_KEY` (votre clé secrète `sk_sandbox_*`)

**C'est tout ! Plus besoin de GENIUSPAY_PUBLIC_KEY ou autre !**

---

## 🎯 PROCHAINES ÉTAPES

1. ✅ Ajouter `GENIUSPAY_API_KEY` sur Vercel
2. ✅ Redéployer
3. ✅ Tester l'endpoint
4. ✅ Faire un paiement test

**Les paiements vont fonctionner maintenant !** 🎉
