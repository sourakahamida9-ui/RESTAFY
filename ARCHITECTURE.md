# 📐 Architecture et Conventions Restafy

## 📁 Structure des Dossiers

```
restafy/
├── src/
│   ├── pages/                    # Pages React (routes principales)
│   │   ├── auth/                 # Authentification
│   │   │   ├── Login.tsx
│   │   │   ├── ClientSignup.tsx
│   │   │   └── RestaurantSignup.tsx
│   │   ├── admin/                # Dashboard restaurant
│   │   │   ├── Dashboard.tsx
│   │   │   ├── MenuManagement.tsx
│   │   │   ├── TeamManagement.tsx
│   │   │   ├── Analytics.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── PromoManager.tsx
│   │   ├── superadmin/           # Panel super admin
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── RestaurantInvites.tsx
│   │   │   ├── Restaurants.tsx
│   │   │   ├── Users.tsx
│   │   │   ├── Finances.tsx
│   │   │   ├── DataCenter.tsx
│   │   │   └── Monitoring.tsx
│   │   ├── Home.tsx              # Accueil
│   │   ├── RestaurantDetail.tsx
│   │   ├── Cart.tsx
│   │   ├── Orders.tsx
│   │   ├── OrderTracking.tsx
│   │   ├── Profile.tsx
│   │   ├── CreateRestaurant.tsx
│   │   ├── LoyaltyDashboard.tsx
│   │   ├── RewardsCatalogue.tsx
│   │   ├── LeaderboardPage.tsx
│   │   ├── ReferralPage.tsx
│   │   ├── EventMarketplace.tsx
│   │   ├── EventDetail.tsx
│   │   ├── EventCheckout.tsx
│   │   ├── MyTickets.tsx
│   │   ├── Notifications.tsx
│   │   ├── POS.tsx
│   │   └── Setup.tsx
│   │
│   ├── components/               # Composants réutilisables
│   │   ├── Layout.tsx            # Layout principal avec navbar
│   │   ├── PWAInstallPrompt.tsx  # Installation PWA
│   │   ├── OnboardingFlow.tsx
│   │   ├── admin/
│   │   │   └── AdminLayout.tsx   # Layout dashboard restaurant
│   │   ├── superadmin/
│   │   │   └── SuperAdminLayout.tsx
│   │   ├── ui/                   # Shadcn UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── RestafyLoader.tsx # Custom loader
│   │   │   └── ImageUpload.tsx
│   │   └── notifications/
│   │       └── NotificationProvider.tsx
│   │
│   ├── hooks/                    # React hooks personnalisés
│   │   ├── useAuth.ts            # Authentification & user state
│   │   ├── useOrderManager.ts    # Gestion des commandes
│   │   ├── useRestaurants.ts     # Fetch restaurants
│   │   ├── useRestaurantAdmin.ts # Admin data fetching
│   │   └── ...
│   │
│   ├── store/                    # Zustand state management
│   │   ├── useUserStore.ts
│   │   ├── useOrderCart.ts
│   │   └── ...
│   │
│   ├── lib/                      # Utilitaires
│   │   ├── supabase.ts           # Client Supabase
│   │   ├── utils.ts              # Functions utiles (cn, formatting)
│   │   ├── types.ts              # TypeScript types
│   │   └── constants.ts
│   │
│   ├── App.tsx                   # Routes principales
│   ├── main.tsx                  # Entry point
│   └── index.css / globals.css   # Styles globaux
│
├── public/                       # Assets statiques
│   ├── favicon.svg
│   ├── favicon-32x32.png
│   ├── favicon-16x16.png
│   ├── apple-touch-icon.png
│   ├── og-image.png
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── manifest.json
│   ├── manifest-restaurant.json
│   ├── robots.txt
│   ├── sitemap.xml
│   └── sw.js                     # Service Worker
│
├── scripts/                      # Scripts SQL migrations
│   ├── 001-fix-restaurants-table.sql
│   ├── 002-fix-profiles-table.sql
│   ├── ...
│   └── 011-restaurant-invites-table.sql
│
├── .env.example                  # Variables d'environnement (template)
├── .env.local                    # Variables d'environnement (local, .gitignore)
├── .gitignore
├── index.html                    # HTML principal
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts                # Configuration Vite
├── tailwind.config.js
├── README.md
├── DEPLOYMENT.md                 # Guide de déploiement
└── DEPLOYMENT-CHECKLIST.md       # Checklist avant prod
```

## 🎯 Naming Conventions

### Fichiers & Dossiers
- **PascalCase** pour les composants React : `Layout.tsx`, `UserProfile.tsx`
- **camelCase** pour les hooks : `useAuth.ts`, `useOrderManager.ts`
- **camelCase** pour les utilitaires : `utils.ts`, `constants.ts`
- **kebab-case** pour les routes : `/restaurant-detail`, `/order-tracking`

### Variables & Functions
```typescript
// Variables
const userName: string = "John"
const isLoading: boolean = false
const items: Item[] = []

// Functions
const handleClick = () => {}
const fetchOrders = async () => {}
const formatPrice = (price: number): string => {}

// Constants
const MAX_ITEMS_PER_ORDER = 50
const API_BASE_URL = process.env.VITE_SUPABASE_URL
```

### Types & Interfaces
```typescript
// Utiliser PascalCase
interface User {
  id: string
  email: string
  fullName: string
}

type UserRole = 'client' | 'restaurant_owner' | 'admin'

// Préfixer les types optionnels avec Maybe
type MaybeString = string | null
```

## 🔄 Patterns Utilisés

### Authentication (useAuth)
```typescript
const { user, profile, signUp, signIn, signOut, hasPermission } = useAuth()

if (hasPermission(['restaurant_owner', 'manager'])) {
  // Admin only
}
```

### Stores (Zustand)
```typescript
// ❌ Créer new stores n'importe où
// ✅ Centraliser tous les stores dans src/store/

import { useUserStore } from '@/store/useUserStore'
const { user, setUser } = useUserStore()
```

### Data Fetching
```typescript
// ❌ Ne PAS fetcher dans useEffect directement
// ✅ Utiliser les hooks personnalisés ou passer les données du parent

const { restaurants, loading } = useRestaurants()
```

### Database Operations
```typescript
// Importer depuis lib/supabase
import { supabase } from '@/lib/supabase'

const { data, error } = await supabase
  .from('restaurants')
  .select('*')
  .eq('id', restaurantId)
  .single()
```

### Error Handling
```typescript
try {
  // Opération
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error('[v0]', message)
  // Afficher toast error
}
```

## 🎨 Composants UI

Tous les composants shadcn/ui sont dans `src/components/ui/`

```typescript
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
```

## 🎯 Styles

- **Tailwind CSS** pour tous les styles
- **CSS-in-JS** seulement si nécessaire (éviter)
- **Design tokens** dans `globals.css` pour les couleurs branding

```typescript
// ✅ Utiliser Tailwind
<div className="bg-primary text-white p-4 rounded-lg">

// ❌ Éviter les styles inline
<div style={{ backgroundColor: '#FF6B00' }}>
```

## ✅ Checklist pour un nouveau composant

```typescript
// 1. Importer les types/interfaces
import type { Restaurant, Order } from '@/lib/types'

// 2. Définir les props
interface ComponentProps {
  items: Item[]
  onSelect: (item: Item) => void
  loading?: boolean
}

// 3. Exporter le composant
export default function MyComponent({ items, onSelect, loading }: ComponentProps) {
  return (
    <div className="space-y-4">
      {/* Contenu */}
    </div>
  )
}

// 4. Ajouter PropTypes/TypeScript (déjà fait avec interfaces)

// 5. Exporter dans l'index du dossier (optionnel)
```

## 🧪 Testing

(À implémenter)
- Vitest pour les tests unitaires
- React Testing Library pour les tests composants
- E2E tests avec Playwright

## 📊 Performance

- Lazy load les routes avec `React.lazy()`
- Utiliser `memo` pour éviter les re-renders inutiles
- Profiler avec React DevTools

## 🚀 Bonnes Pratiques

1. **Préférer les Server Components** quand possible (si utilisation de Next.js)
2. **Minimiser les bundle size** - tree-shake les imports inutiles
3. **Utiliser les environment variables** pour les secrets
4. **Logging structuré** avec `console.log("[v0] message")`
5. **Error boundaries** pour les erreurs rendering
6. **Lazy loading** pour les images et composants lourds
7. **Caching des données** avec SWR quand pertinent

## 🔗 Ressources

- [TypeScript Docs](https://www.typescriptlang.org/)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Shadcn/ui](https://ui.shadcn.com)
- [Supabase Docs](https://supabase.com/docs)
- [Zustand](https://github.com/pmndrs/zustand)

---

**Dernière mise à jour :** 9 mars 2026

