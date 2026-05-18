import { Navigate, useLocation, useParams } from 'react-router-dom';

/**
 * Anciennes URLs en deux segments : /@slug/full → /r/slug
 * (React Router v6 : éviter les routes basées sur le caractère @.)
 */
export function LegacyAtFullPathRedirect() {
  const { slugSeg } = useParams<{ slugSeg: string }>();
  const { search, hash } = useLocation();
  if (!slugSeg?.startsWith('@')) {
    return <Navigate to={slugSeg ? `/${slugSeg}${search}${hash}` : `/${search}${hash}`} replace />;
  }
  return <Navigate to={`/r/${slugSeg.slice(1)}${search}${hash}`} replace />;
}
