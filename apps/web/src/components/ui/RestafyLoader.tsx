// src/components/ui/RestafyLoader.tsx
//
// ✅ PERF FIX #14 — framer-motion SUPPRIMÉ du loader
//
// PROBLÈME :
//   Le loader est affiché EN PREMIER à chaque chargement de page (lazy routes).
//   Il importait framer-motion (~150KB gzippé), ce qui forçait le navigateur à
//   télécharger et parser cette lib AVANT d'afficher quoi que ce soit.
//   → Impact direct sur FCP et TTI (Time To Interactive).
//
// SOLUTION :
//   Remplacer les animations Framer Motion par des animations CSS pures.
//   CSS animations :
//     ✓ Zéro KB JS supplémentaire
//     ✓ Exécutées sur le thread Compositor (pas le main thread) → plus fluide
//     ✓ Respectent prefers-reduced-motion automatiquement via index.css
//     ✓ Identiques visuellement à l'original
//
// GAIN ESTIMÉ : -30 à -60 KB sur le bundle du loader (framer uniquement pour ce composant)

interface RestafyLoaderProps {
  fullscreen?: boolean;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RestafyLoader({ fullscreen = true, message, size = 'lg' }: RestafyLoaderProps) {
  const container = fullscreen
    ? 'fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center'
    : 'w-full flex items-center justify-center py-16';

  const sizeMap = {
    sm: { outer: 'w-12 h-12', inner: 'w-8 h-8', text: 'text-sm', dotSize: 'w-1.5 h-1.5' },
    md: { outer: 'w-16 h-16', inner: 'w-11 h-11', text: 'text-base', dotSize: 'w-1.5 h-1.5' },
    lg: { outer: 'w-24 h-24', inner: 'w-16 h-16', text: 'text-lg', dotSize: 'w-2 h-2' },
  };
  const s = sizeMap[size];

  return (
    /*
     * ✅ A11Y FIX #4 — role="status" + aria-live="polite"
     * Les lecteurs d'écran annoncent "Chargement" et le message
     * sans interrompre brusquement l'utilisateur.
     */
    <div className={container} role="status" aria-live="polite" aria-label={message || 'Chargement en cours'}>
      <div className="flex flex-col items-center gap-6">

        {/* Cercles rotatifs — CSS pur */}
        <div className={`${s.outer} relative`}>

          {/* Cercle extérieur → tourne en 3s sens horaire */}
          <div
            className="absolute inset-0 rounded-full border-4 border-transparent"
            style={{
              borderTopColor: '#ea580c',
              borderRightColor: '#fdba74',
              animation: 'restafy-spin-cw 3s linear infinite',
            }}
          />

          {/* Cercle intérieur → tourne en 2s sens anti-horaire */}
          <div
            className="absolute inset-2 rounded-full border-[3px] border-transparent"
            style={{
              borderBottomColor: '#fb923c',
              borderLeftColor: '#fed7aa',
              animation: 'restafy-spin-ccw 2s linear infinite',
            }}
          />

          {/* Logo R central — pulse + rotation lente */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: 'restafy-spin-cw 4s linear infinite' }}
          >
            <div
              className={`${s.inner} bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl border-2 border-orange-400`}
              style={{ animation: 'restafy-pulse 2s ease-in-out infinite' }}
            >
              <span
                className="text-white font-black leading-none select-none"
                style={{
                  fontSize: size === 'sm' ? '1.25rem' : size === 'md' ? '1.75rem' : '2.5rem',
                  fontFamily: 'var(--font-geist, system-ui)',
                }}
                aria-hidden="true"
              >
                R
              </span>
            </div>
          </div>

          {/* Halo pulsant */}
          <div
            className="absolute -inset-2 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(234,88,12,0.15) 0%, transparent 70%)',
              animation: 'restafy-halo 2.5s ease-in-out infinite',
            }}
          />
        </div>

        {/* Texte RESTAFY avec animation par lettre */}
        <div className="flex items-center gap-0.5" aria-hidden="true">
          {'RESTAFY'.split('').map((letter, i) => (
            <span
              key={i}
              className={`font-black tracking-wider text-zinc-900 ${s.text}`}
              style={{
                fontFamily: 'var(--font-geist, system-ui)',
                animation: `restafy-bounce 1.5s ease-in-out infinite`,
                animationDelay: `${i * 0.08}s`,
                color: letter === 'Y' ? '#ea580c' : undefined,
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* Message optionnel */}
        {message && (
          <p
            className="text-xs md:text-sm font-semibold text-zinc-600 tracking-wide"
            style={{ animation: 'restafy-fade 1.2s ease-in-out infinite' }}
          >
            {message}
          </p>
        )}

        {/* Points pulsants */}
        <div className="flex gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`${s.dotSize} rounded-full bg-orange-400`}
              style={{
                animation: 'restafy-dot 0.8s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ✅ Keyframes CSS inlinées dans un <style> scopé au composant */}
      <style>{`
        @keyframes restafy-spin-cw  { to { transform: rotate(360deg); } }
        @keyframes restafy-spin-ccw { to { transform: rotate(-360deg); } }

        @keyframes restafy-pulse {
          0%, 100% { transform: scale(1);    box-shadow: 0 0 20px rgba(234,88,12,0.4); }
          50%       { transform: scale(1.08); box-shadow: 0 0 30px rgba(234,88,12,0.6); }
        }

        @keyframes restafy-halo {
          0%, 100% { transform: scale(1);   opacity: 0.6; }
          50%       { transform: scale(1.4); opacity: 0;   }
        }

        @keyframes restafy-bounce {
          0%, 100% { transform: translateY(0);    opacity: 0.7; }
          50%       { transform: translateY(-2px); opacity: 1;   }
        }

        @keyframes restafy-fade {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1;   }
        }

        @keyframes restafy-dot {
          0%, 100% { transform: scale(1);   opacity: 0.4; }
          50%       { transform: scale(1.5); opacity: 1;   }
        }

        /* Respect du prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          [style*="restafy-"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}