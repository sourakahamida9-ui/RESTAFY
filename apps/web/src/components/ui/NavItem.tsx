import React from 'react';
import { NavLink } from 'react-router-dom';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

interface NavItemProps {
  to: string;
  icon: PhosphorIcon;
  label: string;
  exact?: boolean;
  accentColor?: string;
  badge?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function NavItem({
  to,
  icon: Icon,
  label,
  exact = false,
  accentColor = '#F97316',
  badge = false,
  onClick,
}: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={exact}
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-1 flex-1 py-2 touch-manipulation transition-all duration-200 active:scale-95"
    >
      {({ isActive }) => (
        <>
          {/* Active indicator pill */}
          {isActive && (
            <div 
              className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full"
              style={{ 
                background: accentColor,
                boxShadow: `0 2px 8px ${accentColor}40`,
              }}
            />
          )}
          
          <div 
            className="relative flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-200"
            style={{
              background: isActive ? `${accentColor}15` : 'transparent',
            }}
          >
            <Icon
              size={22}
              weight={isActive ? 'fill' : 'regular'}
              style={{
                color: isActive ? accentColor : 'var(--r-nav-idle, #A1A1AA)',
                transition: 'color 150ms ease, transform 150ms ease',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
              }}
            />
            {badge && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                style={{ 
                  background: '#EF4444',
                  boxShadow: '0 0 0 2px var(--r-mobile-nav-bg, #fff), 0 0 8px rgba(239,68,68,0.5)',
                }}
              />
            )}
          </div>
          
          <span
            style={{
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              color: isActive ? accentColor : 'var(--r-nav-idle, #A1A1AA)',
              transition: 'color 150ms ease',
              lineHeight: 1,
              letterSpacing: isActive ? '0.02em' : '0',
            }}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}
