import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type RestaurantTheme = 'dark' | 'light';

const STORAGE_KEY = 'restafy-restaurant-theme';

type RestaurantThemeContextValue = {
  theme: RestaurantTheme;
  setTheme: (t: RestaurantTheme) => void;
  toggleTheme: () => void;
};

const RestaurantThemeContext = createContext<RestaurantThemeContextValue | null>(null);

function readStoredTheme(): RestaurantTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

export function RestaurantThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<RestaurantTheme>(() =>
    typeof window !== 'undefined' ? readStoredTheme() : 'light'
  );

  const setTheme = useCallback((t: RestaurantTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <RestaurantThemeContext.Provider value={value}>{children}</RestaurantThemeContext.Provider>
  );
}

export function useRestaurantTheme() {
  const ctx = useContext(RestaurantThemeContext);
  if (!ctx) {
    throw new Error('useRestaurantTheme doit être utilisé dans RestaurantThemeProvider');
  }
  return ctx;
}
