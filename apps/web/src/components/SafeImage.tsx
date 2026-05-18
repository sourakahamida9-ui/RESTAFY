import React, { useState, useEffect, memo } from 'react';
import { AlertCircle } from 'lucide-react';

interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackType?: 'avatar' | 'placeholder' | 'icon';
  initials?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync';
  /** Attribut `sizes` pour le navigateur (responsive / LCP). */
  sizes?: string;
  /** Above-the-fold : `loading=eager` + fetchPriority high (pas de placeholder blur sans fichier dédié). */
  priority?: boolean;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  crossOrigin?: 'anonymous' | 'use-credentials' | boolean;
}

const generateColorFromString = (str: string): string => {
  const colors = [
    '#FF6B00', // Orange (Restafy primary)
    '#FF8C42',
    '#FFB366',
    '#FFC99D',
    '#E85D04',
    '#D62828',
    '#F77F00',
    '#FCBF49',
    '#06A77D',
    '#2A9D8F',
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const SafeImage: React.FC<SafeImageProps> = memo(function SafeImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackType = 'avatar',
  initials = '?',
  color,
  size = 'md',
  loading = 'lazy',
  decoding = 'async',
  sizes,
  priority = false,
  referrerPolicy,
  crossOrigin,
}) {
  const [isLoading, setIsLoading] = useState(!!src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoading(!!src);
    setHasError(false);
  }, [src]);

  const sizeMap = {
    sm: { skeleton: 'w-8 h-8', avatar: 'text-xs' },
    md: { skeleton: 'w-12 h-12', avatar: 'text-lg' },
    lg: { skeleton: 'w-24 h-24', avatar: 'text-3xl' },
  };

  const bgColor = color || generateColorFromString(initials);

  // Si pas de src ou erreur, afficher le fallback
  if (!src || hasError) {
    if (fallbackType === 'avatar') {
      return (
        <div
          className={`flex items-center justify-center font-bold text-white rounded-lg ${sizeMap[size].avatar}`}
          style={{ backgroundColor: bgColor }}
          title={alt}
        >
          {initials.slice(0, 2).toUpperCase()}
        </div>
      );
    }

    if (fallbackType === 'placeholder') {
      return (
        <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
          <AlertCircle className="w-8 h-8 text-gray-400" />
        </div>
      );
    }

    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <AlertCircle className="w-6 h-6 text-gray-400" />
      </div>
    );
  }

  // Image loading
  if (isLoading) {
    return (
      <div className={`${sizeMap[size].skeleton} bg-gray-200 rounded-lg animate-pulse`} />
    );
  }

  const eager = priority || loading === 'eager';
  const cors =
    crossOrigin === true ? 'anonymous' : crossOrigin === false || crossOrigin == null ? undefined : crossOrigin;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      sizes={sizes}
      onLoad={() => setIsLoading(false)}
      onError={() => {
        setIsLoading(false);
        setHasError(true);
      }}
      loading={eager ? 'eager' : loading}
      decoding={decoding}
      fetchPriority={priority ? 'high' : undefined}
      referrerPolicy={referrerPolicy}
      {...(cors ? { crossOrigin: cors } : {})}
    />
  );
});

export default SafeImage;
