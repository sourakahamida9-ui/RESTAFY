import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRestaurantTheme } from '@/context/RestaurantThemeContext';

type Props = {
  className?: string;
  variant?: 'icon' | 'segmented';
};

export function RestaurantThemeToggle({ className, variant = 'icon' }: Props) {
  const { theme, setTheme } = useRestaurantTheme();

  if (variant === 'segmented') {
    return (
      <div
        className={cn('flex w-full max-w-md rounded-xl p-1 border', className)}
        style={{
          backgroundColor: 'var(--r-surface)',
          borderColor: 'var(--r-header-border)',
        }}
        role="group"
        aria-label="Thème d'affichage"
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          aria-pressed={theme === 'light'}
          className={cn(
            'flex flex-1 min-w-0 items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all',
            theme === 'light'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
              : 'text-[color:var(--r-nav-idle)] hover:text-[color:var(--r-nav-hover)]'
          )}
        >
          <Sun className="w-4 h-4 shrink-0" aria-hidden />
          <span className="truncate">Clair</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          aria-pressed={theme === 'dark'}
          className={cn(
            'flex flex-1 min-w-0 items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all',
            theme === 'dark'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
              : 'text-[color:var(--r-nav-idle)] hover:text-[color:var(--r-nav-hover)]'
          )}
        >
          <Moon className="w-4 h-4 shrink-0" aria-hidden />
          <span className="truncate">Nuit</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode nuit'}
      aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode nuit'}
      className={cn(
        'p-2.5 rounded-xl transition-all border',
        className
      )}
      style={{
        backgroundColor: 'var(--r-surface)',
        borderColor: 'var(--r-header-border)',
        color: 'var(--r-nav-hover)',
      }}
    >
      {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-zinc-600" />}
    </button>
  );
}
