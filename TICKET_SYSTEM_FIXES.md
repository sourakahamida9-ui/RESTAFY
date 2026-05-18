# Ticket System Fixes Summary

## Problème 1: Pas d'interface pour configurer les types de billets ✅ FIXÉ

**Solution appliquée**: Ajout d'un formulaire complet dans le modal de création d'événement (RestaurantDashboardEvents.tsx admin).

- État: `ticketTypes` avec 1 type standard de base (100 places)
- Bouton "+ Ajouter un type" pour créer plusieurs types (Standard, VIP, etc.)
- Grille d'input pour: Nom, Prix (FCFA), Nombre de places
- Bouton X pour supprimer un type (si plus d'un)
- Label "Nom · Prix (FCFA) · Nombre de places"

**Flux:**
1. Restaurant remplit infos événement
2. Ajoute les types de billets (ex: Standard 3000, VIP 8000)
3. Click "Créer l'événement"
4. L'événement est créé
5. Les billets (tickets) sont créés dans `event_tickets` avec nom, prix, quantité

---

## Problème 2: Colonnes incorrectes de l'insert ticket_purchases ✅ FIXÉ

**Solution appliquée**: EventCheckout.tsx insert correct depuis le début.

Colonnes utilisées:
- `event_id` - ID de l'événement
- `ticket_id` - ID du type de billet
- `customer_id` - auth.uid() du client
- `customer_name` - Nom du client
- `customer_email` - Email du client
- `customer_phone` - Téléphone du client
- `amount_paid` - Montant payé (prix * quantité)

Pas d'insertion de `quantity`, `total_price`, `status` (colonnes inexistantes).

---

## Problème 3: RLS manquante sur ticket_purchases ✅ FIXÉ

**Solution appliquée**: Script 030 exécuté avec 4 policies:

1. **tp_customer_insert** - Client peut insérer ses propres achats
2. **tp_customer_read** - Client peut lire ses propres billets
3. **tp_restaurant_read** - Restaurant voit les billets de ses événements
4. **tp_restaurant_update** - Restaurant peut valider les billets (mettre à jour)
5. **tp_superadmin_all** - SuperAdmin accès complet

---

## Flux complet maintenant fonctionnel

**Restaurant:**
1. Crée un événement
2. Configure les types de billets (Standard, VIP, etc.) avec prix
3. Billets s'insèrent dans `event_tickets`

**Client:**
1. Visite /events
2. Click sur un événement → EventDetail.tsx
3. Voit les billets disponibles avec prix
4. Sélectionne quantité par type
5. Click "Acheter" → EventCheckout.tsx
6. Paiement simulé
7. `ticket_purchases` créé avec tous les détails
8. Confirmation par email

**Validation:**
1. Restaurant scanner billets depuis admin
2. Met à jour `validated_at` dans `ticket_purchases`
3. Voit le CA généré par événement

---

## Fichiers modifiés

- `scripts/030-ticket-purchases-rls.sql` - RLS policies créées et exécutées
- `src/pages/admin/RestaurantDashboardEvents.tsx` - Formulaire types de billets ajouté (+73 lignes)
- `src/pages/EventCheckout.tsx` - Déjà correct (colonnes OK)
