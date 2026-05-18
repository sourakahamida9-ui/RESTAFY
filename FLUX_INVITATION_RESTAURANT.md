# Flux Complet : Invitation et Création de Compte Restaurant

## Vue d'ensemble
Quand un admin crée un token d'invitation et qu'un restaurant l'utilise pour créer un compte, voici exactement ce qui se passe :

---

## ÉTAPE 1️⃣ : ADMIN CRÉE UN TOKEN

### Page: `/superadmin/invites`
```
Admin clique "Créer un nouveau lien d'invitation"
↓
Fonction: RestaurantInvites.tsx → generateInviteLink()
↓
INSERT dans restaurant_invites:
{
  id: UUID généré
  token: "RESTAFY-{timestamp}-{random}"
  created_at: now()
  is_used: false
  used_by: null
  used_at: null
}
↓
Token généré : "RESTAFY-1741510000000-ABC123XYZ"
Lien copié : "https://app.com/restaurant/signup?token=RESTAFY-1741510000000-ABC123XYZ"
```

**Base de données après:**
```
restaurant_invites:
├── id: 550e8400-e29b-41d4-a716-446655440000
├── token: "RESTAFY-1741510000000-ABC123XYZ"
├── created_at: 2024-03-09 10:00:00
├── is_used: false ← IMPORTANT: pas utilisé
├── used_by: NULL
└── used_at: NULL
```

---

## ÉTAPE 2️⃣ : RESTAURANT CLIQUE LE LIEN

### Page: `/restaurant/signup?token=RESTAFY-1741510000000-ABC123XYZ`
```
Restaurant ouvre le lien
↓
useEffect → verifyToken()
↓
SELECT FROM restaurant_invites WHERE token = "RESTAFY-1741510000000-ABC123XYZ"
↓
Résultat:
- Token trouvé? ✓
- is_used = false? ✓
- Lien valide? Montrer le formulaire
```

**État du composant:**
- `tokenValid = true`
- Affiche le formulaire d'inscription

---

## ÉTAPE 3️⃣ : RESTAURANT REMPLIT LE FORMULAIRE

```
Formulaire:
├── Email: hamida@resto.com
├── Mot de passe: ••••••
├── Nom restaurant: "Le Poulet Braisé"
└── Téléphone: +22901234567
```

---

## ÉTAPE 4️⃣ : RESTAURANT CLIQUE "CRÉER MON RESTAURANT"

### Fonction: handleSubmit()

```
1. VALIDATION CLIENT
   ├── Mot de passe confirmé? ✓
   ├── Longueur mot de passe >= 6? ✓
   └── Nom restaurant fourni? ✓

2. APPEL signUp() avec:
   {
     email: "hamida@resto.com"
     password: "••••••"
     fullName: "Hamida Saliou"
     phone: "+22901234567"
     role: "restaurant_owner"  ← IMPORTANT
     restaurantName: "Le Poulet Braisé"
   }
```

---

## ÉTAPE 5️⃣ : CRÉATION UTILISATEUR AUTH

### Code: useAuth.ts → signUp()

```
1. supabase.auth.signUp({
     email: "hamida@resto.com",
     password: "••••••",
     options: {
       data: {
         full_name: "Hamida Saliou",
         phone: "+22901234567",
         role: "restaurant_owner"
       }
     }
   })

   ↓ Résultat:
   {
     user: {
       id: "998e8402-f39c-42d5-b826-557766551111"
     }
   }

2. ATTENDRE 1000ms (laisse Supabase sync)

3. CRÉER LE PROFIL MANUELLEMENT:
   INSERT INTO profiles:
   {
     id: "998e8402-f39c-42d5-b826-557766551111",
     email: "hamida@resto.com",
     full_name: "Hamida Saliou",
     phone: "+22901234567",
     role: "restaurant_owner",
     is_banned: false,
     loyalty_points: 0,
     total_orders: 0,
     restaurant_id: NULL (à remplir après),
     has_completed_onboarding: false,
     created_at: 2024-03-09 10:05:30,
     updated_at: 2024-03-09 10:05:30
   }

4. CRÉER LE RESTAURANT:
   slug = "le-poulet-braise"
   
   INSERT INTO restaurants:
   {
     id: "770e9500-g39d-52e6-c926-668877662222",
     name: "Le Poulet Braisé",
     slug: "le-poulet-braise",
     owner_id: "998e8402-f39c-42d5-b826-557766551111",
     is_active: false ← IMPORTANT: EN ATTENTE VALIDATION ADMIN
     created_at: 2024-03-09 10:05:31,
     updated_at: 2024-03-09 10:05:31
   }

5. LIER RESTAURANT AU PROFIL:
   UPDATE profiles 
   SET restaurant_id = "770e9500-g39d-52e6-c926-668877662222"
   WHERE id = "998e8402-f39c-42d5-b826-557766551111"
```

**État de la base de données maintenant:**

| Table | Récord |
|-------|--------|
| `auth.users` | user_id: 998e8402-f39c-42d5-b826-557766551111 |
| `profiles` | id: 998e8402, email: hamida@resto.com, role: restaurant_owner, restaurant_id: 770e9500 |
| `restaurants` | id: 770e9500, name: Le Poulet Braisé, owner_id: 998e8402, **is_active: false** |

---

## ÉTAPE 6️⃣ : MARQUER LE TOKEN COMME UTILISÉ

### Code: RestaurantSignup.tsx ligne 127-134

```javascript
UPDATE restaurant_invites
SET 
  is_used = true,
  used_by = "998e8402-f39c-42d5-b826-557766551111",
  used_at = "2024-03-09 10:05:32"
WHERE token = "RESTAFY-1741510000000-ABC123XYZ"
```

**État final du token:**
```
restaurant_invites:
├── id: 550e8400-e29b-41d4-a716-446655440000
├── token: "RESTAFY-1741510000000-ABC123XYZ"
├── created_at: 2024-03-09 10:00:00
├── is_used: true ← MARQUÉ COMME UTILISÉ
├── used_by: "998e8402-f39c-42d5-b826-557766551111"
└── used_at: "2024-03-09 10:05:32"
```

⚠️ **Si quelqu'un réutilise ce lien:** `is_used = true` → message "Ce lien a déjà été utilisé"

---

## ÉTAPE 7️⃣ : REDIRECTION

```javascript
setSuccess(true)
setTimeout(() => navigate('/restaurant/dashboard'), 2000)
```

↓ Le restaurant est redirigé vers `/restaurant/dashboard`

---

## ÉTAPE 8️⃣ : DASHBOARD RESTAURANT

### Code: pages/admin/Dashboard.tsx

```javascript
useEffect(() => {
  // Récupérer le restaurant du profil
  restaurantId = profile?.restaurant_id // "770e9500-..."
  
  // Charger les données du restaurant
  SELECT * FROM restaurants WHERE id = "770e9500-..."
}, [restaurantId])

// Vérification:
if (!restaurant.is_active) {
  return (
    <Alert>
      Restaurant en attente de validation
      Admin doit approuver: is_active = true
    </Alert>
  )
}
```

**Le restaurant voit:**
```
🟡 Restaurant en attente de validation
Votre restaurant "Le Poulet Braisé" est en attente de 
validation par l'administrateur Restafy. 
Vous serez notifié une fois approuvé.
```

---

## 🔑 POINTS CRITIQUES

### 1️⃣ État du Restaurant
- **Après création:** `is_active: false` (attente validation admin)
- **Après approbation admin:** `is_active: true` → accès au dashboard

### 2️⃣ Jeton peut être réutilisé?
- **Première utilisation:** `is_used: false` → ✅ Autorisé
- **Deuxième utilisation:** `is_used: true` → ❌ "Déjà utilisé"

### 3️⃣ Champs du Restaurant après création

| Champ | Valeur | Statut |
|-------|--------|--------|
| `id` | UUID | ✅ Généré |
| `name` | Saisie du formulaire | ✅ OK |
| `slug` | Auto-généré | ✅ OK |
| `owner_id` | ID du user | ✅ OK |
| `is_active` | false | ⚠️ EN ATTENTE |
| `logo_url` | NULL | À compléter |
| `description` | NULL | À compléter |

---

## ✅ VÉRIFICATIONS POUR QUE TOUT FONCTIONNE

### 1. RLS Policies
```sql
-- Doit permettre les inserts:
CREATE POLICY "profiles_insert_all" ON profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "restaurants_insert_all" ON restaurants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "restaurant_invites_update_all" ON restaurant_invites FOR UPDATE TO authenticated WITH CHECK (true);
```

### 2. Profil existe après signup?
```sql
SELECT * FROM profiles WHERE email = 'hamida@resto.com'
-- Doit retourner 1 ligne avec role = 'restaurant_owner'
```

### 3. Restaurant créé?
```sql
SELECT * FROM restaurants WHERE owner_id = '998e8402-f39c-42d5-b826-557766551111'
-- Doit retourner 1 ligne avec is_active = false
```

### 4. Token marqué utilisé?
```sql
SELECT * FROM restaurant_invites WHERE token = 'RESTAFY-1741510000000-ABC123XYZ'
-- Doit retourner is_used = true, used_by = '998e8402-...', used_at = '...'
```

---

## 🎯 RÉSUMÉ DU FLUX

```
Admin crée token
    ↓
Restaurant reçoit lien
    ↓
Token valide? (is_used = false)
    ↓
Restaurant remplit formulaire
    ↓
Créer Auth user + Profile (restaurant_owner) + Restaurant (is_active: false)
    ↓
Marquer token comme utilisé (is_used = true)
    ↓
Redirection → /restaurant/dashboard
    ↓
Dashboard affiche: "En attente de validation"
    ↓
Admin approuve: is_active = true
    ↓
Restaurant accède au dashboard
```

---

## 🚀 PROCHAINES ÉTAPES

1. ✅ Restaurant reçoit le token valide
2. ✅ Restaurant crée son compte
3. ✅ Restaurant voit "En attente de validation"
4. ⏳ **Admin approuve** → is_active = true
5. ⏳ Restaurant accède au dashboard et commence
