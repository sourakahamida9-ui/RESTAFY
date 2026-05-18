# RESTAFY — Audit & phases de correction

Liste structurée par priorité. Chaque phase est testable indépendamment (manuellement ou E2E).

**Implémenté côté code (à valider chez vous)** : Phase 1 (routes `/r/:slug` + legacy), correctifs Phase 2 (sélecteur modes) et logs Phase 3 partiels — voir cases cochées ci-dessous.

---

## Phase 1 : Routes (bloquant)

- [x] Architecture React Router v6 revue : page complète sous `/r/:slug` (plus de route principale `/@*`)
- [x] Liens internes, QR, admin slug → URLs `/r/:slug`
- [x] Ordre des routes : `/restaurant/:id` et `/r/:slug` **avant** `/:slug` (aperçu)
- [x] Legacy : `/@slug` (un segment) redirige vers `/r/slug` ; `/@slug/full` redirige vers `/r/slug`
- [ ] **Test** : `/r/restafy` affiche `RestaurantDetail` dans le `Layout`
- [ ] **Test** : `/restaurant/[uuid]` affiche `RestaurantPreview` (pas la page complète)

---

## Phase 2 : Sélecteur modes de commande

- [x] `useOrderModes` charge `id`, `code`, … depuis Supabase (pas de schéma DB modifié)
- [x] Comparaison de sélection : `value === mode.code` avec clés React stables (`rowId` = id ligne)
- [x] Normalisation des codes DB (`livraison`, `sur_place`, …) vers `delivery` | `dine_in` | `takeaway`
- [x] `handleModeChange` met à jour l’état local (frais livraison, etc.)
- [ ] **Test** : un seul mode visuellement actif ; cliquer « Livraison » désactive les autres

---

## Phase 3 : Page restaurant complète

- [x] `RestaurantDetail` résout le slug via `useParams().slug` (`/r/:slug`)
- [x] Chargement par `id` ou `slug` Supabase (liste + fetch direct si absent du cache)
- [ ] Affichage : horaires, réservations, avis, actions (selon l’existant)
- [x] Logs dev `console.log('[v0]', ...)` pour tracer pathname / slug / fetch
- [ ] **Test** : `/r/[slug]` affiche menu + blocs attendus

---

## Phase 4 : Dashboards admin

- [ ] `RestaurantDashboard` : KPI + données réelles (commandes du jour, ventes, etc.)
- [ ] `OrdersDashboard` : table alimentée par Supabase
- [ ] `Reservations` : données réelles, JSX valide (pas d’erreur build)
- [ ] `MenuManagement` : menu réel + KPI cohérents
- [ ] Chaque dashboard : en-tête + 4 cartes KPI + zone de contenu

---

## Phase 5 : Validation globale

- [ ] Accueil OK
- [ ] Recherche / liste restaurants OK
- [ ] Clic « page complète » → `/r/[slug]`
- [ ] Panier : un seul mode de commande sélectionné
- [ ] Admin : données réelles visibles
- [ ] Pas d’erreurs console bloquantes en navigation courante

---

## Notes

- Ne pas modifier Supabase (tables, colonnes, RLS) — uniquement app React / routing / UI.
- Conserver `lazy()` pour les pages et Tailwind pour le style.
