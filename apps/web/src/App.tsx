import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAuth } from '@/hooks/useAuth';
import { startAuthSync } from '@/lib/authSync';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useUserStore } from '@/store/useUserStore';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import { SystemProvider } from '@/context/SystemContext';
import { ToastProvider } from '@/components/Toast';

// Routes modulaires
import { getAuthRoutes, RESTAURANT_ROLES, SUPER_ADMIN_ROLE } from '@/routes';
import Layout from '@/components/Layout';

const NotFound = lazy(() => import('./pages/NotFound'));
const LoadingFallback = () => <RestafyLoader fullscreen={true} message="Chargement..." />;

// Components lazy-loaded
const Home = lazy(() => import('./pages/Home'));
const Widget = lazy(() => import('./pages/Widget'));
const RestaurantPreview = lazy(() => import('./pages/RestaurantPreview'));
const RestaurantDetail = lazy(() => import('./pages/RestaurantDetail'));
const EventMarketplace = lazy(() => import('./pages/EventMarketplace'));
const Scan = lazy(() => import('./pages/Scan'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const Orders = lazy(() => import('./pages/Orders'));
const LoyaltyDashboard = lazy(() => import('./pages/LoyaltyDashboard'));
const RewardsCatalogue = lazy(() => import('./pages/RewardsCatalogue'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const ReferralPage = lazy(() => import('./pages/ReferralPage'));
const EventCheckout = lazy(() => import('./pages/EventCheckout'));
const MyTickets = lazy(() => import('./pages/MyTickets'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const POSPage = lazy(() => import('./pages/POS'));
const CreateRestaurant = lazy(() => import('./pages/CreateRestaurant'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const RestaurantDashboard = lazy(() => import('./pages/admin/Dashboard'));
const MenuManagement = lazy(() => import('./pages/admin/MenuManagement'));
const MenuGeneralization = lazy(() => import('./pages/admin/MenuGeneralization'));
const MenuImportPhoto = lazy(() => import('./pages/admin/MenuImportPhoto'));
const TeamManagement = lazy(() => import('./pages/admin/TeamManagement'));
const RestaurantTeamScan = lazy(() => import('./pages/admin/RestaurantTeamScan'));
const AnalyticsPage = lazy(() => import('./pages/admin/Analytics'));
const RestaurantPayout = lazy(() => import('./pages/admin/RestaurantPayout'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const RestaurantSlug = lazy(() => import('./pages/admin/RestaurantSlug'));
const WidgetIntegration = lazy(() => import('./pages/admin/WidgetIntegration'));
const RestaurantDashboardEvents = lazy(() => import('./pages/admin/RestaurantDashboardEvents'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'));
const PromoManager = lazy(() => import('./pages/admin/PromoManager'));
const CaissePOS = lazy(() => import('./pages/admin/CaissePOS'));
const Reservations = lazy(() => import('./pages/admin/Reservations'));
const OrdersDashboard = lazy(() => import('./pages/admin/OrdersDashboard'));
const Kitchen = lazy(() => import('./pages/admin/Kitchen'));
const TablesManagement = lazy(() => import('./pages/admin/TablesManagement'));
const SuperAdminLogin = lazy(() => import('./pages/superadmin/Login'));
const UserManagementGuide = lazy(() => import('./pages/superadmin/UserManagementGuide'));
const SuperAdminLayout = lazy(() => import('./components/superadmin/SuperAdminLayout'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/Dashboard'));
const SuperAdminRestaurants = lazy(() => import('./pages/superadmin/Restaurants'));
const SuperAdminUsers = lazy(() => import('./pages/superadmin/Users'));
const SuperAdminFinances = lazy(() => import('./pages/superadmin/Finances'));
const SuperAdminData = lazy(() => import('./pages/superadmin/DataCenter'));
const SuperAdminMonitoring = lazy(() => import('./pages/superadmin/Monitoring'));
const SuperAdminOrderEvents = lazy(() => import('./pages/superadmin/OrderEvents'));
const RestaurantInvites = lazy(() => import('./pages/superadmin/RestaurantInvites'));
const PartnerJoinRequests = lazy(() => import('./pages/superadmin/PartnerJoinRequests'));
const EmailCampaigns = lazy(() => import('./pages/superadmin/EmailCampaigns'));
const PaymentMethodsAdmin = lazy(() => import('./pages/admin/PaymentMethodsAdmin'));
const OrderModesAdmin = lazy(() => import('./pages/admin/OrderModesAdmin'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 10,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      throwOnError: false,
    },
    mutations: {
      throwOnError: false,
    },
  },
});

/**
 * Sur le dashboard restaurant, le thème clair/sombre est piloté par `data-restaurant-theme` + `.dark` sur le shell,
 * pas par le thème OS. On retire donc `dark` de <html> sur ces routes pour que les `dark:` Tailwind ne s'appliquent
 * pas via `html.dark *` quand l'utilisateur a choisi le mode clair alors que l'OS est en sombre.
 */
function HtmlDarkClassSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const inRestaurantDashboard = pathname.startsWith('/restaurant/dashboard');

    const apply = () => {
      document.documentElement.classList.toggle('dark', !inRestaurantDashboard && mq.matches);
    };

    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pathname]);

  return null;
}

/** Rôle DB parfois stocké en `superadmin` (legacy) — aligné sur l'app */
function normalizeDbRole(role: string): string {
  return role === 'superadmin' ? 'super_admin' : role;
}

/** Segments réservés sous /restaurant/… — ne pas traiter comme fiche publique ni bypass auth loading */
const RESTAURANT_PATH_RESERVED = new Set(['dashboard', 'login', 'signup', 'equipe']);

function isPublicRestaurantPreviewPath(path: string): boolean {
  if (!/^\/restaurant\/[^/]+$/.test(path)) return false;
  const seg = path.split('/')[2]?.toLowerCase() ?? '';
  return !RESTAURANT_PATH_RESERVED.has(seg);
}

function AppRoutes() {
  const { user, loading, isSupabaseConfigured, profile } = useAuth();
  const location = useLocation();
  const hasOnboarded = useUserStore((s) => s.hasOnboarded);
  const { resetForNewUser, setLocation, setUserName, setLoggedIn } = useUserStore();

  useEffect(() => {
    return startAuthSync();
  }, []);

  useEffect(() => {
    if (user && profile) {
      resetForNewUser(user.id);
      if (profile.city) setLocation(profile.city);
      if (profile.full_name) setUserName(profile.full_name);
      setLoggedIn(true);
    } else if (!user) {
      resetForNewUser(null);
      setLoggedIn(false);
    }
  }, [user?.id, profile?.city, profile?.full_name]);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-50 p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-900">Configuration manquante</h1>
        <p className="text-zinc-500 max-w-sm text-sm">
          Les variables d'environnement Supabase ne sont pas configurées.
          Créez un fichier <code className="bg-zinc-100 px-1 rounded">.env</code> avec{' '}
          <code className="bg-zinc-100 px-1 rounded">VITE_SUPABASE_URL</code> et{' '}
          <code className="bg-zinc-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>.
        </p>
      </div>
    );
  }

  // ✅ Pages publiques restaurant bypass auth loading
  if (loading) {
    const path = window.location.pathname;
    const isPublicRestaurant =
      /^\/r\/[^/]+$/.test(path) ||
      /^\/@[^/]+/.test(path) ||
      isPublicRestaurantPreviewPath(path) ||
      /^\/restaurant\/equipe\/[^/]+$/.test(path) ||
      /^\/[a-z0-9][a-z0-9_-]{2,}$/.test(path);
    if (!isPublicRestaurant) return <RestafyLoader />;
  }

  // ✅ Redirection super_admin
  if (user && profile && !window.location.pathname.startsWith('/superadmin')) {
    const userRole = normalizeDbRole(profile.role as string);
    if (userRole === 'super_admin') return <Navigate to="/superadmin" replace />;
  }

  const authRoutes = getAuthRoutes(user, hasOnboarded);

  return (
    <Routes>
      {/* Auth */}
      {authRoutes.map((route, idx) => (
        <Route key={`auth-${idx}`} path={route.path} element={route.element} />
      ))}

      {/* Pages publiques avec Layout */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Suspense fallback={<LoadingFallback />}><Home /></Suspense>} />
        <Route path="widget/:slug" element={<Suspense fallback={<LoadingFallback />}><Widget /></Suspense>} />
        <Route path="404" element={<Suspense fallback={<LoadingFallback />}><NotFound /></Suspense>} />
        <Route path="restaurants" element={<Navigate to="/" replace />} />
        <Route path="restaurant/:id" element={<Suspense fallback={<LoadingFallback />}><RestaurantPreview /></Suspense>} />
        <Route path="restaurant" element={<Navigate to="/" replace />} />
        <Route path="events" element={<Suspense fallback={<LoadingFallback />}><EventMarketplace /></Suspense>} />
        <Route path="events/:id" element={<Suspense fallback={<LoadingFallback />}><EventDetail /></Suspense>} />
        <Route path="scan" element={<Suspense fallback={<LoadingFallback />}><Scan /></Suspense>} />
        <Route path="r/:slug" element={<Suspense fallback={<LoadingFallback />}><RestaurantDetail /></Suspense>} />
        <Route path=":slugSeg/full" element={<Navigate to="/" replace />} />
        <Route path=":slug" element={<Suspense fallback={<LoadingFallback />}><RestaurantPreview /></Suspense>} />
      </Route>

      {/* Pages protégées client */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="cart" element={<Suspense fallback={<LoadingFallback />}><Cart /></Suspense>} />
        <Route path="payment/success" element={<Suspense fallback={<LoadingFallback />}><PaymentSuccess /></Suspense>} />
        <Route path="payment/cancel" element={<Suspense fallback={<LoadingFallback />}><PaymentCancel /></Suspense>} />
        <Route path="track/:id" element={<Suspense fallback={<LoadingFallback />}><OrderTracking /></Suspense>} />
        <Route path="orders" element={<Suspense fallback={<LoadingFallback />}><Orders /></Suspense>} />
        <Route path="loyalty" element={<Suspense fallback={<LoadingFallback />}><LoyaltyDashboard /></Suspense>} />
        <Route path="fidelite" element={<Suspense fallback={<LoadingFallback />}><LoyaltyDashboard /></Suspense>} />
        <Route path="rewards" element={<Suspense fallback={<LoadingFallback />}><RewardsCatalogue /></Suspense>} />
        <Route path="leaderboard" element={<Suspense fallback={<LoadingFallback />}><LeaderboardPage /></Suspense>} />
        <Route path="referral" element={<Suspense fallback={<LoadingFallback />}><ReferralPage /></Suspense>} />
        <Route path="events/:id/checkout" element={<Suspense fallback={<LoadingFallback />}><EventCheckout /></Suspense>} />
        <Route path="my-tickets" element={<Suspense fallback={<LoadingFallback />}><MyTickets /></Suspense>} />
        <Route path="mes-billets" element={<Suspense fallback={<LoadingFallback />}><MyTickets /></Suspense>} />
        <Route path="notifications" element={<Suspense fallback={<LoadingFallback />}><NotificationsPage /></Suspense>} />
        <Route path="profile" element={<Suspense fallback={<LoadingFallback />}><Profile /></Suspense>} />
        <Route path="profil" element={<Suspense fallback={<LoadingFallback />}><Profile /></Suspense>} />
      </Route>

      {/* POS */}
      <Route
        path="/pos"
        element={
          <ProtectedRoute requiredRoles={[...RESTAURANT_ROLES, SUPER_ADMIN_ROLE]}>
            <Suspense fallback={<LoadingFallback />}><POSPage /></Suspense>
          </ProtectedRoute>
        }
      />

      {/* Création restaurant */}
      <Route
        path="/create-restaurant"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}><CreateRestaurant /></Suspense>
          </ProtectedRoute>
        }
      />

      {/* Restaurant Dashboard */}
      <Route
        path="/restaurant/dashboard"
        element={
          <ProtectedRoute
            requiredRoles={RESTAURANT_ROLES}
            loginPath="/restaurant/login"
            redirectTo="/restaurant/login"
          >
            <Suspense fallback={<LoadingFallback />}><AdminLayout /></Suspense>
          </ProtectedRoute>
        }
      >
        <Route index element={<Suspense fallback={<LoadingFallback />}><RestaurantDashboard /></Suspense>} />
        <Route path="menu" element={<Suspense fallback={<LoadingFallback />}><MenuManagement /></Suspense>} />
        <Route path="menu-generalization" element={<Suspense fallback={<LoadingFallback />}><MenuGeneralization /></Suspense>} />
        <Route path="menu-import-photo" element={<Suspense fallback={<LoadingFallback />}><MenuImportPhoto /></Suspense>} />
        <Route path="team" element={<Suspense fallback={<LoadingFallback />}><TeamManagement /></Suspense>} />
        <Route path="team-scan" element={<Suspense fallback={<LoadingFallback />}><RestaurantTeamScan /></Suspense>} />
        <Route path="analytics" element={<Suspense fallback={<LoadingFallback />}><AnalyticsPage /></Suspense>} />
        <Route path="payout" element={<Suspense fallback={<LoadingFallback />}><RestaurantPayout /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<LoadingFallback />}><Settings /></Suspense>} />
        <Route path="slug" element={<Suspense fallback={<LoadingFallback />}><RestaurantSlug /></Suspense>} />
        <Route path="events" element={<Suspense fallback={<LoadingFallback />}><RestaurantDashboardEvents /></Suspense>} />
        <Route path="promos" element={<Suspense fallback={<LoadingFallback />}><PromoManager /></Suspense>} />
        <Route path="pos" element={<Suspense fallback={<LoadingFallback />}><CaissePOS /></Suspense>} />
        <Route path="reservations" element={<Suspense fallback={<LoadingFallback />}><Reservations /></Suspense>} />
        <Route path="tables" element={<Suspense fallback={<LoadingFallback />}><TablesManagement /></Suspense>} />
        <Route path="orders" element={<Suspense fallback={<LoadingFallback />}><OrdersDashboard /></Suspense>} />
        <Route path="kitchen" element={<Suspense fallback={<LoadingFallback />}><Kitchen /></Suspense>} />
        <Route path="integration" element={<Suspense fallback={<LoadingFallback />}><WidgetIntegration /></Suspense>} />
      </Route>

      {/* Legacy redirect */}
      <Route path="/admin/*" element={<Navigate to="/restaurant/dashboard" replace />} />

      {/* Super Admin */}
      <Route path="/superadmin/login" element={<Suspense fallback={<LoadingFallback />}><SuperAdminLogin /></Suspense>} />
      <Route
        path="/superadmin/user-management-guide"
        element={
          <ProtectedRoute requiredRoles={[SUPER_ADMIN_ROLE]}>
            <Suspense fallback={<LoadingFallback />}><UserManagementGuide /></Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin"
        element={
          <ProtectedRoute requiredRoles={[SUPER_ADMIN_ROLE]}>
            <Suspense fallback={<LoadingFallback />}><SuperAdminLayout /></Suspense>
          </ProtectedRoute>
        }
      >
        <Route index element={<Suspense fallback={<LoadingFallback />}><SuperAdminDashboard /></Suspense>} />
        <Route path="dashboard" element={<Suspense fallback={<LoadingFallback />}><SuperAdminDashboard /></Suspense>} />
        <Route path="restaurants" element={<Suspense fallback={<LoadingFallback />}><SuperAdminRestaurants /></Suspense>} />
        <Route path="users" element={<Suspense fallback={<LoadingFallback />}><SuperAdminUsers /></Suspense>} />
        <Route path="finances" element={<Suspense fallback={<LoadingFallback />}><SuperAdminFinances /></Suspense>} />
        <Route path="data" element={<Suspense fallback={<LoadingFallback />}><SuperAdminData /></Suspense>} />
        <Route path="monitoring" element={<Suspense fallback={<LoadingFallback />}><SuperAdminMonitoring /></Suspense>} />
        <Route path="order-events" element={<Suspense fallback={<LoadingFallback />}><SuperAdminOrderEvents /></Suspense>} />
        <Route path="invites" element={<Suspense fallback={<LoadingFallback />}><RestaurantInvites /></Suspense>} />
        <Route path="partner-requests" element={<Suspense fallback={<LoadingFallback />}><PartnerJoinRequests /></Suspense>} />
        <Route path="emails" element={<Suspense fallback={<LoadingFallback />}><EmailCampaigns /></Suspense>} />
        <Route path="payment-methods" element={<Suspense fallback={<LoadingFallback />}><PaymentMethodsAdmin /></Suspense>} />
        <Route path="order-modes" element={<Suspense fallback={<LoadingFallback />}><OrderModesAdmin /></Suspense>} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Suspense fallback={<LoadingFallback />}><NotFound /></Suspense>} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary level="app">
        <Router>
          <HtmlDarkClassSync />
          <NotificationProvider>
            <SystemProvider>
              <ToastProvider>
                <div className="antialiased">
                  <AppRoutes />
                </div>
              </ToastProvider>
            </SystemProvider>
          </NotificationProvider>
        </Router>
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: { fontFamily: 'inherit' },
            className: 'text-sm font-medium',
          }}
        />
        <VercelAnalytics />
        <SpeedInsights />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
