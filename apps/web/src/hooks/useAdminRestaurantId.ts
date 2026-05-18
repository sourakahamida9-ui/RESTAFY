import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { invalidateProfileCache } from '@/lib/authSync';
import { useAuth } from '@/hooks/useAuth';

/**
 * Identifiant restaurant pour le back-office : profil OU fiche `restaurant_staff`.
 * Synchronise `profiles.restaurant_id` quand l’utilisateur n’a que la fiche équipe
 * (sinon AdminLayout, Commandes, POS ne voient rien et le temps réel ne démarre pas).
 */
export function useAdminRestaurantId(): string | null {
  const { profile, staffInfo, user, refreshProfile } = useAuth();
  const syncAttempted = useRef(false);

  const effective = profile?.restaurant_id ?? staffInfo?.restaurant_id ?? null;

  useEffect(() => {
    if (!user?.id || !profile) return;
    if (profile.restaurant_id) {
      syncAttempted.current = false;
      return;
    }
    const rid = staffInfo?.restaurant_id;
    if (!rid || syncAttempted.current) return;

    syncAttempted.current = true;
    void (async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ restaurant_id: rid })
        .eq('id', user.id);
      if (error) {
        syncAttempted.current = false;
        return;
      }
      invalidateProfileCache(user.id);
      await refreshProfile();
    })();
  }, [user?.id, profile, staffInfo?.restaurant_id, refreshProfile]);

  return effective;
}
