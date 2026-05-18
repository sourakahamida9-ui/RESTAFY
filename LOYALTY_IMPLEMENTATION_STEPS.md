# Guide d'Implémentation - Système de Fidélité Restafy

## 🎯 Vue d'ensemble du projet

Ce guide vous guide pas-à-pas pour implémenter le système complet de fidélité et parrainage.

**Fichiers créés:**
- ✅ `scripts/035-complete-loyalty-system.sql` - Tables, triggers, functions, RLS
- ✅ `scripts/036-loyalty-cron-jobs.sql` - Jobs PostgreSQL cron
- ✅ `src/hooks/useLoyalty.ts` - Hook global + hooks restaurants (amélioré)
- ✅ `src/pages/LoyaltyDashboard.tsx` - Dashboard principal (refonte)
- ✅ `src/pages/ReferralPage.tsx` - Page parrainage (nouveau design)
- ✅ `src/pages/LeaderboardPage.tsx` - Classements (connecté à DB)
- ✅ `src/components/loyalty/ChallengeCard.tsx` - Composant défi (amélioré)

**Documentation:**
- ✅ `LOYALTY_SYSTEM_COMPLETE.md` - Doc complète du système
- ✅ `LOYALTY_IMPLEMENTATION_STEPS.md` - Ce fichier

---

## 📋 Étapes d'implémentation (dans l'ordre)

### ÉTAPE 1: Créer les tables et triggers (SQL)
**Durée: 5-10 min**
**Fichier:** `scripts/035-complete-loyalty-system.sql`

```bash
# Dans Supabase SQL Editor:
1. Copier le contenu du fichier 035-complete-loyalty-system.sql
2. Exécuter le script entier
3. Vérifier que les tables sont créées:
   - referrals
   - weekly_challenges
   - challenge_progress
   - restaurant_leaderboard
   - points_expiry_alerts
4. Vérifier les colonnes ajoutées à 'profiles':
   - referral_code
   - referred_by_id
   - points_expiry_at
   - is_vip
```

**Vérification:**
```sql
SELECT * FROM information_schema.tables 
WHERE table_name LIKE 'referral%' OR table_name LIKE 'weekly%' OR table_name LIKE 'challenge%';

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('referral_code', 'is_vip');
```

---

### ÉTAPE 2: Créer les jobs cron PostgreSQL
**Durée: 3-5 min**
**Fichier:** `scripts/036-loyalty-cron-jobs.sql`

```bash
# Dans Supabase SQL Editor:
1. Copier le contenu du fichier 036-loyalty-cron-jobs.sql
2. Exécuter le script pour créer les functions
3. Activer pg_cron:
   CREATE EXTENSION IF NOT EXISTS pg_cron;
4. Scheduler les cron jobs (décommenter les 4 dernières parties):
   - expire_old_points_job (dimanche 23:00 UTC)
   - send_points_expiry_alerts_job (Lun/Mer/Ven 09:00 UTC)
   - generate_weekly_challenges_job (lundi 00:01 UTC)
   - reset_monthly_leaderboard_job (1er mois 01:00 UTC)
5. Vérifier avec: SELECT * FROM cron.job;
```

**Vérification:**
```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE '%loyalty%';
```

---

### ÉTAPE 3: Ajouter les routes dans App.tsx
**Durée: 2 min**

```typescript
// Dans src/App.tsx, ajouter dans les routes:

<Route path="/loyalty" element={<LoyaltyDashboard />} />
<Route path="/referral" element={<ReferralPage />} />
<Route path="/leaderboard" element={<LeaderboardPage />} />
```

---

### ÉTAPE 4: Générer les codes de parrainage pour clients existants
**Durée: 2 min**
**Fichier SQL:**

```sql
-- Dans Supabase SQL Editor, générer les codes pour les clients sans code:
UPDATE profiles 
SET referral_code = 
  UPPER(LEFT(full_name, 4)) || 
  LPAD(CAST((RANDOM() * 1000)::INT AS VARCHAR), 3, '0')
WHERE referral_code IS NULL;

-- Vérifier:
SELECT id, full_name, referral_code 
FROM profiles 
WHERE referral_code IS NOT NULL 
LIMIT 10;
```

---

### ÉTAPE 5: Intégrer au checkout (Commandes)
**Durée: 15-20 min**

#### 5.1 Appliquer réductions basées sur niveau

```typescript
// Dans OrderSummary.tsx ou checkout page:
import { useGlobalLoyalty } from '@/hooks/useLoyalty';

export default function OrderSummary() {
  const { currentLevel } = useGlobalLoyalty();
  
  const discountPercent = {
    'bronze': 0,
    'silver': 0,      // mais livraison gratuite 1x/semaine
    'gold': 10,
    'platinum': 15,
    'diamond': 20
  }[currentLevel];
  
  const discount = (subtotal * discountPercent) / 100;
  const finalAmount = subtotal - discount;
  
  return (
    <div>
      <p>Niveau: {currentLevel} {discountPercent > 0 && `-${discountPercent}%`}</p>
      <p>Réduction: -{discount} FCFA</p>
      <p>Total: {finalAmount} FCFA</p>
    </div>
  );
}
```

#### 5.2 Gagner des points après commande

```typescript
// Dans le service de commande ou trigger:
// Quand status = 'delivered', ajouter:

const pointsEarned = Math.floor(totalAmount * 0.01); // 1 point pour 100 FCFA
await supabase.from('profiles').update({
  loyalty_points: 'loyalty_points + ' + pointsEarned
}).eq('id', customerId);
```

---

### ÉTAPE 6: Afficher le parrainage dans les menus
**Durée: 5 min**

Ajouter dans le menu principal (sidebar/navbar):

```typescript
<NavLink to="/loyalty">
  <Gift className="w-5 h-5" />
  Fidélité
</NavLink>

<NavLink to="/referral">
  <Share2 className="w-5 h-5" />
  Parrainage
</NavLink>

<NavLink to="/leaderboard">
  <Trophy className="w-5 h-5" />
  Classement
</NavLink>
```

---

### ÉTAPE 7: Intégrer referral_id au signup
**Durée: 10 min**

```typescript
// Dans SignupPage.tsx:
import { useSearchParams } from 'react-router-dom';

export default function SignupPage() {
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  
  const handleSignup = async (email, password) => {
    // 1. Créer le compte
    const { data: authData } = await supabase.auth.signUp({ email, password });
    
    // 2. Chercher le parrain
    if (referralCode) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode)
        .single();
      
      if (referrer) {
        // 3. Ajouter referred_by_id et créer la ligne referrals
        await supabase.from('profiles').update({
          referred_by_id: referrer.id
        }).eq('id', authData.user.id);
        
        await supabase.from('referrals').insert({
          referrer_id: referrer.id,
          referred_id: authData.user.id,
          referral_code: referralCode,
          status: 'pending'
        });
      }
    }
  };
}
```

---

### ÉTAPE 8: Premier défi automatique
**Durée: 5 min**

```typescript
// Créer manuellement les défis de cette semaine dans Supabase SQL:

INSERT INTO weekly_challenges (
  week_start, week_end, challenge_type, description, 
  target_value, points_reward, emoji, is_active
) VALUES 
(
  '2026-03-09'::DATE,
  '2026-03-15'::DATE,
  'order_count',
  'Commander 3 fois cette semaine',
  3,
  150,
  '🛒',
  true
),
(
  '2026-03-09'::DATE,
  '2026-03-15'::DATE,
  'new_restaurant',
  'Essayer un nouveau restaurant',
  1,
  100,
  '🍽️',
  true
);

-- Vérifier:
SELECT * FROM weekly_challenges WHERE week_start = CURRENT_DATE - INTERVAL '7 days';
```

---

## ✅ Vérification Post-Implémentation

### Test 1: Navigation
- [ ] Aller sur `/loyalty` → voir LoyaltyDashboard
- [ ] Aller sur `/referral` → voir code + stats
- [ ] Aller sur `/leaderboard` → voir classements

### Test 2: Données
```sql
-- Dans Supabase:
SELECT COUNT(*) FROM referrals;  -- Doit avoir des lignes
SELECT COUNT(*) FROM weekly_challenges WHERE is_active = true;  -- Doit avoir 4+
SELECT COUNT(*) FROM restaurant_leaderboard;  -- Croît avec les commandes
```

### Test 3: Fonctionnalité
- [ ] Créer un profil test → doit avoir un referral_code généré
- [ ] Copier code → toast "Copié!"
- [ ] Passer une commande → points gagnés (voir `loyalty_points` monter)
- [ ] Montée de niveau → notification "Niveau atteint"
- [ ] Referral: Créer 2e compte avec code de premier → status passe à 'active' après 1ère commande

### Test 4: Jobs Cron
```sql
-- Vérifier les logs des jobs:
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Doit voir: start_time, end_time, status='succeeded'
```

---

## 🐛 Troubleshooting

### "Impossible de créer referrals"
```sql
-- Vérifier les RLS policies:
SELECT * FROM pg_policies WHERE tablename = 'referrals';

-- Doit avoir: referrals_own_view
-- Si absent, exécuter 035-complete-loyalty-system.sql à nouveau
```

### "Points n'augmentent pas après commande"
```sql
-- Vérifier le trigger:
SELECT * FROM pg_trigger WHERE tgrelname IN ('update_loyalty_level_trigger', 'award_referral_bonus_trigger');

-- Vérifier manuellement:
UPDATE profiles SET loyalty_points = loyalty_points + 100 WHERE id = 'your-uuid';
SELECT loyalty_points FROM profiles WHERE id = 'your-uuid';
```

### "Cron jobs ne tournent pas"
```sql
-- Vérifier que pg_cron est activé:
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Si vide, créer:
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Vérifier les jobs:
SELECT * FROM cron.job WHERE active = true;

-- Voir les erreurs:
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## 📝 Notes Importantes

### Points expiry:
- Points expirent après **90 jours d'inactivité**
- Pas d'expiration si le client commande régulièrement (le `points_expiry_at` se remet à 0)
- Vérifier: `points_expiry_at` doit être NULL si le client a commandé récemment

### Défis:
- **Génération automatique**: Chaque lundi à 00:01 UTC (via cron)
- **Pas de doublon**: IF NOT EXISTS dans la fonction
- **Reset automatique**: Dimanche minuit, les défis de la semaine précédente deviennent inactifs

### Leaderboard:
- **Reset mensuel**: 1er du mois à 01:00 UTC
- **Ranking**: Basé sur total_points (descending)
- **VIP badge**: Seulement pour rank = 1

---

## 🎓 Exemples de Code

### Utiliser useGlobalLoyalty dans un composant:

```typescript
import { useGlobalLoyalty } from '@/hooks/useLoyalty';

export function MyComponent() {
  const {
    currentLevel,
    currentLevelData,
    points,
    nextLevel,
    pointsToNextLevel,
    progressPercent,
    referral,
    challenges,
    error
  } = useGlobalLoyalty();

  return (
    <div>
      <h2>{currentLevelData.emoji} {currentLevelData.name}</h2>
      <p>{points} / {nextLevel?.min} points</p>
      <ProgressBar value={progressPercent} />
      
      {referral && (
        <p>Code: {referral.code} ({referral.stats.activeReferrals} filleuls)</p>
      )}
      
      {challenges.map(ch => (
        <ChallengeCard key={ch.id} challenge={ch} />
      ))}
    </div>
  );
}
```

### Émettre une notification:

```typescript
await supabase.from('notifications').insert({
  user_id: userId,
  type: 'loyalty_milestone',
  title: '🎉 Bravo!',
  message: 'Vous avez atteint le niveau Or!',
  emoji: '🥇',
  data: { new_level: 'gold', points: 1500 }
});
```

---

## 📊 Monitoring

### Dashboards à créer (optionnel):
```sql
-- Points distribution
SELECT 
  loyalty_level,
  COUNT(*) as count,
  AVG(loyalty_points) as avg_points,
  MAX(loyalty_points) as max_points
FROM profiles
GROUP BY loyalty_level;

-- Referral success rate
SELECT 
  COUNT(DISTINCT referrer_id) as total_referrers,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as successful_referrals,
  ROUND(
    100.0 * COUNT(CASE WHEN status = 'active' THEN 1 END) / COUNT(*),
    2
  ) as success_rate
FROM referrals;

-- Challenge completion
SELECT 
  challenge_type,
  COUNT(*) as total,
  COUNT(CASE WHEN is_completed THEN 1 END) as completed,
  ROUND(
    100.0 * COUNT(CASE WHEN is_completed THEN 1 END) / COUNT(*),
    2
  ) as completion_rate
FROM challenge_progress
GROUP BY challenge_type;
```

---

## 🚀 Déploiement

### Checklist avant prod:
- [ ] Tous les SQL scripts exécutés
- [ ] Cron jobs actifs et testés
- [ ] Routes ajoutées dans App.tsx
- [ ] Pages testées en local
- [ ] Référence_code généré pour clients existants
- [ ] Tests de bout en bout complétés
- [ ] Documentation mise à jour
- [ ] Notification aux users de la nouvelle feature

### Lancer en prod:
```bash
git add .
git commit -m "feat: complete loyalty and referral system"
git push origin main
# Deploy to Vercel
```

---

**Version**: 1.0.0
**Date**: March 2026
**Status**: Ready for Implementation ✅
