import { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

const LoadingFallback = () => <RestafyLoader fullscreen={true} message="Chargement..." />;

const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'));
const RestaurantDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const RestaurantUnifiedDashboard = lazy(() => import('@/pages/admin/RestaurantUnifiedDashboard'));
const RestaurantFinances = lazy(() => import('@/pages/admin/RestaurantFinances'));
const MenuManagement = lazy(() => import('@/pages/admin/MenuManagement'));
const MenuGeneralization = lazy(() => import('@/pages/admin/MenuGeneralization'));
const RestaurantTeamScan = lazy(() => import('@/pages/admin/RestaurantTeamScan'));
const TeamManagement = lazy(() => import('@/pages/admin/TeamManagement'));
const AnalyticsPage = lazy(() => import('@/pages/admin/Analytics'));
const Settings = lazy(() => import('@/pages/admin/Settings'));
const RestaurantSlug = lazy(() => import('@/pages/admin/RestaurantSlug'));
const RestaurantDashboardEvents = lazy(() => import('@/pages/admin/RestaurantDashboardEvents'));
const PromoManager = lazy(() => import('@/pages/admin/PromoManager'));
const POSPage = lazy(() => import('@/pages/POS'));
const CaissePOS = lazy(() => import('@/pages/admin/CaissePOS'));
const Reservations = lazy(() => import('@/pages/admin/Reservations'));
const MenuImportPhoto = lazy(() => import('@/pages/admin/MenuImportPhoto'));
const OrdersDashboard = lazy(() => import('@/pages/admin/OrdersDashboard'));
const CreateRestaurant = lazy(() => import('@/pages/CreateRestaurant'));
const WidgetIntegration = lazy(() => import('@/pages/admin/WidgetIntegration'));
const TablesManagement = lazy(() => import('@/pages/admin/TablesManagement'));

export const RESTAURANT_ROLES = ['restaurant_owner', 'restaurant', 'manager', 'staff', 'livreur', 'caissier'];

export const restaurantRoutes = [
  // POS
  {
    path: '/pos',
    element: <Suspense fallback={<LoadingFallback />}><POSPage /></Suspense>,
    requiredRoles: [...RESTAURANT_ROLES, 'super_admin'],
  },
  // Création restaurant
  {
    path: '/create-restaurant',
    element: <Suspense fallback={<LoadingFallback />}><CreateRestaurant /></Suspense>,
  },
  // Dashboard restaurant
  {
    path: '/restaurant/dashboard',
    element: <Suspense fallback={<LoadingFallback />}><AdminLayout /></Suspense>,
    requiredRoles: RESTAURANT_ROLES,
    loginPath: '/restaurant/login',
    children: [
      { index: true, element: <Suspense fallback={<LoadingFallback />}><RestaurantUnifiedDashboard /></Suspense> },
      { path: 'dashboard-legacy', element: <Suspense fallback={<LoadingFallback />}><RestaurantDashboard /></Suspense> },
      { path: 'menu', element: <Suspense fallback={<LoadingFallback />}><MenuManagement /></Suspense> },
      { path: 'menu-generalization', element: <Suspense fallback={<LoadingFallback />}><MenuGeneralization /></Suspense> },
      { path: 'menu-import-photo', element: <Suspense fallback={<LoadingFallback />}><MenuImportPhoto /></Suspense> },
      { path: 'team', element: <Suspense fallback={<LoadingFallback />}><TeamManagement /></Suspense> },
      { path: 'team-scan', element: <Suspense fallback={<LoadingFallback />}><RestaurantTeamScan /></Suspense> },
      { path: 'analytics', element: <Suspense fallback={<LoadingFallback />}><AnalyticsPage /></Suspense> },
      { path: 'finances', element: <Suspense fallback={<LoadingFallback />}><RestaurantFinances /></Suspense> },
      { path: 'settings', element: <Suspense fallback={<LoadingFallback />}><Settings /></Suspense> },
      { path: 'slug', element: <Suspense fallback={<LoadingFallback />}><RestaurantSlug /></Suspense> },
      { path: 'events', element: <Suspense fallback={<LoadingFallback />}><RestaurantDashboardEvents /></Suspense> },
      { path: 'promos', element: <Suspense fallback={<LoadingFallback />}><PromoManager /></Suspense> },
      { path: 'pos', element: <Suspense fallback={<LoadingFallback />}><CaissePOS /></Suspense> },
      { path: 'reservations', element: <Suspense fallback={<LoadingFallback />}><Reservations /></Suspense> },
      { path: 'orders', element: <Suspense fallback={<LoadingFallback />}><OrdersDashboard /></Suspense> },
      { path: 'tables', element: <Suspense fallback={<LoadingFallback />}><TablesManagement /></Suspense> },
      { path: 'integration', element: <Suspense fallback={<LoadingFallback />}><WidgetIntegration /></Suspense> },
    ],
  },
  // Legacy redirect
  { path: '/admin/*', element: <Navigate to="/restaurant/dashboard" replace /> },
];
