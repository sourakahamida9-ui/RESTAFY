// src/hooks/useReservations.ts
// Gestion complète des réservations de table

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatSupabaseErr } from '@/lib/formatSupabaseError';
import { toast } from 'sonner';

export type ReservationStatus = 'pending' | 'confirmed' | 'refused' | 'cancelled' | 'completed';

export interface TableReservation {
  id: string;
  restaurant_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  notes: string | null;
  status: ReservationStatus;
  table_number: string | null;
  confirmed_at: string | null;
  refused_reason: string | null;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateReservationPayload {
  restaurant_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  notes?: string;
  customer_id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook pour le restaurant — gérer ses réservations
// ─────────────────────────────────────────────────────────────────────────────
export function useRestaurantReservations(restaurantId: string | null) {
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReservations = useCallback(async (dateFilter?: string) => {
    if (!restaurantId) {
      setReservations([]);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('table_reservations')
        .select(
          'id,restaurant_id,customer_id,customer_name,customer_phone,customer_email,party_size,reservation_date,reservation_time,notes,status,table_number,confirmed_at,refused_reason,reminder_sent,created_at,updated_at'
        )
        .eq('restaurant_id', restaurantId)
        .order('reservation_date', { ascending: true })
        .order('reservation_time', { ascending: true });

      if (dateFilter) {
        query = query.eq('reservation_date', dateFilter);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setReservations((data ?? []) as TableReservation[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur chargement réservations';
      setError(msg);
      toast.error('Erreur chargement réservations');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void fetchReservations();
  }, [fetchReservations]);

  // Réservations Realtime
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`reservations:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_reservations',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReservations((prev) => {
              const newRes = payload.new as TableReservation;
              // Trier par date/heure
              return [...prev, newRes].sort((a, b) => {
                const da = `${a.reservation_date}T${a.reservation_time}`;
                const db = `${b.reservation_date}T${b.reservation_time}`;
                return da.localeCompare(db);
              });
            });
            toast.info('Nouvelle réservation reçue !', { duration: 5000 });
          } else if (payload.eventType === 'UPDATE') {
            setReservations((prev) =>
              prev.map((r) => (r.id === payload.new.id ? (payload.new as TableReservation) : r))
            );
          } else if (payload.eventType === 'DELETE') {
            setReservations((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const confirmReservation = useCallback(
    async (reservationId: string, tableNumber?: string) => {
      try {
        const { error: err } = await supabase
          .from('table_reservations')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            table_number: tableNumber ?? null,
          })
          .eq('id', reservationId)
          .eq('restaurant_id', restaurantId ?? '');

        if (err) throw err;
        toast.success('Réservation confirmée');
        await fetchReservations();
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur';
        toast.error('Erreur: ' + msg);
        return false;
      }
    },
    [restaurantId, fetchReservations]
  );

  const refuseReservation = useCallback(
    async (reservationId: string, reason?: string) => {
      try {
        const { error: err } = await supabase
          .from('table_reservations')
          .update({
            status: 'refused',
            refused_reason: reason ?? null,
          })
          .eq('id', reservationId)
          .eq('restaurant_id', restaurantId ?? '');

        if (err) throw err;
        toast.success('Réservation refusée');
        await fetchReservations();
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur';
        toast.error('Erreur: ' + msg);
        return false;
      }
    },
    [restaurantId, fetchReservations]
  );

  const completeReservation = useCallback(
    async (reservationId: string) => {
      try {
        const { error: err } = await supabase
          .from('table_reservations')
          .update({ status: 'completed' })
          .eq('id', reservationId)
          .eq('restaurant_id', restaurantId ?? '');

        if (err) throw err;
        toast.success('Réservation marquée terminée');
        await fetchReservations();
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur';
        toast.error('Erreur: ' + msg);
        return false;
      }
    },
    [restaurantId, fetchReservations]
  );

  // Statistiques par statut
  const stats = {
    pending: reservations.filter((r) => r.status === 'pending').length,
    confirmed: reservations.filter((r) => r.status === 'confirmed').length,
    today: reservations.filter((r) => r.reservation_date === new Date().toISOString().split('T')[0]).length,
    total: reservations.length,
  };

  return {
    reservations,
    loading,
    error,
    stats,
    fetchReservations,
    confirmReservation,
    refuseReservation,
    completeReservation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonction utilitaire — créer une réservation (côté client)
// ─────────────────────────────────────────────────────────────────────────────
export async function createReservation(payload: CreateReservationPayload): Promise<{
  success: boolean;
  data?: TableReservation;
  error?: string;
}> {
  try {
    const row: Record<string, unknown> = {
      restaurant_id: payload.restaurant_id,
      customer_name: payload.customer_name,
      customer_phone: payload.customer_phone,
      party_size: payload.party_size,
      reservation_date: payload.reservation_date,
      reservation_time: payload.reservation_time,
    };
    if (payload.customer_email?.trim()) row.customer_email = payload.customer_email.trim();
    if (payload.notes?.trim()) row.notes = payload.notes.trim();
    if (payload.customer_id) row.customer_id = payload.customer_id;

    // Invité non connecté : pas de .select() — la RLS autorise INSERT public mais pas SELECT sur la ligne créée
    // (customer_id NULL ne matche aucune policy de lecture). Les comptes connectés peuvent relire leur ligne.
    if (payload.customer_id) {
      const { data, error: err } = await supabase
        .from('table_reservations')
        .insert([row])
        .select(
          'id,restaurant_id,customer_id,customer_name,customer_phone,customer_email,party_size,reservation_date,reservation_time,notes,status,table_number,confirmed_at,refused_reason,reminder_sent,created_at,updated_at',
        )
        .single();
      if (err) throw err;
      return { success: true, data: data as TableReservation };
    }

    const { error: err } = await supabase.from('table_reservations').insert([row]);
    if (err) throw err;
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: formatSupabaseErr(err) };
  }
}
