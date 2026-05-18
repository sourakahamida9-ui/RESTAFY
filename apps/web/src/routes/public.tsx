import { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Widget from '@/pages/Widget';
import { LegacyAtFullPathRedirect } from '@/components/LegacyRestaurantRedirects';

const LoadingFallback = () => <RestafyLoader fullscreen={true} message="Chargement..." />;

const NotFound = lazy(() => import('@/pages/NotFound'));
const RestaurantPreview = lazy(() => import('@/pages/RestaurantPreview'));
const RestaurantDetail = lazy(() => import('@/pages/RestaurantDetail'));
const EventMarketplace = lazy(() => import('@/pages/EventMarketplace'));
const EventDetail = lazy(() => import('@/pages/EventDetail'));

export const publicRoutes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'widget/:slug', element: <Widget /> },
      { path: '404', element: <Suspense fallback={<LoadingFallback />}><NotFound /></Suspense> },
      { path: 'restaurants', element: <Navigate to="/" replace /> },
      { path: 'restaurant/:id', element: <Suspense fallback={<LoadingFallback />}><RestaurantPreview /></Suspense> },
      { path: 'restaurant', element: <Navigate to="/" replace /> },
      { path: 'events', element: <Suspense fallback={<LoadingFallback />}><EventMarketplace /></Suspense> },
      { path: 'events/:id', element: <Suspense fallback={<LoadingFallback />}><EventDetail /></Suspense> },
      { path: 'r/:slug', element: <Suspense fallback={<LoadingFallback />}><RestaurantDetail /></Suspense> },
      { path: ':slugSeg/full', element: <LegacyAtFullPathRedirect /> },
      { path: ':slug', element: <Suspense fallback={<LoadingFallback />}><RestaurantPreview /></Suspense> },
    ],
  },
];
