import { memo } from 'react';

type OptimizedImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  /** LCP / hero : eager + fetchPriority high */
  priority?: boolean;
};

/**
 * <img> optimisé pour la perf (lazy, decoding async, sizes, fetchPriority).
 * Sans état interne — adapté aux listes / grilles nombreuses.
 */
export const OptimizedImg = memo(function OptimizedImg({
  priority = false,
  sizes,
  decoding = 'async',
  loading,
  alt,
  ...rest
}: OptimizedImgProps) {
  return (
    <img
      alt={alt}
      sizes={sizes}
      decoding={decoding}
      loading={loading ?? (priority ? 'eager' : 'lazy')}
      fetchPriority={priority ? 'high' : undefined}
      {...rest}
    />
  );
});
