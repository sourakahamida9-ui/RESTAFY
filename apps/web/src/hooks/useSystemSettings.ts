import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface SystemSetting {
  id: string;
  key: string;
  value: Record<string, any>;
  description: string | null;
  category: string;
  is_public: boolean;
}

export interface UseSystemSettingsReturn {
  settings: Record<string, any>;
  loading: boolean;
  error: Error | null;
  getSetting: (key: string, defaultValue?: any) => any;
}

export function useSystemSettings(): UseSystemSettingsReturn {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error: err } = await supabase
          .from('system_settings')
          .select('key,value')
          .eq('is_public', true);

        if (err) throw err;

        // Convert to key-value object
        const settingsMap: Record<string, any> = {};
        data?.forEach(setting => {
          settingsMap[setting.key] = setting.value;
        });

        setSettings(settingsMap);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load settings');
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const getSetting = (key: string, defaultValue: any = null) => {
    return settings[key] ?? defaultValue;
  };

  return { settings, loading, error, getSetting };
}
