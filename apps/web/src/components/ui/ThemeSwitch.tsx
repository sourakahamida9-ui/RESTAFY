import React from 'react';
import { SunDim, Moon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface ThemeSwitchProps {
  theme: 'dark' | 'light';
  onToggle: () => void;
  className?: string;
}

export function ThemeSwitch({ theme, onToggle, className }: ThemeSwitchProps) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode nuit'}
      onClick={onToggle}
      className={cn(
        'relative inline-flex items-center rounded-full p-0.5 transition-colors duration-300',
        className,
      )}
      style={{
        width: 52,
        height: 28,
        backgroundColor: isDark ? '#262626' : '#E5E5E5',
      }}
    >
      {/* Thumb */}
      <span
        className="flex items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-300"
        style={{
          width: 22,
          height: 22,
          transform: isDark ? 'translateX(24px)' : 'translateX(1px)',
        }}
      >
        {isDark ? (
          <Moon size={14} weight="fill" className="text-zinc-700" />
        ) : (
          <SunDim size={14} weight="fill" className="text-amber-500" />
        )}
      </span>
    </button>
  );
}
