# RESTAFY — TODO globale (demandes & suites)

Liste priorisée, phases testables. Cocher au fur et à mesure.

## Phase A — Tableau de bord restaurant (fait / en cours)

- [x] KPI « Aujourd’hui » : CA et nombre = **vraies** commandes **livrées aujourd’hui** (pas le cumul historique).
- [x] Passage **Prête → En livraison** sur une commande **livraison** : assignation auto du premier livreur **disponible** (`delivery_drivers`).
- [x] Message clair si aucun livreur disponible (inviter à l’onglet Équipe / livreurs).
- [x] Afficher sur la carte commande le **nom du livreur** une fois `driver_id` renseigné (lecture `delivery_drivers`).
- [ ] Lier `livreurs` (paramètres) et `delivery_drivers` (équipe) si votre projet utilise les deux tables (doc interne).

## Phase B — Page Commandes (`OrdersDashboard`)

- [x] Même logique d’**assignation auto** au passage en livraison (cohérent avec le dashboard principal).
- [ ] Filtres sauvegardés en localStorage (optionnel).

## Phase C — Import menu IA (`gemini-menu-import`)

- [ ] Déployer la Edge Function + secret `GEMINI_API_KEY` (voir encadré sur la page Import photo).
- [ ] Vérifier qu’il n’y a plus d’erreur **405** après déploiement.

## Phase D — UX / branding Restafy

- [ ] Harmoniser toutes les pages admin sur fond clair + accents **orange** (#f97316 / orange-500).
- [ ] Page Commandes : thème clair optionnel (aujourd’hui thème sombre).
- [ ] États vides avec **CTA** (ouvrir restaurant, ajouter menu, ajouter livreur).

## Phase E — Livreurs & logistique (évolution)

- [ ] Répartition équitable (round-robin) ou par zone au lieu du premier alphabétique.
- [ ] Notification push / WhatsApp auto au livreur assigné (Edge Function ou intégration existante).
- [ ] Carte ou file d’attente des livreurs en cours de route.

## Phase F — Qualité & prod

- [ ] Tests manuels : commande livraison de bout en bout avec assignation.
- [ ] Variables `.env` sur Vercel alignées avec le local.
- [ ] Pas de secrets dans le dépôt (`.env` ignoré).

---

*Dernière mise à jour : générée pour suivi des demandes « dashboard dynamique + auto livreur + TODO ».*
