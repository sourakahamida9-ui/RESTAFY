/**
 * Rôles & références métier — équipe restaurant (Restafy).
 * Contexte : Afrique de l’Ouest (FCFA, mobile, WhatsApp, USSD MTN/Moov/Celtiis).
 * Les valeurs `value` correspondent à ce que l’app enregistre dans `restaurant_staff.role`.
 *
 * Base : la colonne doit accepter ces libellés (TEXT + CHECK, script 005 / 084).
 * Si PostgreSQL renvoie « invalid input value for enum user_role », exécutez
 * scripts/084-restaurant-staff-role-text.sql sur Supabase.
 */

export type TeamMemberRoleValue =
  | 'manager'
  | 'chef'
  | 'cashier'
  | 'waiter'
  | 'staff'
  | 'livreur';

export interface TeamRoleDefinition {
  value: TeamMemberRoleValue;
  /** Libellé court (badges, listes) */
  label: string;
  /** Couleur Tailwind pour badge */
  badgeClass: string;
  /** Ce que la personne fait au quotidien (resto, zone UEMOA / Bénin…) */
  description: string;
  /** Droits utiles côté produit (kiosque commandes, annulation, caisse…) */
  capabilities: string[];
}

export const TEAM_MEMBER_ROLES: readonly TeamRoleDefinition[] = [
  {
    value: 'manager',
    label: 'Manager',
    badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200/80',
    description:
      'Supervise service et cuisine, gère les imprévus. Point de contact si le propriétaire est absent — typique des gros points de vente ou chaînes urbaines.',
    capabilities: [
      'Accès kiosque « équipe » (commandes) avec lien + PIN',
      'Peut annuler une commande depuis le kiosque (avec chef)',
      'Peut coordonner caisse et salle',
    ],
  },
  {
    value: 'chef',
    label: 'Chef / Cuisine',
    badgeClass: 'bg-orange-100 text-orange-800 border border-orange-200/80',
    description:
      'Préparation des plats, timing des commandes. En Afrique de l’Ouest, souvent le même espace ouvre tôt (déjeuner affaires) et tard (soirée).',
    capabilities: [
      'Accès kiosque commandes pour mise à jour des statuts',
      'Peut annuler une commande depuis le kiosque (avec manager)',
      'Idéal pour le flux cuisine ↔ caisse sans compte e-mail',
    ],
  },
  {
    value: 'cashier',
    label: 'Caissier(ère)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200/80',
    description:
      'Encaissement espèces, mobile money en caisse, tickets. Les clients paient souvent en FCFA cash ou via USSD au comptoir.',
    capabilities: [
      'Peut utiliser le lien équipe si vous lui donnez un PIN (suivi commandes)',
      'Complète le POS / caisse physique du restaurant',
    ],
  },
  {
    value: 'waiter',
    label: 'Serveur / Salle',
    badgeClass: 'bg-sky-100 text-sky-800 border border-sky-200/80',
    description:
      'Prise de commande en salle, service à table ou au comptoir « sur place » (dine-in / sur_place).',
    capabilities: [
      'Peut suivre les commandes via le kiosque sur téléphone',
      'Utile quand le Wi-Fi mobile est la connexion principale',
    ],
  },
  {
    value: 'staff',
    label: 'Équipe (général)',
    badgeClass: 'bg-zinc-100 text-zinc-700 border border-zinc-200/80',
    description:
      'Rôle polyvalent : aide cuisine, plonge, préparation — sans niveau de responsabilité manager/chef.',
    capabilities: ['Accès kiosque possible si vous définissez un PIN', 'Droits d’annulation limités (pas manager/chef)'],
  },
  {
    value: 'livreur',
    label: 'Livreur (fiche équipe)',
    badgeClass: 'bg-amber-100 text-amber-900 border border-amber-200/80',
    description:
      'Livraison moto/vélo en ville. Souvent géré aussi dans l’onglet « Livreurs » (disponibilité, WhatsApp). Numéro au format international (+229…) pour joindre le client.',
    capabilities: [
      'Peut avoir un accès kiosque en secours ; en pratique utilisez l’onglet Livreurs pour la dispo',
      'Pensez aux courses et embouteillages (livraison)',
    ],
  },
] as const;

export function getTeamRoleDefinition(role: string): TeamRoleDefinition {
  const found = TEAM_MEMBER_ROLES.find((r) => r.value === role);
  return found ?? TEAM_MEMBER_ROLES[4];
}

/** Autres énumérations métier (affichage aide / tooltips) — pas des rôles équipe */
export const ORDER_TYPE_REFERENCE: { value: string; label: string; hint: string }[] = [
  { value: 'delivery', label: 'Livraison', hint: 'Course à domicile — frais livraison en FCFA.' },
  { value: 'dine_in', label: 'Sur place', hint: 'Client mange au restaurant.' },
  { value: 'takeaway', label: 'À emporter', hint: 'Retrait au comptoir.' },
  { value: 'pickup', label: 'Retrait', hint: 'Commande prête à récupérer (souvent annoncée par WhatsApp).' },
  { value: 'sur_place', label: 'Sur place (alias)', hint: 'Équivalent salle / comptoir selon configuration.' },
];

export const PAYMENT_METHOD_REFERENCE: { value: string; label: string; hint: string }[] = [
  { value: 'USSD_MTN', label: 'USSD MTN', hint: 'Paiement ou push via code USSD MTN MoMo (très répandu).' },
  { value: 'USSD_MOOV', label: 'USSD Moov', hint: 'Même logique pour Moov Money.' },
  { value: 'USSD_CELTIIS', label: 'USSD Celtiis', hint: 'Opérateur Bénin — flux USSD.' },
  { value: 'CASH', label: 'Espèces FCFA', hint: 'Paiement comptoir — monnaie et arrondis courants.' },
];

export const PAYMENT_STATUS_REFERENCE: { value: string; label: string }[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'completed', label: 'Payé' },
  { value: 'failed', label: 'Échoué' },
  { value: 'refunded', label: 'Remboursé' },
];

export const ORDER_STATUS_REFERENCE: { value: string; label: string; hint: string }[] = [
  { value: 'pending', label: 'En attente', hint: 'Nouvelle commande à traiter.' },
  { value: 'accepted', label: 'Acceptée', hint: 'Le resto a pris la commande.' },
  { value: 'confirmed', label: 'Confirmée', hint: 'Validée côté cuisine / caisse.' },
  { value: 'preparing', label: 'En préparation', hint: 'Cuisine en cours.' },
  { value: 'ready', label: 'Prête', hint: 'À servir ou à faire partir en livraison.' },
  { value: 'delivering', label: 'En livraison', hint: 'Livreur en route.' },
  { value: 'delivered', label: 'Livrée', hint: 'Terminée.' },
  { value: 'cancelled', label: 'Annulée', hint: 'Souvent manager/chef depuis le kiosque.' },
];

export const NOTIF_TYPE_REFERENCE: { value: string; label: string }[] = [
  { value: 'order', label: 'Commande' },
  { value: 'new_order', label: 'Nouvelle commande' },
  { value: 'order_status', label: 'Statut commande' },
  { value: 'payment', label: 'Paiement' },
  { value: 'loyalty', label: 'Fidélité' },
  { value: 'event', label: 'Événement' },
  { value: 'team', label: 'Équipe' },
  { value: 'promo', label: 'Promo' },
  { value: 'system', label: 'Système' },
];
