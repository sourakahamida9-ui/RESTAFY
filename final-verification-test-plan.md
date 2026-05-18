# Plan de vérification finale — PR #5 + #6 en prod

**Contexte** : Les PRs #5 et #6 sont mergées sur `main` et déployées sur prod (`app.restafy.shop`, `restafy.shop`, `scan.restafy.shop`). Env var Supabase validée (`serviceRoleKeyLooksValid: true`).

**La seule chose qu'on doit prouver end-to-end** : après un paiement sandbox GeniusPay sur un billet événement, le statut du billet passe **automatiquement** de `pending` à `confirmed`, **sans aucune action manuelle** de l'utilisateur ou d'un admin.

C'est le fix principal des PRs. Avant : webhook cherchait une colonne inexistante (`geniuspay_reference`) → billets bloqués en `pending` → validation manuelle obligatoire. Après : webhook matche par `payment_ref` + metadata.ticket_purchase_id → auto-confirm.

---

## Test principal : Billet événement — auto-confirmation après paiement

### Pré-conditions
- Accès compte client sur `app.restafy.shop` (ou création via `/auth/client-signup`)
- Event actif avec au moins 1 ticket type visible sur `/events`

### Étapes

| # | Action | Attendu (preuve concrète) |
|---|--------|---------------------------|
| 1 | Naviguer sur `https://app.restafy.shop/events`, cliquer sur le 1er event actif | Page event s'ouvre avec au moins 1 bouton "Acheter" visible |
| 2 | Cliquer "Acheter" sur le ticket type, puis bouton "Payer avec GeniusPay" | Redirection navigateur vers `https://pay.genius.ci/checkout/MTX-XXX` (ou équivalent), **page checkout GeniusPay visible** avec montant = montant total (incl. commission) |
| 3 | Sur la page checkout GeniusPay, cliquer sur l'un des moyens (ex. Wave) puis **bouton "Simuler paiement réussi"** (mode sandbox) | Redirection vers `app.restafy.shop/payment/success?type=event` ou équivalent |
| 4 | Attendre **max 10 secondes** (temps webhook), puis naviguer sur `https://app.restafy.shop/my-tickets` | **Le billet qu'on vient d'acheter apparaît dans la liste avec un badge visible `Confirmé` / `Confirmed`** — PAS dans la liste "En attente" / "Pending" |
| 5 | Cliquer sur le billet pour ouvrir sa page détail | Statut = **confirmed**, QR code visible, **PAS de bouton "Valider manuellement" ou "Confirmer le paiement"** visible |

### Critère de réussite
- Le billet passe à `confirmed` **sans aucun clic manuel** entre l'étape 3 (retour sur `/payment/success`) et l'étape 4 (liste des billets).
- Si le billet reste `pending` après 30s → **échec** du fix webhook (il faudrait enquêter les logs `webhook_logs` côté Supabase).

### Pourquoi ce test casserait si le code était buggé
- Si le webhook ne matchait pas (bug d'avant PR #5) : le billet resterait `pending`, apparaîtrait dans une autre liste/onglet, et il y aurait probablement un CTA "Valider" visible.
- Si `/api/payments/initiate` n'écrivait plus la référence (PR #5 non déployée) : même résultat — pending sans match possible.

---

## Tests de régression rapides (1 screenshot chacun)

| # | Action | Attendu |
|---|--------|---------|
| R1 | Ouvrir `https://restafy.shop/` (landing marketing) | Les 3 mockups sous la section "Aperçus" sont **visibles** (opacité 1), pas blank. Le hero preview conserve un léger tilt 3D. |
| R2 | Ouvrir `https://scan.restafy.shop/team?token=fake-token-xyz` (sans PIN valide) | Page affiche champ PIN. **Pas** de message "Invalid API key" ou 500. Un essai avec un faux PIN doit renvoyer un message clair (ex. "Lien invalide" 404) — pas le message cryptique de Supabase. |

---

## Hors scope de cette vérif
- Commande restaurant avec noms des plats : nécessite compte resto + scanner équipe. Je le signalerai si je peux le faire rapidement, sinon je le laisse à tester manuellement au user.
- Test des cas `payment.failed` / `expired` (PR #6) : pas simulable facilement côté client, c'est du backend pur, et le fix est un miroir de `payment.success` déjà prouvé.
