# 🔧 Diagnostique : Erreur Genius Pay "Unexpected token 'A'"

## 📊 Problème Diagnostiqué

L'erreur **"Unexpected token 'A', "A server e"... is not valid JSON"** indique que:
- Genius Pay retourne une **réponse HTML** au lieu de JSON
- Le texte commence par "A server error" (page d'erreur 500)
- L'API frontend essaie de parser cette HTML comme JSON → crash JSON.parse()

---

## 🔍 Checklist de Vérification

### 1️⃣ **Vérifier les clés API**
```bash
# Via health check (développement)
curl "http://localhost:3000/api/payments/initiate?check=health"

# Vérifier dans Vercel Settings → Environment Variables
# - GENIUSPAY_PUBLIC_KEY doit commencer par pk_sandbox_ ou pk_live_
# - GENIUSPAY_SECRET_KEY doit commencer par sk_sandbox_ ou sk_live_
```

### 2️⃣ **Vérifier les logs**
```bash
# Les nouveaux logs vous montreront:
# [safeParseResponse] JSON parse failed: ...
# [safeParseResponse] Raw response (first 200 chars): ...
# [GeniusPay] HTML response detected!
# [GeniusPay] Full HTML response: ...
```

### 3️⃣ **Causes Possibles**

| Cause | Symptôme | Solution |
|-------|---------|----------|
| Clés API invalides | HTML 401/403 | Vérifier format pk_/sk_ |
| Clés expirées | HTML 401 | Renouveler sur dashboard |
| API Genius Pay en maintenance | HTML 503 | Attendre ou contacter support |
| Mauvaise URL endpoint | HTML 404 | Vérifier GENIUSPAY_BASE_URL |
| Payload malformé | HTML 400 | Vérifier schema de données |
| Rate limiting | HTML 429 | Attendre ou augmenter limites |

---

## 📈 Amélioration Apportée

### ✅ Avant (Problématique)
```javascript
// Tentait de parser directement
try {
  const data = JSON.parse(raw); // ❌ Crash si HTML
} catch {
  throw new Error('Non-JSON response'); // ❌ Message peu clair
}
```

### ✅ Après (Robuste)
```javascript
// Détecte HTML AVANT de parser
if (raw.includes('<html') || raw.includes('A server')) {
  return 'Service temporairement indisponible'; // ✅ Clair pour l'utilisateur
}

// Logs détaillés pour debug
console.error('[safeParseResponse] JSON parse failed:', parseError);
console.error('[GeniusPay] Full HTML response:', geniusRaw); // ✅ Pour le debug
```

---

## 🚀 Actions Recommandées

### **Pour les développeurs (en local)**
1. Vérifier les logs du navigateur (DevTools → Console)
2. Vérifier les logs du serveur (Vercel logs ou terminal)
3. Tester avec l'endpoint health check
4. Activer plus de logs si besoin

### **Pour la production**
1. ✅ **Configuration confirmée** : Clés API au bon format
2. ✅ **Monitoring actif** : Surveiller les erreurs HTML
3. ✅ **Fallback user-friendly** : Messages clairs en cas d'erreur
4. ✅ **Logs détaillés** : Identification rapide des problèmes

---

## 📞 Contact Support Genius Pay

| Canal | Contact |
|-------|---------|
| Email | pay@genius.ci |
| Téléphone | +225 27 22 25 26 28 |
| Documentation | https://geniuspay.ci/docs |
| Dashboard | https://geniuspay.ci/dashboard |

---

## 🎯 Prochaines Étapes

Si l'erreur persiste:
1. Vérifier les logs Vercel (Settings → Monitoring → Function Logs)
2. Tester directement avec cURL:
```bash
curl -X POST https://app.restafy.shop/api/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "XOF"}'
```
3. Contacter le support Genius Pay avec l'erreur exacte
4. Ouvrir une issue GitHub avec les logs complets
