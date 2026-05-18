import { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

const LoadingFallback = () => <RestafyLoader fullscreen={true} message="Chargement..." />;

const SuperAdminLayout = lazy(() => import('@/components/superadmin/SuperAdminLayout'));
const SuperAdminLogin = lazy(() => import('@/pages/superadmin/Login'));
const SuperAdminDashboard = lazy(() => import('@/pages/superadmin/Dashboard'));
const RestaurantInvites = lazy(() => import('@/pages/superadmin/RestaurantInvites'));
const SuperAdminRestaurants = lazy(() => import('@/pages/superadmin/Restaurants'));
const SuperAdminUsers = lazy(() => import('@/pages/superadmin/Users'));
const SuperAdminFinances = lazy(() => import('@/pages/superadmin/Finances'));
const SuperAdminData = lazy(() => import('@/pages/superadmin/DataCenter'));
const SuperAdminMonitoring = lazy(() => import('@/pages/superadmin/Monitoring'));
const UserManagementGuide = lazy(() => import('@/pages/superadmin/UserManagementGuide'));
const EmailCampaigns = lazy(() => import('@/pages/superadmin/EmailCampaigns'));
const PartnerJoinRequests = lazy(() => import('@/pages/superadmin/PartnerJoinRequests'));
const PaymentMethodsAdmin = lazy(() => import('@/pages/admin/PaymentMethodsAdmin'));
const OrderModesAdmin = lazy(() => import('@/pages/admin/OrderModesAdmin'));

export const SUPER_ADMIN_ROLE = 'super_admin';

export const superAdminRoutes = [
  { path: '/superadmin/login', element: <Suspense fallback={<LoadingFallback />}><SuperAdminLogin /></Suspense> },
  {
    path: '/superadmin/user-management-guide',
    element: <Suspense fallback={<LoadingFallback />}><UserManagementGuide /></Suspense>,
    requiredRoles: [SUPER_ADMIN_ROLE],
  },
  {
    path: '/superadmin',
    element: <Suspense fallback={<LoadingFallback />}><SuperAdminLayout /></Suspense>,
    requiredRoles: [SUPER_ADMIN_ROLE],
    children: [
      { index: true, element: <Suspense fallback={<LoadingFallback />}><SuperAdminDashboard /></Suspense> },
      { path: 'dashboard', element: <Suspense fallback={<LoadingFallback />}><SuperAdminDashboard /></Suspense> },
      { path: 'restaurants', element: <Suspense fallback={<LoadingFallback />}><SuperAdminRestaurants /></Suspense> },
      { path: 'users', element: <Suspense fallback={<LoadingFallback />}><SuperAdminUsers /></Suspense> },
      { path: 'finances', element: <Suspense fallback={<LoadingFallback />}><SuperAdminFinances /></Suspense> },
      { path: 'data', element: <Suspense fallback={<LoadingFallback />}><SuperAdminData /></Suspense> },
      { path: 'monitoring', element: <Suspense fallback={<LoadingFallback />}><SuperAdminMonitoring /></Suspense> },
      { path: 'invites', element: <Suspense fallback={<LoadingFallback />}><RestaurantInvites /></Suspense> },
      { path: 'partner-requests', element: <Suspense fallback={<LoadingFallback />}><PartnerJoinRequests /></Suspense> },
      { path: 'emails', element: <Suspense fallback={<LoadingFallback />}><EmailCampaigns /></Suspense> },
      { path: 'payment-methods', element: <Suspense fallback={<LoadingFallback />}><PaymentMethodsAdmin /></Suspense> },
      { path: 'order-modes', element: <Suspense fallback={<LoadingFallback />}><OrderModesAdmin /></Suspense> },
    ],
  },
];
