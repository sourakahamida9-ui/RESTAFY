# Restafy — Travaux réalisés (récapitulatif / todo « fait »)

Liste des correctifs et évolutions traités au fil des sessions (à cocher côté équipe si besoin).

## Super admin & données

- [x] **Data Center super admin** : politiques RLS manquantes documentées ; script `071-superadmin-data-collection-rls.sql` pour lecture globale (`order_events`, `daily_restaurant_stats`, `menu_views`, `stock_alerts`).
- [x] **071 robuste** : si les tables n’existent pas, le script ne plante plus — `NOTICE` + ordre d’exécution `038` puis `071`.
- [x] **Page DataCenter** : chargement des métriques en parallèle, lots pour le détail par restaurant, message d’erreur si RLS / API échoue.

## Dashboard restaurant — thème

- [x] **Mode clair / mode nuit** : `RestaurantThemeContext`, `RestaurantThemeToggle`, variables CSS `--r-*` dans `index.css`.
- [x] **AdminLayout** : `data-restaurant-theme`, sidebar / header / inputs alignés sur les tokens.
- [x] **MobileBottomNav** : couleurs selon le thème.
- [x] **Paramètres** : onglet **Apparence** + raccourci header.
- [x] **Overrides texte** mode clair pour `.restaurant-admin-main` (zinc).

## Authentification & architecture

- [x] **Store Zustand** `useAuthStore` : `user`, `profile`, `staffInfo`, `loading`, `error`.
- [x] **`authSync.ts`** : `getSession()` + **un seul** `onAuthStateChange` ; plus de lecture du token `sb-*-auth-token` dans `localStorage`.
- [x] **`useAuth`** : lecture du store + actions (signIn, etc.) ; fini les dizaines de listeners dupliqués.
- [x] **`ProtectedRoute`** : suppression du timeout 3 s ; écran **Profil indisponible** + déconnexion si pas de profil.
- [x] **Login / RestaurantLogin** : cas session sans profil + bouton déconnexion.
- [x] **Rôles** `superadmin` (legacy) : normalisation `normalizeDbRole` / `useRoleGuard`.
- [x] **Dépendance** `axios` retirée (inutilisée).

## Santé projet (tooling)

- [x] **`src/vite-env.d.ts`** : référence Vite + `ImportMetaEnv` pour les `VITE_*`.
- [x] **`tsconfig.json`** : `include` limité à `src/` + `vite.config.ts`, `exclude` de `app/`, `supabase/`, etc.
- [x] **Script npm** `healthcheck` : `build` + `lint`.

## Réservations restaurant (ce correctif)

- [x] **Bug chargement** : `useReservations` sélectionnait `guest_count` et `table_id` (inexistants dans le schéma `065`) → requête en erreur, liste vide. **Select** aligné sur `party_size`, `customer_*`, `table_number`, timestamps, etc.
- [x] **Rechargement** après confirm / refus / terminé : `fetchReservations()` pour rester cohérent si le realtime ne tire pas.
- [x] **UI** : suppression de la **double rangée** de cartes KPI (copier-coller oublié).
- [x] **UX** : bandeau erreur avec message + **Réessayer** ; alerte si pas de `restaurant_id`.
- [x] **Recherche** : garde-fous `?? ''` sur nom / téléphone / notes.

---

## À faire côté infra / produit (hors code ou suite logique)

- [ ] Vérifier en **Supabase** que la migration **`065-restaurant-slug-system`** (ou équivalent) est bien appliquée sur la table `table_reservations`.
- [ ] Vérifier **RLS** : politique `reservations_restaurant_all` (propriétaire / staff) pour que le dashboard lise les lignes.
- [ ] Si le badge « 1 en attente » concerne les **commandes** et pas les réservations, c’est normal que les KPI réservations restent à 0 sans réservations en base.
