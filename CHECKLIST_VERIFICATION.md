## ✅ Checklist de Vérification - Restafy v2.0

### Avant le Déploiement

#### 🔐 Configuration Sécurité
- [ ] `VITE_BREVO_API_KEY` définie dans `.env`
- [ ] Domaine Brevo validé (app.brevo.com)
- [ ] RLS policies activées sur toutes les tables
- [ ] Super admin role existant dans la base de données
- [ ] Aucune clé d'API exposée dans le code

#### 🗄️ Base de Données
- [ ] Tables créées: `payment_methods`, `order_modes`, `app_features`, `system_settings`, `notification_templates`
- [ ] Données initiales insérées (3 paiements, 3 modes, 4 features)
- [ ] Indexes créés sur `orders.created_at`, `orders.restaurant_id`, `orders.customer_id`
- [ ] RLS policies testées (SELECT fonctionne, INSERT/UPDATE échoue sans admin)

#### 🏪 Restaurant Admin
- [ ] Au moins 1 restaurant créé avec `is_active = true`
- [ ] Restaurant owner a un compte actif
- [ ] Restaurant ID correct dans le profil owner

#### 🎨 UI/UX
- [ ] Cart affiche les modes de livraison dynamiques
- [ ] USSDIntegration affiche les paiements dynamiques
- [ ] POS accessible à `/restaurant/dashboard/pos`
- [ ] Admin panels accessibles à `/superadmin/payment-methods` et `/superadmin/order-modes`

---

### Après le Déploiement

#### 📧 Tests Email
```bash
1. Créer commande client
2. Payer via USSD
3. Vérifier logs: "[v0] Email sent successfully: true"
4. Vérifier inbox (attendre 5-10 sec)
5. Vérifier spam
6. Consulter logs Brevo: https://app.brevo.com/logs
```

#### 🏪 Tests POS
```bash
1. Connecter comme restaurant
2. Aller à /restaurant/dashboard/pos
3. Vérifier commandes affichées en temps réel
4. Accepter/Rejeter une commande
5. Vérifier statut changé dans BD
6. Vérifier email reçu par client
```

#### 🔄 Tests Dynamique
```bash
1. Aller à /superadmin/payment-methods
2. Créer nouveau paiement "Test Pay"
3. Aller à Cart (panier)
4. Vérifier nouveau paiement n'apparaît qu'après refresh
5. Éditer paiement: changer `is_active = false`
6. Refresh Cart: vérifier paiement disparu
7. Répéter pour order_modes
```

#### 💻 Tests Performance
```bash
1. Créer 50+ commandes
2. Ouvrir POS
3. Vérifier temps de chargement < 2 sec
4. Changer statut 5+ commandes
5. Vérifier pas de lag
6. Vérifier emails envoyés correctement
```

---

### Logs à Consulter

#### Console (F12 → Console)
```javascript
// Chercher ces messages:
✅ [v0] Creating order with params: {...}
✅ [v0] Order created: UUID
✅ [v0] Order items created successfully
✅ [v0] Email sent successfully: true
✅ [v0] Order creation completed successfully

// Éviter:
❌ [v0] Email error (non-blocking)
❌ [v0] Profile creation error
❌ [v0] RLS policy violation
```

#### Supabase Logs
```sql
-- Requête pour vérifier logs:
SELECT * FROM pg_stat_statements 
ORDER BY query_time DESC 
LIMIT 10;
```

#### Brevo Logs
- Accès: https://app.brevo.com/logs
- Chercher emails envoyés
- Vérifier status: `sent`, `opened`, `clicked`
- Éviter: `rejected`, `bounced`, `complained`

---

### Troubleshooting Rapide

| Symptôme | Cause | Fix |
|----------|-------|-----|
| Pas d'email | API key manquante | Ajouter `VITE_BREVO_API_KEY` |
| Email en spam | Domaine non validé | Valider dans Brevo |
| POS lent | Trop de commandes | Implémenter pagination |
| Mods pas dynamiques | Cache | Clear localStorage |
| Restaurant ne voit rien | is_active=false | Activer restaurant |
| Paiements manquent | RLS violation | Vérifier policies |

---

### Signoffs

- [ ] Développeur: Code revu et testé ✓
- [ ] QA: Tests de régression passés ✓
- [ ] Admin: Configuration vérifiée ✓
- [ ] Product: Features approuvées ✓

**Prêt pour production:** _____ (Date)

---

## 🎯 Tâches Post-Lancement

1. **Jour 1:** Vérifier emails arrivent
2. **Jour 2:** Tester avec 5 vrais restaurants
3. **Semaine 1:** Analyser metrics Brevo
4. **Semaine 2:** Optimiser basé sur feedback
5. **Mois 1:** Planifier prochaines features
