import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

/** Rôle DB parfois stocké en `superadmin` (legacy) — aligné sur l'app */
function normalizeDbRole(role: string): string {
  return role === 'superadmin' ? 'super_admin' : role;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  redirectTo?: string;
  /** Si non connecté, redirection (ex. dashboard resto → /restaurant/login) */
  loginPath?: string;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  redirectTo = '/',
  loginPath = '/login',
}: ProtectedRouteProps) {
  const { user, profile, loading, error, signOut } = useAuth();

  if (loading) return <RestafyLoader message="Vérification..." />;
  if (!user) return <Navigate to={loginPath} replace />;

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-zinc-950 p-8 text-center">
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Profil indisponible</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {error?.message ??
              'Votre session est active mais le profil n\'a pas pu être chargé. Déconnectez-vous puis reconnectez-vous, ou contactez le support.'}
          </p>
          <button
            type="button"
            onClick={() => void signOut().then(() => window.location.assign(loginPath))}
            className="mt-6 w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white hover:bg-orange-700"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // ✅ BUG FIX #3 : Rediriger si restaurant_id manquant pour les rôles restaurant
  const userRole = normalizeDbRole(profile.role as string);
  const isRestaurantRole = ['restaurant_owner', 'restaurant', 'manager', 'staff', 'livreur', 'caissier'].includes(userRole);
  
  if (isRestaurantRole && !profile.restaurant_id && window.location.pathname !== '/create-restaurant') {
    return <Navigate to="/create-restaurant" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(userRole)) {
      if (userRole === 'super_admin') return <Navigate to="/superadmin" replace />;
      if (isRestaurantRole)
        return <Navigate to="/restaurant/dashboard" replace />;
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <>{children}</>;
}
