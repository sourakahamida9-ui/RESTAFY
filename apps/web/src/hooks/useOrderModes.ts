import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface OrderMode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  config: Record<string, any>;
}

export interface UseOrderModesReturn {
  modes: OrderMode[];
  loading: boolean;
  error: Error | null;
  getModeByCode: (code: string) => OrderMode | undefined;
}

export function useOrderModes(): UseOrderModesReturn {
  const [modes, setModes] = useState<OrderMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchModes = async () => {
      try {
          const { data, error: err } = await supabase
            .from('order_modes')
            .select('id,code,name,description,icon,sort_order,config,is_active')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (err) throw err;

        setModes(data || []);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load order modes');
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchModes();
  }, []);

  const getModeByCode = (code: string): OrderMode | undefined => {
    return modes.find(m => m.code === code);
  };

  return { modes, loading, error, getModeByCode };
}
