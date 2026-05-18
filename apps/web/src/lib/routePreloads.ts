/**
 * Précharge les chunks des routes lourdes au survol (équivalent au prefetch des liens Next.js).
 */
/** Home est importé statiquement dans App (LCP `/`) — pas de chunk séparé à précharger. */
export function preloadHome() {
  /* no-op */
}
export function preloadEventMarketplace() {
  void import('@/pages/EventMarketplace');
}
export function preloadCart() {
  void import('@/pages/Cart');
}
export function preloadOrders() {
  void import('@/pages/Orders');
}
export function preloadLoyalty() {
  void import('@/pages/LoyaltyDashboard');
}
export function preloadMyTickets() {
  void import('@/pages/MyTickets');
}
export function preloadProfile() {
  void import('@/pages/Profile');
}
export function preloadNotifications() {
  void import('@/pages/Notifications');
}

export function preloadLogin() {
  void import('@/pages/auth/Login');
}
