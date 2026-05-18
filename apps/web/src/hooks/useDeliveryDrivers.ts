import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type DeliveryDriver = {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

export function useDeliveryDrivers(restaurantId: string | null) {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Récupérer tous les livreurs du restaurant
  const fetchDrivers = useCallback(async () => {
    if (!restaurantId) {
      setDrivers([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from('delivery_drivers')
        .select('id,restaurant_id,name,phone,is_available,created_at,updated_at')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setDrivers(data || []);
    } catch (err: any) {
      setError(err.message);
      toast.error('Erreur chargement livreurs');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Charger à l'initialisation
  useEffect(() => {
    fetchDrivers();
  }, [restaurantId]);

  // Ajouter un livreur
  const addDriver = useCallback(
    async (name: string, phone: string) => {
      if (!restaurantId) {
        toast.error('Restaurant non trouvé');
        return false;
      }

      try {
        // Normaliser le numéro (00229 → +229)
        let normalizedPhone = phone.replace(/\s/g, '');
        if (normalizedPhone.startsWith('00229')) {
          normalizedPhone = '+229' + normalizedPhone.slice(5);
        }

        // Validation format Bénin
        if (!/^\+229[0-9]{8}$/.test(normalizedPhone)) {
          toast.error('Format invalide. Utilisez +229XXXXXXXX');
          return false;
        }

        const { data, error: err } = await supabase
          .from('delivery_drivers')
          .insert([{
            restaurant_id: restaurantId,
            name: name.trim(),
            phone: normalizedPhone,
            is_available: true,
          }])
          .select()
          .single();

        if (err) throw err;

        setDrivers(prev => [data, ...prev]);
        toast.success(`${name} ajouté(e) comme livreur`);
        return true;
      } catch (err: any) {
        toast.error('Erreur: ' + err.message);
        return false;
      }
    },
    [restaurantId]
  );

  // Supprimer un livreur
  const removeDriver = useCallback(async (driverId: string) => {
    try {
      const { error: err } = await supabase
        .from('delivery_drivers')
        .delete()
        .eq('id', driverId);

      if (err) throw err;

      setDrivers(prev => prev.filter(d => d.id !== driverId));
      toast.success('Livreur supprimé');
      return true;
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
      return false;
    }
  }, []);

  // Basculer disponibilité
  const toggleAvailability = useCallback(
    async (driverId: string, currentState: boolean) => {
      try {
        const { data, error: err } = await supabase
          .from('delivery_drivers')
          .update({ is_available: !currentState })
          .eq('id', driverId)
          .select()
          .single();

        if (err) throw err;

        setDrivers(prev =>
          prev.map(d => d.id === driverId ? data : d)
        );

        const status = !currentState ? 'disponible' : 'indisponible';
        toast.success(`Livreur marqué ${status}`);
        return true;
      } catch (err: any) {
        toast.error('Erreur: ' + err.message);
        return false;
      }
    },
    []
  );

  // Assigner un livreur à une commande
  const assignDriver = useCallback(
    async (orderId: string, driverId: string) => {
      try {
        // Trouver le livreur pour obtenir ses infos
        const driver = drivers.find(d => d.id === driverId);
        if (!driver) {
          toast.error('Livreur non trouvé');
          return false;
        }

        // Mettre à jour la commande avec le livreur
        const { error: err } = await supabase
          .from('orders')
          .update({
            driver_id: driverId,
            driver_assigned_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (err) throw err;

        toast.success('Livreur assigné');
        return { driver, orderId };
      } catch (err: any) {
        toast.error('Erreur: ' + err.message);
        return false;
      }
    },
    [drivers]
  );

  return {
    drivers,
    availableDrivers: drivers.filter(d => d.is_available),
    loading,
    error,
    fetchDrivers,
    addDriver,
    removeDriver,
    toggleAvailability,
    assignDriver,
  };
}
