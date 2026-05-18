import { Suspense, lazy } from 'react';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import Layout from '@/components/Layout';

const LoadingFallback = () => <RestafyLoader fullscreen={true} message="Chargement..." />;

const Cart = lazy(() => import('@/pages/Cart'));
const PaymentSuccess = lazy(() => import('@/pages/PaymentSuccess'));
const PaymentCancel = lazy(() => import('@/pages/PaymentCancel'));
const OrderTracking = lazy(() => import('@/pages/OrderTracking'));
const Orders = lazy(() => import('@/pages/Orders'));
const LoyaltyDashboard = lazy(() => import('@/pages/LoyaltyDashboard'));
const RewardsCatalogue = lazy(() => import('@/pages/RewardsCatalogue'));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage'));
const ReferralPage = lazy(() => import('@/pages/ReferralPage'));
const EventCheckout = lazy(() => import('@/pages/EventCheckout'));
const MyTickets = lazy(() => import('@/pages/MyTickets'));
const NotificationsPage = lazy(() => import('@/pages/Notifications'));
const Profile = lazy(() => import('@/pages/Profile'));
const FeatureTutorial = lazy(() => import('@/components/FeatureTutorial'));

export const clientRoutes = [
  {
    element: <Layout />,
    children: [
      { path: '/cart', element: <Suspense fallback={<LoadingFallback />}><Cart /></Suspense> },
      { path: '/payment/success', element: <Suspense fallback={<LoadingFallback />}><PaymentSuccess /></Suspense> },
      { path: '/payment/cancel', element: <Suspense fallback={<LoadingFallback />}><PaymentCancel /></Suspense> },
      { path: '/track/:id', element: <Suspense fallback={<LoadingFallback />}><OrderTracking /></Suspense> },
      { path: '/orders', element: <Suspense fallback={<LoadingFallback />}><Orders /></Suspense> },
      { path: '/loyalty', element: <Suspense fallback={<LoadingFallback />}><LoyaltyDashboard /></Suspense> },
      { path: '/fidelite', element: <Suspense fallback={<LoadingFallback />}><LoyaltyDashboard /></Suspense> },
      { path: '/rewards', element: <Suspense fallback={<LoadingFallback />}><RewardsCatalogue /></Suspense> },
      { path: '/leaderboard', element: <Suspense fallback={<LoadingFallback />}><LeaderboardPage /></Suspense> },
      { path: '/referral', element: <Suspense fallback={<LoadingFallback />}><ReferralPage /></Suspense> },
      { path: '/events/:id/checkout', element: <Suspense fallback={<LoadingFallback />}><EventCheckout /></Suspense> },
      { path: '/my-tickets', element: <Suspense fallback={<LoadingFallback />}><MyTickets /></Suspense> },
      { path: '/mes-billets', element: <Suspense fallback={<LoadingFallback />}><MyTickets /></Suspense> },
      { path: '/notifications', element: <Suspense fallback={<LoadingFallback />}><NotificationsPage /></Suspense> },
      { path: '/profile', element: <Suspense fallback={<LoadingFallback />}><Profile /></Suspense> },
      { path: '/profil', element: <Suspense fallback={<LoadingFallback />}><Profile /></Suspense> },
      { path: '/tutorial', element: <Suspense fallback={<LoadingFallback />}><FeatureTutorial /></Suspense> },
    ],
  },
];
