// src/hooks/useNotificationPreferences.ts
//
// Préférences de notification du restaurateur (per-device, persistées en
// localStorage). Centralise les toggles son / vibration pour qu'ils
// soient cohérents entre la page Settings et le dashboard Orders.
//
// Volontairement local au device : un restaurateur peut vouloir le son
// sur la tablette caisse mais pas sur son tel personnel. Si on veut un
// jour partager les préférences entre devices, ajouter un sync vers
// `restaurants.notification_preferences` (JSONB).

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'restafy-notif-prefs-v1';

export interface NotificationPreferences {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  soundEnabled: true,
  vibrationEnabled: true,
};

function readPrefs(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_PREFS.soundEnabled,
      vibrationEnabled: typeof parsed.vibrationEnabled === 'boolean' ? parsed.vibrationEnabled : DEFAULT_PREFS.vibrationEnabled,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: NotificationPreferences) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    // Diffuser le changement aux autres composants montés.
    window.dispatchEvent(new CustomEvent('restafy:notif-prefs-change', { detail: prefs }));
  } catch {
    // localStorage indisponible (incognito) : non-bloquant
  }
}

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => readPrefs());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPrefs(readPrefs());
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<NotificationPreferences>).detail;
      if (detail) setPrefs(detail);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('restafy:notif-prefs-change', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('restafy:notif-prefs-change', onCustom as EventListener);
    };
  }, []);

  const update = useCallback((patch: Partial<NotificationPreferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writePrefs(next);
      return next;
    });
  }, []);

  return { prefs, update };
}
