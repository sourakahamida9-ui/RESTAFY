import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  ussd_template: string | null;
  is_active: boolean;
  sort_order: number;
  config: Record<string, any>;
}

export interface UsePaymentMethodsReturn {
  methods: PaymentMethod[];
  loading: boolean;
  error: Error | null;
  getMethodByCode: (code: string) => PaymentMethod | undefined;
  refresh: () => void;
}

export function usePaymentMethods(): UsePaymentMethodsReturn {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const { data, error: err } = await supabase
          .from('payment_methods')
          .select('id,name,type,is_active,sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (err) throw err;

        setMethods((data || []) as unknown as PaymentMethod[]);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load payment methods');
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, [reloadKey]);

  const getMethodByCode = (code: string): PaymentMethod | undefined => {
    return methods.find(m => m.code === code);
  };

  return { methods, loading, error, getMethodByCode, refresh };
}
