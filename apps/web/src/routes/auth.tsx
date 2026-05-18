import { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

const LoadingFallback = () => <RestafyLoader fullscreen={true} message="Chargement..." />;

const Login = lazy(() => import('@/pages/auth/Login'));
const RestaurantLogin = lazy(() => import('@/pages/auth/RestaurantLogin'));
const ClientSignup = lazy(() => import('@/pages/auth/ClientSignup'));
const RestaurantSignup = lazy(() => import('@/pages/auth/RestaurantSignup'));
const OnboardingFlow = lazy(() => import('@/components/OnboardingFlow'));
const StaffKioskPage = lazy(() => import('@/pages/staff/StaffKioskPage'));

export interface AuthRouteConfig {
  path: string;
  element: React.ReactNode;
  redirectIfAuth?: string;
}

export const getAuthRoutes = (user: any, hasOnboarded: boolean) => [
  {
    path: '/login',
    element: user ? <Navigate to="/" replace /> : <Suspense fallback={<LoadingFallback />}><Login /></Suspense>,
  },
  {
    path: '/signup',
    element: user ? <Navigate to="/" replace /> : <Suspense fallback={<LoadingFallback />}><ClientSignup /></Suspense>,
  },
  {
    path: '/restaurant/login',
    element: user ? <Navigate to="/restaurant/dashboard" replace /> : <Suspense fallback={<LoadingFallback />}><RestaurantLogin /></Suspense>,
  },
  {
    path: '/restaurant/signup',
    element: user ? <Navigate to="/restaurant/dashboard" replace /> : <Suspense fallback={<LoadingFallback />}><RestaurantSignup /></Suspense>,
  },
  {
    path: '/restaurant/equipe/:token',
    element: <Suspense fallback={<LoadingFallback />}><StaffKioskPage /></Suspense>,
  },
  {
    path: '/auth',
    element: user ? <Navigate to="/" replace /> : <Suspense fallback={<LoadingFallback />}><Login /></Suspense>,
  },
  {
    path: '/onboarding',
    element: user
      ? hasOnboarded
        ? <Navigate to="/" replace />
        : <Suspense fallback={<LoadingFallback />}><OnboardingFlow /></Suspense>
      : <Navigate to="/auth" replace />,
  },
];
