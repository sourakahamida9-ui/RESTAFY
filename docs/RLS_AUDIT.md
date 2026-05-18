# RLS Audit — Restafy

> Inventaire des politiques Row Level Security actives sur les tables sensibles de
> l'OMS (orders, order_items, payments, order_events, restaurant_staff, restaurants).
> Source : scripts SQL dans `scripts/`. Toujours valider en prod via le SQL Editor
> Supabase :
>
> ```sql
> SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
> FROM pg_policies WHERE tablename IN
>   ('orders','order_items','payments','order_events','restaurant_staff','restaurants')
> ORDER BY tablename, policyname;
> ```

## Helpers utilisés par les policies

| Fonction (SECURITY DEFINER) | Rôle |
|---|---|
| `get_my_role()` | Renvoie le rôle du profil courant (`super_admin`, `restaurant_owner`, `manager`, `staff`, `chef`, `caissier`, `livreur`, `customer`...). Defined in `scripts/054-fix-all-rls-final.sql`. |
| `get_my_restaurant_id()` | Renvoie `profiles.restaurant_id` du caller. |
| `is_valid_order_transition(from, to)` | Validation state machine (V1 — `scripts/102-oms-state-machine.sql`). |
| `change_order_status(order_id, new_status, device)` | RPC unique pour modifier le statut. SECURITY DEFINER, validation auth + role + ownership. |

## 1. `orders`

ALTER TABLE … ENABLE ROW LEVEL SECURITY.

| Policy | Cmd | Conditions | Source |
|---|---|---|---|
| `orders_select_restaurant` | SELECT | `restaurant_id = get_my_restaurant_id() AND get_my_role() IN (restaurant_owner, restaurant, manager, staff, livreur, caissier, chef)` OU `restaurants.owner_id = auth.uid()` | `075-fix-orders-rls-roles.sql` |
| `orders_update_restaurant` | UPDATE | mêmes rôles + fallback `restaurant_staff.profile_id = auth.uid() AND is_active` | `075-fix-orders-rls-roles.sql` |
| `orders_select_customer` | SELECT | `customer_id = auth.uid()` | `054-fix-all-rls-final.sql` |
| `orders_insert_customer` | INSERT | `customer_id = auth.uid()` | `053-fix-order-creation-rls.sql` |
| `orders_superadmin_all` | ALL | `get_my_role() = 'super_admin'` | `070-rls-fixes.sql` |

**Important** : depuis V1 (PR #113), tous les changements de statut passent par la
RPC `change_order_status` qui :
1. Vérifie `auth.uid()` non-null
2. Charge le profil + restaurant cible
3. Valide le rôle (`super_admin`, `restaurant_owner`, `manager`, `staff`, `chef`)
4. Vérifie l'ownership via `profile.restaurant_id = order.restaurant_id` ou
   `restaurants.owner_id = auth.uid()` ou `restaurant_staff.profile_id = auth.uid()`
5. Pre-validation transition via `is_valid_order_transition`
6. UPDATE qui re-déclenche le trigger `enforce_order_status_transition` (double-check)

➜ **Le frontend ne peut plus contourner la state machine** : un client malveillant
qui essaierait `update({status:'delivered'})` direct se ferait rejeter par le
trigger même si la policy UPDATE le laisse passer.

## 2. `order_items`

| Policy | Cmd | Conditions | Source |
|---|---|---|---|
| `order_items_select_restaurant` | SELECT | EXISTS sur `orders` correspondant pour resto/staff | `075-fix-orders-rls-roles.sql` |
| `order_items_select_customer` | SELECT | EXISTS sur `orders` où `customer_id = auth.uid()` | `075-fix-orders-rls-roles.sql` |
| `order_items_superadmin_all` | ALL | `get_my_role() = 'super_admin'` | `075-fix-orders-rls-roles.sql` |
| `order_items_insert_customer` | INSERT | EXISTS sur `orders` où `customer_id = auth.uid()` | `053-fix-order-creation-rls.sql` |

## 3. `payments`

| Policy | Cmd | Conditions | Source |
|---|---|---|---|
| `payments_select_restaurant` | SELECT | EXISTS sur `orders` du restaurateur (jointure restaurant_id) | `088-webhook-logs-and-payments.sql` |
| `payments_select_customer` | SELECT | `payer_id = auth.uid()` | `088-webhook-logs-and-payments.sql` |
| `payments_superadmin_all` | ALL | `get_my_role() = 'super_admin'` | `088-webhook-logs-and-payments.sql` |

**Mutations interdites côté client** : tous les inserts/updates passent par
- `/api/payments/initiate` (Vercel function, service role)
- `/api/webhooks` (HMAC vérifié, service role)
- `confirm_payment(...)` RPC atomique (PR #14)

➜ Pas de policy INSERT/UPDATE pour `authenticated` — le client ne peut JAMAIS
écrire dans `payments` directement.

## 4. `order_events` (V1)

| Policy | Cmd | Conditions | Source |
|---|---|---|---|
| `restaurant_owner_can_read_order_events` | SELECT | EXISTS sur `orders` du restaurateur | `077-order-events-minimal.sql` |
| `superadmin_read_all_order_events` | SELECT | `get_my_role() = 'super_admin'` | `077-order-events-minimal.sql` |

**Insert** : effectué uniquement par le trigger `trigger_log_order_event` (AFTER UPDATE)
qui s'exécute en SECURITY DEFINER (héritage de la fonction). Pas de policy INSERT pour
`authenticated` → impossible de fabriquer des événements.

## 5. `restaurant_staff`

| Policy | Cmd | Conditions | Source |
|---|---|---|---|
| `restaurant_staff_select_owner` | SELECT | `restaurants.owner_id = auth.uid()` | `070-rls-fixes.sql` |
| `restaurant_staff_select_self` | SELECT | `profile_id = auth.uid()` | `070-rls-fixes.sql` |
| `restaurant_staff_insert_owner` | INSERT | restaurant possédé | `070-rls-fixes.sql` |
| `restaurant_staff_update_owner` | UPDATE | restaurant possédé | `070-rls-fixes.sql` |
| `restaurant_staff_delete_owner` | DELETE | restaurant possédé | `070-rls-fixes.sql` |

## 6. `restaurants`

| Policy | Cmd | Conditions | Source |
|---|---|---|---|
| `restaurants_select_public` | SELECT | `is_published = true` (catalogue marketplace) | `080-fix-restaurants-rls-onboarding.sql` |
| `restaurants_select_owner` | SELECT | `owner_id = auth.uid()` | `018-fix-restaurants-rls.sql` |
| `restaurants_select_staff` | SELECT | EXISTS sur `restaurant_staff` | `070-rls-fixes.sql` |
| `restaurants_insert_authenticated` | INSERT | `owner_id = auth.uid()` (onboarding) | `058-fix-restaurant-creation-rls.sql` |
| `restaurants_update_owner` | UPDATE | `owner_id = auth.uid()` | `018-fix-restaurants-rls.sql` |
| `restaurants_superadmin_all` | ALL | `get_my_role() = 'super_admin'` | `070-rls-fixes.sql` |

## 7. `analytics_events`

Table de tracking d'événements applicatifs (vue page, clic, conversion). Indexée `(event_type, occurred_at DESC)` et `(user_id, occurred_at DESC)` depuis #71.

| Policy | Cmd | Conditions | Source |
|---|---|---|---|
| `insert_own_analytics` | INSERT | `user_id = auth.uid() OR user_id IS NULL` | `070-rls-fixes.sql` |
| `read_own_analytics` | SELECT | `user_id = auth.uid()` | `070-rls-fixes.sql` |
| `super_admin_read_all_analytics` | SELECT | `EXISTS profiles WHERE id = auth.uid() AND role = 'super_admin'` | `070-rls-fixes.sql` |

➜ **Un user authentifié peut tracker ses propres événements (et anonymes `user_id IS NULL`)** — c'est volontaire pour l'analytics côté client. Personne ne peut UPDATE / DELETE (pas de policy).

## 8. `rate_limit_events` (#72)

Table backing du rate-limit Supabase (cf. `api/_shared/rateLimit.ts` + RPC `check_rate_limit`).

| RLS | État | Source |
|---|---|---|
| `ALTER TABLE … ENABLE ROW LEVEL SECURITY` | **❌ NON activée** | `100-rate-limit-table.sql` |

**Sécurité actuelle (implicite)** :
- La RPC `check_rate_limit` est `SECURITY DEFINER` et `GRANT EXECUTE … TO service_role` uniquement.
- Les routes `/api/*` qui appellent cette RPC le font via `getSupabaseAdmin()` (service_role).
- Aucun client `anon` ou `authenticated` n'a `EXECUTE` sur la RPC ni `SELECT/INSERT` sur la table (aucun `GRANT` explicite à `authenticated` n'a été émis).

**Recommandation defense-in-depth** : activer RLS avec une policy deny-all explicite, pour qu'un futur `GRANT … TO authenticated` accidentel ne puisse pas exposer les compteurs de rate-limit (qui leakerait le pattern d'attaque actuel).

```sql
ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;
-- Pas de policy = personne ne peut SELECT/INSERT/UPDATE/DELETE
-- (le service_role bypasse de toute façon RLS).
```

## 9. Tables annexes (référence)

- `notifications` : `35-fix-notifications-rls.sql` — chaque user voit ses notifs uniquement.
- `reviews` : `079-reviews-purchase-only-rls.sql` — un client ne peut review que les commandes qu'il a réellement passées.
- `tickets`, `ticket_purchases` : `030-ticket-purchases-rls.sql` — owner du restaurant + acheteur uniquement.
- `webhook_logs` : `088-webhook-logs-and-payments.sql` — super-admin uniquement.
- `daily_restaurant_stats`, `menu_views`, `stock_alerts`, `admin_actions` : `038-data-collection-infrastructure.sql` + `071-superadmin-data-collection-rls.sql` — super-admin SELECT, restaurant_owner SELECT scopé via `restaurant_id`.

### Table `events_log` (mentionnée dans l'analyse robustesse externe)

**N'existe pas en base.** L'analyse externe « ajouter une table `events_log` (`order_created`, `payment_success`, `status_changed`, `ticket_scanned`) » était une **recommandation**, pas une description du schema actuel. La table équivalente **qui existe** est `order_events` (cf. section 4) et couvre les événements de commande / changements de statut. Pour les événements paiement / ticket scan, on s'appuie aujourd'hui sur :

- `payments` + `payment_attempts` (mutations historisées)
- `webhook_logs` (audit des webhooks reçus)
- `analytics_events` (événements applicatifs, dont `ticket_scanned` côté client)

Si le besoin d'un journal métier unifié devient pressant, créer une table `events_log` consolidée fait sens (1 seul stream pour debug end-to-end). À ce moment-là, prévoir : RLS super_admin SELECT uniquement, INSERT depuis triggers `SECURITY DEFINER`, pas d'INSERT direct depuis le client.

## Garanties par rôle

### `customer` (utilisateur final)
- voit ses propres commandes, items, paiements, billets, notifs
- voit les restaurants publiés (`is_published = true`)
- ne peut pas modifier le statut d'une commande (la policy UPDATE échoue + le trigger
  V1 rejette les transitions invalides côté serveur)

### `restaurant_owner` / `manager`
- voit/modifie ses commandes, items, paiements (via owner_id ou profile.restaurant_id)
- voit/modifie ses staff, son restaurant, son menu, sa fidélité
- ne voit pas les autres restaurants

### `staff` / `chef` / `caissier` / `livreur`
- accès SELECT/UPDATE sur les commandes du restaurant uniquement (via `restaurant_staff`)
- pas de droits sur menu/team/réglages (UI gated par `isRestaurantOpsOnlyUser`)
- les changements de statut passent par `change_order_status` qui valide le rôle
  parmi `manager`, `staff`, `chef`

### `super_admin`
- accès `ALL` sur toutes les tables sensibles via la policy `*_superadmin_all`
- doit être limité à un nombre minimal de comptes (cf. `accounts/devs uniquement`)

## Recommandations résiduelles

1. **Audit annuel** : exécuter un `SELECT * FROM pg_policies WHERE schemaname='public'`
   et comparer avec ce document.
2. **Revoke direct** : envisager `REVOKE INSERT, UPDATE, DELETE ON payments FROM authenticated`
   pour cadenasser même si une policy est introduite par erreur.
3. **`SECURITY INVOKER` par défaut** : nouvelles fonctions doivent être `INVOKER`
   sauf si le `SECURITY DEFINER` est strictement nécessaire (cas RPC d'autorité comme
   `change_order_status`, `confirm_payment`).
4. **Tests RLS dans CI** : envisager un test Postgres minimal qui se connecte avec
   `set local role authenticated` + `set local request.jwt.claim.sub = '<id-fictif>'`
   et tente des UPDATE/SELECT interdits, pour vérifier que les policies bloquent.

---

_Dernière mise à jour : Audit PR C (RESTAFY_FULL_AUDIT_2026) — ajout de `analytics_events`, `rate_limit_events`, et clarification de l'absence de `events_log`._
