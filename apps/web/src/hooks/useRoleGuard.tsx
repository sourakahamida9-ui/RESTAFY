// useRoleGuard.tsx - Role-based access control hook with JSX support
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

interface UseRoleGuardOptions {
  requiredRoles: string[];
  redirectTo?: string;
}

function normalizeRoleString(role: string): string {
  return role === 'superadmin' ? 'super_admin' : role;
}

function profileMatchesRoles(profileRole: string, requiredRoles: string[]): boolean {
  const nr = normalizeRoleString(profileRole);
  return requiredRoles.map((r) => normalizeRoleString(r)).includes(nr);
}

/**
 * Hook réutilisable pour vérifier les rôles et rediriger si non autorisé
 * Gère le chargement du profil, la vérification du rôle et les redirections
 */
export function useRoleGuard({
  requiredRoles,
  redirectTo = '/',
}: UseRoleGuardOptions) {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    // Attendre que le loading soit fini
    if (loading) {
      return;
    }

    // Si pas connecté, rediriger vers login
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    // Si le profil n'est pas encore chargé après le loading, pas acceptable
    if (!profile) {
      navigate('/auth', { replace: true });
      return;
    }

    if (!profileMatchesRoles(profile.role as string, requiredRoles)) {
      navigate(redirectTo, { replace: true });
      return;
    }
  }, [user, profile, loading, requiredRoles, redirectTo, navigate]);

  return {
    user,
    profile,
    loading,
    isAuthorized:
      !loading && !!user && !!profile && profileMatchesRoles(profile.role as string, requiredRoles),
  };
}

/**
 * Composant wrapper pour protéger les pages
 * Affiche un loader pendant le chargement et redirige si non autorisé
 */
export function RoleGuardWrapper({
  children,
  requiredRoles,
  redirectTo = '/',
  loadingMessage = 'Vérification...',
}: {
  children: React.ReactNode;
  requiredRoles: string[];
  redirectTo?: string;
  loadingMessage?: string;
}) {
  const { loading, isAuthorized } = useRoleGuard({
    requiredRoles,
    redirectTo,
  });

  if (loading) {
    return <RestafyLoader message={loadingMessage} />;
  }

  if (!isAuthorized) {
    return null; // La redirection est gérée par le hook
  }

  return <>{children}</>;
}
