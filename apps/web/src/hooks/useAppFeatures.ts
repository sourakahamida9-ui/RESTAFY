// src/hooks/useAppFeatures.ts
// ✅ Zéro console.log en production — types stricts

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface AppFeature {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  config: Record<string, unknown>;
}

export interface UseAppFeaturesReturn {
  features:         AppFeature[];
  loading:          boolean;
  error:            Error | null;
  isFeatureEnabled: (code: string) => boolean;
  getFeatureConfig: (code: string) => Record<string, unknown>;
}

export function useAppFeatures(): UseAppFeaturesReturn {
  const [features, setFeatures] = useState<AppFeature[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchFeatures = async () => {
      try {
        const { data, error: err } = await supabase
          .from('app_features')
          .select('id,name,is_enabled,description');

        if (err) throw err;
        if (mounted) setFeatures((data as AppFeature[]) ?? []);
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load app features'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchFeatures();

    return () => { mounted = false; };
  }, []);

  const isFeatureEnabled = (code: string): boolean =>
    features.find((f) => f.code === code)?.is_enabled ?? false;

  const getFeatureConfig = (code: string): Record<string, unknown> =>
    features.find((f) => f.code === code)?.config ?? {};

  return { features, loading, error, isFeatureEnabled, getFeatureConfig };
}
