/**
 * Accès au dashboard restaurant : distinction gérant / équipe terrain.
 */

export function normalizeDashboardRole(role: string | undefined | null): string {
  if (!role) return '';
  return role === 'superadmin' ? 'super_admin' : role;
}

/** Proprio, gérant, caisse : menu complet + ouverture / fermeture. */
export function hasFullRestaurantNav(profileRole: string | undefined | null): boolean {
  const r = normalizeDashboardRole(profileRole);
  return (
    r === 'restaurant_owner' ||
    r === 'restaurant' ||
    r === 'manager' ||
    r === 'caissier' ||
    r === 'super_admin'
  );
}

/**
 * Équipe cuisine / salle / livreur : commandes + caisse uniquement (pas menu, équipe, réglages…).
 * Poste équipe « manager » = même accès menu que gérant (adj.).
 */
export function isRestaurantOpsOnlyUser(
  profileRole: string | undefined | null,
  hasStaffRow: boolean,
  staffPost?: string | null,
): boolean {
  if (staffPost === 'manager') return false;
  if (hasFullRestaurantNav(profileRole)) return false;
  const r = normalizeDashboardRole(profileRole);
  if (r === 'staff' || r === 'livreur') return true;
  if (hasStaffRow) return true;
  return false;
}

/** Chemins autorisés pour un compte « équipe seule » (évite l’accès direct par URL). */
export function isRestaurantOpsAllowedPath(pathname: string): boolean {
  if (pathname === '/restaurant/dashboard' || pathname === '/restaurant/dashboard/') return true;
  if (pathname.startsWith('/restaurant/dashboard/orders')) return true;
  if (pathname.startsWith('/restaurant/dashboard/pos')) return true;
  if (pathname.startsWith('/restaurant/dashboard/kitchen')) return true;
  return false;
}

/** Rôles équipe « cuisine » qui voient en priorité la Kitchen View. */
export function isKitchenStaffRole(staffPost?: string | null): boolean {
  if (!staffPost) return false;
  return staffPost === 'chef' || staffPost === 'staff';
}
