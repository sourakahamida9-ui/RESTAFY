# Fix: SuperAdmin Authentication Loop

## Problème Identifié
L'authentification SuperAdmin était bloquée par une boucle infinie de redirection:

1. **Login.tsx** n'appelait jamais `sessionStorage.setItem('adminSession')`
2. **Dashboard.tsx** vérifiait `sessionStorage.getItem('adminSession')` et redirige vers `/superadmin/login` si absent
3. **ProtectedRoute** vérifiait le rôle avant que le profil soit chargé → redirection prématurée
4. Inconsistance des rôles: `'super_admin'` vs `'superadmin'` dans la DB

## Solution Implémentée

### 1. Création du hook `useRoleGuard` 
- Gère le chargement du profil avant vérification du rôle
- Normalise les variantes de rôles (super_admin ↔ superadmin)
- Fournit un composant wrapper `RoleGuardWrapper` réutilisable
- Logs en dev mode pour déboguer

**Fichier:** `src/hooks/useRoleGuard.ts`

### 2. Amélioration du `ProtectedRoute` (App.tsx)
```tsx
function ProtectedRoute({ 
  children, 
  requiredRole,
  redirectTo = '/'
}: { 
  children: React.ReactNode; 
  requiredRole?: string;
  redirectTo?: string;
}) {
  const { user, profile, loading } = useAuth();

  if (loading) return <RestafyLoader message="Vérification..." />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile) return <RestafyLoader message="Chargement du profil..." />;
  
  if (requiredRole) {
    const normalizedUserRole = profile.role === 'superadmin' ? 'super_admin' : profile.role;
    const normalizedRequiredRole = requiredRole === 'superadmin' ? 'super_admin' : requiredRole;
    
    if (normalizedUserRole !== normalizedRequiredRole) {
      // Redirection intelligente selon le rôle
      if (normalizedUserRole === 'super_admin') {
        return <Navigate to="/superadmin" replace />;
      }
      if (normalizedUserRole === 'restaurant_owner') {
        return <Navigate to="/restaurant/dashboard" replace />;
      }
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <>{children}</>;
}
```

**Changements clés:**
- Attend que le profil soit chargé AVANT de vérifier le rôle
- Normalise les variantes de rôles
- Redirige intelligemment selon le contexte (super_admin → /superadmin, restaurant_owner → /restaurant/dashboard)

### 3. Suppression de `sessionStorage` (Dashboard.tsx)
```tsx
export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { loading } = useRoleGuard({
    requiredRoles: ['super_admin'],
    redirectTo: '/superadmin/login',
    devLog: false,
  });

  useEffect(() => {
    if (!loading && user) {
      fetchStats();
    }
  }, [loading, user]);

  const handleLogout = async () => {
    const { error } = await signOut();
    if (!error) {
      navigate('/superadmin/login', { replace: true });
    }
  };
  
  if (loading || stats.loading) return <RestafyLoader message="Panel Admin" />;
  
  // ... rest du composant
}
```

**Changements:**
- Suppression de `checkAdminAccess()` qui utilisait `sessionStorage`
- Utilisation du hook `useRoleGuard` pour la vérification d'accès
- Le logout utilise `signOut()` de Supabase au lieu de supprimer sessionStorage

### 4. Login.tsx (aucun changement majeur)
- Simplement redirection vers `/superadmin` après succès
- Le ProtectedRoute + useRoleGuard gère la vérification du rôle

## Flux d'Authentification SuperAdmin Corrigé

1. **User accède à /superadmin/login**
   - Page publique, pas de protection

2. **User saisit ses identifiants**
   - `signIn()` appelle Supabase Auth
   - Si succès → redirection vers `/superadmin`

3. **User accède à /superadmin**
   - ProtectedRoute vérifie:
     - ✓ User est connecté (Supabase session)
     - ✓ Profil est chargé de la DB
     - ✓ Role est 'super_admin'
   - Si OK → affiche SuperAdminLayout + Dashboard
   - Si NOT OK → redirection intelligente

4. **Logout**
   - Appelle `signOut()` qui supprime la session Supabase
   - Redirige vers `/superadmin/login`
   - La prochaine visite à `/superadmin` redirige automatiquement vers `/auth` (pas de session)

## Contraintes Respectées

✅ **Aucune casse du flux client normal** (`/login` → `/auth` → `/`)  
✅ **Restaurant owners restent sur `/restaurant/dashboard`**  
✅ **SuperAdmins redirigés vers `/superadmin`**  
✅ **Pas de sessionStorage** – utilise uniquement Supabase Auth  
✅ **Normalisation des rôles** – accepte 'super_admin' et 'superadmin'  
✅ **Hook réutilisable** – `useRoleGuard` peut être utilisé partout  

## Fichiers Modifiés

1. ✅ `src/hooks/useRoleGuard.ts` – **CRÉÉ**
2. ✅ `src/App.tsx` – ProtectedRoute amélioré
3. ✅ `src/pages/superadmin/Dashboard.tsx` – Suppression sessionStorage
4. ✅ `src/pages/superadmin/Login.tsx` – Simplifié

## Tests Recommandés

```bash
# Test 1: SuperAdmin login
1. Aller à /superadmin/login
2. Entrer credentials super_admin
3. Vérifier redirection vers /superadmin
4. Vérifier pas de boucle infinie

# Test 2: Restaurant owner login
1. Aller à /login
2. S'inscrire comme restaurant
3. Vérifier redirection vers /restaurant/dashboard
4. Essayer d'accéder /superadmin → redirection vers /

# Test 3: Logout
1. Être connecté en super_admin
2. Cliquer Déconnexion
3. Vérifier redirection vers /superadmin/login
4. Essayer d'accéder /superadmin → redirection vers /auth
```
