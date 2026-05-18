# 💻 Code Examples - Loyalty System

Collection d'exemples prêts à copier-coller pour intégrer le système de fidélité.

---

## 🪝 Hook: useGlobalLoyalty()

### Utilisation basique dans un composant

```typescript
import { useGlobalLoyalty } from '@/hooks/useLoyalty';

export function MyLoyaltyComponent() {
  const {
    currentLevel,           // 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
    currentLevelData,       // { min, max, name, emoji, color }
    points,                 // 1234 (nombre total)
    nextLevel,              // 'silver'
    nextLevelData,          // { min: 500, max: 1499, ... }
    pointsToNextLevel,      // 342 (points manquants)
    progressPercent,        // 45 (0-100)
    referral,               // { code, link, stats }
    challenges,             // array de défis
    isLoading,              // boolean
    error,                  // error message ou null
    refetch                 // () => void (rafraîchir les données)
  } = useGlobalLoyalty();

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;

  return (
    <div>
      <h2>{currentLevelData.emoji} {currentLevelData.name}</h2>
      <p>{points} points • {pointsToNextLevel} avant {nextLevel}</p>
      <ProgressBar value={progressPercent} max={100} />
    </div>
  );
}
```

---

## 📱 Composant: Affichage du Niveau

```typescript
export function LevelCard() {
  const { currentLevel, currentLevelData, points, nextLevelData, progressPercent } = useGlobalLoyalty();

  return (
    <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-8 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold uppercase opacity-75">Niveau actuel</p>
          <p className="text-4xl font-black">{currentLevelData.emoji} {currentLevelData.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold opacity-75">Points totaux</p>
          <p className="text-3xl font-black">{points}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm font-bold opacity-75">
          <span>Progression vers {nextLevelData?.name}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs opacity-75">
          {points.toLocaleString()} / {nextLevelData?.max.toLocaleString()} points
        </p>
      </div>
    </div>
  );
}
```

---

## 🎁 Composant: Affichage du Code Parrainage

```typescript
import { Copy, Check, Share2 } from 'lucide-react';
import { useGlobalLoyalty } from '@/hooks/useLoyalty';
import { useState } from 'react';

export function ReferralCodeCard() {
  const { referral } = useGlobalLoyalty();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = () => {
    const message = `Rejoignez Restafy avec mon code ${referral?.code}! Tu reçois -500 FCFA sur ta première commande. ${referral?.link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
  };

  if (!referral) return <div>Chargement...</div>;

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-4">
      {/* Code Display */}
      <div>
        <p className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">Votre code unique</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={referral.code}
            readOnly
            className="flex-1 px-4 py-3 border-2 border-orange-200 rounded-lg font-bold text-center bg-orange-50 text-orange-600 text-lg"
          />
          <button
            onClick={() => copyToClipboard(referral.code)}
            className="p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="grid grid-cols-3 gap-2 pt-4">
        <button
          onClick={openWhatsApp}
          className="bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition font-bold text-sm"
        >
          💬 WhatsApp
        </button>
        <button
          onClick={() => copyToClipboard(referral.link)}
          className="bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition font-bold text-sm"
        >
          🔗 Copy Link
        </button>
        <button
          onClick={() => copyToClipboard(referral.code)}
          className="bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition font-bold text-sm"
        >
          📋 Code
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-200">
        <div className="text-center">
          <p className="text-2xl font-black text-gray-900">{referral.stats.totalReferrals}</p>
          <p className="text-xs text-gray-600">Inscrites</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-gray-900">{referral.stats.activeReferrals}</p>
          <p className="text-xs text-gray-600">Actifs</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-orange-600">+{referral.stats.pointsFromReferrals}</p>
          <p className="text-xs text-gray-600">Points</p>
        </div>
      </div>
    </div>
  );
}
```

---

## 🎯 Composant: Challenge Card

```typescript
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export function ChallengeCard({ challenge }) {
  const { description, target_value, progress_value, points_reward, emoji, is_completed } = challenge;
  const percent = Math.min(100, (progress_value / target_value) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border-2 transition ${
        is_completed ? 'border-green-500 bg-green-50' : 'border-orange-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="text-3xl">{emoji}</div>
          <div className="flex-1">
            <p className="font-bold text-gray-900">{description}</p>
            <p className="text-xs text-gray-600 mt-1">
              {progress_value} / {target_value}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-100">
          <span className="font-bold text-orange-600 text-sm">+{points_reward}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full transition ${is_completed ? 'bg-green-500' : 'bg-gradient-to-r from-orange-400 to-orange-600'}`}
        />
      </div>

      {/* Completed Badge */}
      {is_completed && (
        <div className="flex items-center gap-2 mt-3 text-green-600 font-bold text-sm">
          <Check className="w-4 h-4" />
          Complété!
        </div>
      )}
    </motion.div>
  );
}
```

---

## 💳 Intégrer au Checkout

### Appliquer réduction basée sur niveau

```typescript
import { useGlobalLoyalty } from '@/hooks/useLoyalty';

export function OrderSummary({ subtotal, tax, shippingCost }) {
  const { currentLevel } = useGlobalLoyalty();

  // Définir réductions par niveau
  const discountPercent = {
    'bronze': 0,
    'silver': 0,       // Livraison gratuite 1x/semaine (géré séparément)
    'gold': 10,
    'platinum': 15,
    'diamond': 20
  }[currentLevel] || 0;

  const discount = (subtotal * discountPercent) / 100;
  const total = subtotal + tax + shippingCost - discount;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Sous-total</span>
          <span>{subtotal.toFixed(0)} FCFA</span>
        </div>
        <div className="flex justify-between">
          <span>Frais de livraison</span>
          <span>{shippingCost.toFixed(0)} FCFA</span>
        </div>
        <div className="flex justify-between">
          <span>Taxe</span>
          <span>{tax.toFixed(0)} FCFA</span>
        </div>

        {discountPercent > 0 && (
          <div className="flex justify-between text-green-600 font-bold">
            <span>Réduction ({discountPercent}%)</span>
            <span>-{discount.toFixed(0)} FCFA</span>
          </div>
        )}
      </div>

      <div className="border-t pt-4 flex justify-between font-bold text-lg">
        <span>Total</span>
        <span>{total.toFixed(0)} FCFA</span>
      </div>

      {discountPercent > 0 && (
        <div className="text-sm text-green-600 font-bold">
          ✓ Réduction {currentLevel} appliquée!
        </div>
      )}
    </div>
  );
}
```

---

## 📦 Gagner des points après commande

### Fonction à ajouter dans le service de commande

```typescript
import { supabase } from '@/lib/supabase';

export async function awardLoyaltyPoints(
  customerId: string,
  restaurantId: string,
  totalAmount: number
) {
  try {
    // 1 point pour 100 FCFA
    const pointsEarned = Math.floor(totalAmount * 0.01);

    // Update points (le trigger update_loyalty_level_trigger se déclenche automatiquement)
    const { error } = await supabase
      .from('profiles')
      .update({
        loyalty_points: supabase.raw(`loyalty_points + ${pointsEarned}`),
        // Reset l'expiration si le client commande régulièrement
        points_expiry_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      })
      .eq('id', customerId);

    if (error) throw error;

    // Update leaderboard (dupliqué ou via trigger)
    await updateLeaderboardEntry(customerId, restaurantId, pointsEarned);

    // Send notification
    await supabase.from('notifications').insert({
      user_id: customerId,
      type: 'points_earned',
      title: `+${pointsEarned} points gagnés! 🎉`,
      message: `Merci pour votre commande de ${totalAmount} FCFA`,
      emoji: '⭐',
      data: { points: pointsEarned }
    });

    console.log('[v0] Awarded', pointsEarned, 'points to', customerId);
    return { success: true, pointsEarned };
  } catch (error) {
    console.error('[v0] Error awarding points:', error);
    return { success: false, error };
  }
}

// Appel dans le handler de commande complétée:
async function handleOrderDelivered(orderId: string) {
  const order = await getOrder(orderId);
  await awardLoyaltyPoints(order.customer_id, order.restaurant_id, order.total_amount);
}
```

---

## 🔗 Intégrer referral_id au signup

### Modifier le formulaire d'inscription

```typescript
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function SignupForm() {
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  const [referrerInfo, setReferrerInfo] = useState(null);

  // Afficher le parrain si code valide
  useEffect(() => {
    if (referralCode) {
      checkReferralCode(referralCode);
    }
  }, [referralCode]);

  const checkReferralCode = async (code: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('referral_code', code)
      .single();

    if (data) {
      setReferrerInfo(data);
    }
  };

  const handleSignup = async (email: string, password: string, fullName: string) => {
    try {
      // 1. Créer le compte auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError) throw authError;

      const userId = authData.user?.id;

      // 2. Créer le profil
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        full_name: fullName,
        email: email,
        loyalty_points: 0,
        loyalty_level: 'bronze'
      });

      if (profileError) throw profileError;

      // 3. Si referral code valide, créer la ligne referrals
      if (referrerInfo) {
        const { error: referralError } = await supabase.from('referrals').insert({
          referrer_id: referrerInfo.id,
          referred_id: userId,
          referral_code: referralCode,
          status: 'pending'
        });

        if (referralError) throw referralError;

        // Update referred_by_id
        await supabase
          .from('profiles')
          .update({ referred_by_id: referrerInfo.id })
          .eq('id', userId);

        // Send notification au parrain
        await supabase.from('notifications').insert({
          user_id: referrerInfo.id,
          type: 'referral_signup',
          title: '✨ Nouveau filleul!',
          message: `${fullName} s'est inscrit avec votre code ${referralCode}!`,
          emoji: '✨',
          data: { referral_code: referralCode }
        });
      }

      // Success
      return { success: true, userId };
    } catch (error) {
      console.error('[v0] Signup error:', error);
      return { success: false, error };
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSignup(email, password, fullName);
    }}>
      {/* Afficher si parrain trouvé */}
      {referrerInfo && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-lg mb-4">
          Vous êtes parrainé par <strong>{referrerInfo.full_name}</strong>
          <br />
          Vous recevrez -500 FCFA sur votre première commande! 🎉
        </div>
      )}

      {/* Form inputs... */}
    </form>
  );
}
```

---

## 📊 Query: Statistiques fidélité

```typescript
// Service: loyaltyService.ts

export async function getLoyaltyStats() {
  const { data, error } = await supabase
    .from('profiles')
    .select('loyalty_level, COUNT(*) as count, AVG(loyalty_points) as avg_points');

  if (error) throw error;

  return {
    byLevel: data,
    totalCustomers: data.reduce((sum, row) => sum + row.count, 0),
    avgPoints: data.reduce((sum, row) => sum + row.avg_points, 0) / data.length
  };
}

export async function getReferralStats() {
  const { data, error } = await supabase
    .from('referrals')
    .select('status, COUNT(*) as count')
    .group_by('status');

  if (error) throw error;

  const pending = data.find(d => d.status === 'pending')?.count || 0;
  const active = data.find(d => d.status === 'active')?.count || 0;

  return {
    total: pending + active,
    pending,
    active,
    conversionRate: ((active / (pending + active)) * 100).toFixed(1) + '%'
  };
}

export async function getChallengeStats(weekStart: Date) {
  const { data, error } = await supabase
    .from('challenge_progress')
    .select('is_completed, COUNT(*) as count')
    .gte('created_at', weekStart.toISOString())
    .group_by('is_completed');

  if (error) throw error;

  const completed = data.find(d => d.is_completed)?.count || 0;
  const total = data.reduce((sum, row) => sum + row.count, 0);

  return {
    total,
    completed,
    completionRate: ((completed / total) * 100).toFixed(1) + '%'
  };
}
```

---

## 🧪 Test: Vérifier les données

```sql
-- Vérifier les niveaux de fidélité
SELECT 
  loyalty_level,
  COUNT(*) as customer_count,
  AVG(loyalty_points) as avg_points,
  MAX(loyalty_points) as max_points
FROM profiles
GROUP BY loyalty_level
ORDER BY COUNT(*) DESC;

-- Vérifier le parrainage
SELECT 
  r.status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (NOW() - r.created_at))/86400)::INT as avg_days_active
FROM referrals r
GROUP BY r.status;

-- Vérifier les défis de cette semaine
SELECT 
  wc.description,
  COUNT(cp.id) as total_participants,
  COUNT(CASE WHEN cp.is_completed THEN 1 END) as completed,
  ROUND(100.0 * COUNT(CASE WHEN cp.is_completed THEN 1 END) / COUNT(*), 1) as completion_percent
FROM weekly_challenges wc
LEFT JOIN challenge_progress cp ON wc.id = cp.challenge_id
WHERE wc.week_start >= DATE_TRUNC('week', CURRENT_DATE)::DATE
GROUP BY wc.id, wc.description;

-- Vérifier le leaderboard
SELECT 
  rl.rank,
  p.full_name,
  rl.total_points,
  rl.total_spent,
  (SELECT name FROM restaurants WHERE id = rl.restaurant_id) as restaurant
FROM restaurant_leaderboard rl
JOIN profiles p ON rl.customer_id = p.id
WHERE rl.rank <= 10
ORDER BY rl.restaurant_id, rl.rank;
```

---

## 🔔 Notifications

```typescript
// Quand niveau monte
await supabase.from('notifications').insert({
  user_id: customerId,
  type: 'level_up',
  title: `🎉 Nouveau niveau!`,
  message: `Bravo! Vous êtes passé au niveau ${newLevel}`,
  emoji: '🎉',
  data: { old_level: oldLevel, new_level: newLevel, points: totalPoints }
});

// Quand filleul commande
await supabase.from('notifications').insert({
  user_id: referrerId,
  type: 'referral_active',
  title: '✨ Filleul actif!',
  message: `${referredName} vient de commander! Vous gagnez 200 points`,
  emoji: '✨',
  data: { referral_id: referralId, points: 200 }
});

// Points expirent bientôt
await supabase.from('notifications').insert({
  user_id: customerId,
  type: 'points_expiring',
  title: '⚠️ Points en danger!',
  message: `${pointsAmount} points expirent dans 14 jours. Commandez maintenant!`,
  emoji: '⚠️',
  data: { points_amount: pointsAmount, expiry_date: expiryDate }
});

// Challenge complété
await supabase.from('notifications').insert({
  user_id: customerId,
  type: 'challenge_completed',
  title: `✅ Défi complété!`,
  message: `${challengeDescription} - Vous gagnez ${pointsReward} points`,
  emoji: '✅',
  data: { challenge_id: challengeId, points_reward: pointsReward }
});
```

---

## 📱 Type TypeScript: Loyalty

```typescript
export interface LoyaltyLevel {
  min: number;
  max: number;
  name: string;
  emoji: string;
  color: string;
  benefits: string[];
}

export interface LoyaltyProfile {
  id: string;
  loyalty_points: number;
  loyalty_level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  referral_code: string | null;
  referred_by_id: string | null;
  points_expiry_at: string | null;
  is_vip: boolean;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_code: string;
  status: 'pending' | 'first_order_completed' | 'active';
  created_at: string;
}

export interface WeeklyChallenge {
  id: string;
  week_start: string;
  week_end: string;
  challenge_type: 'order_count' | 'new_restaurant' | 'early_order' | 'share_event';
  description: string;
  target_value: number;
  points_reward: number;
  emoji: string;
  is_active: boolean;
}

export interface ChallengeProgress {
  id: string;
  customer_id: string;
  challenge_id: string;
  progress_value: number;
  is_completed: boolean;
  completed_at: string | null;
}

export interface RestaurantLeaderboard {
  id: string;
  restaurant_id: string;
  customer_id: string;
  rank: number;
  total_points: number;
  total_spent: number;
  last_updated: string;
}
```

---

**Fin des exemples. Pour plus de détails, consulter les fichiers de documentation complète.**
