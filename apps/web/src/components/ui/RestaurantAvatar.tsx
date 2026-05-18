import { useState } from 'react';
import { cn } from '@/lib/utils';

const PALETTES: Array<[string, string]> = [
  ['#f97316', '#ea580c'],
  ['#fb7185', '#e11d48'],
  ['#38bdf8', '#2563eb'],
  ['#22c55e', '#15803d'],
  ['#a78bfa', '#7c3aed'],
  ['#f59e0b', '#d97706'],
];

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function RestaurantAvatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const safeName = name || 'Restaurant';
  const [from, to] = PALETTES[safeName.charCodeAt(0) % PALETTES.length];
  const classes = cn(
    'inline-flex items-center justify-center overflow-hidden bg-zinc-100 text-white font-black object-cover',
    className
  );

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={safeName}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={classes}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div
      className={cn('select-none', classes)}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-label={safeName}
    >
      {getInitials(safeName)}
    </div>
  );
}

export default RestaurantAvatar;
