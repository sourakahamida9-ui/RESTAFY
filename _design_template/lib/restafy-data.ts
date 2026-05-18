// ─── RESTAFY — Mock Data (structuré pour remplacement API) ───────────────────

export type OrderStatus = 'en_attente' | 'en_preparation' | 'prete' | 'livree'
export type OrderType = 'a_emporter' | 'livraison' | 'sur_place'

export interface Order {
  id: string
  number: string
  type: OrderType
  items: { name: string; qty: number; price: number }[]
  total: number
  status: OrderStatus
  createdAt: string
  customer: string
  note?: string
}

export interface MenuItem {
  id: string
  name: string
  category: string
  price: number
  available: boolean
  image?: string
}

export interface TeamMember {
  id: string
  name: string
  role: string
  pin: string
  usages: number
  active: boolean
  avatar?: string
}

export interface Event {
  id: string
  title: string
  date: string
  ticketsSold: number
  totalTickets: number
  price: number
  status: 'a_venir' | 'passe' | 'annule'
  image?: string
}

// ── Commandes ────────────────────────────────────────────────────────────────
export const ORDERS: Order[] = [
  {
    id: '1',
    number: 'ORD-34031',
    type: 'a_emporter',
    customer: 'Mamadou B.',
    items: [
      { name: 'Thiéboudienne', qty: 2, price: 3500 },
      { name: 'Bissap froid', qty: 2, price: 500 },
    ],
    total: 8000,
    status: 'en_attente',
    createdAt: '2026-04-29T09:15:00',
  },
  {
    id: '2',
    number: 'ORD-34032',
    type: 'livraison',
    customer: 'Aïssata K.',
    items: [
      { name: 'Yassa poulet', qty: 1, price: 4500 },
      { name: 'Alloco banane', qty: 1, price: 1200 },
    ],
    total: 5700,
    status: 'en_attente',
    createdAt: '2026-04-29T09:22:00',
    note: 'Pas trop épicé',
  },
  {
    id: '3',
    number: 'ORD-34033',
    type: 'sur_place',
    customer: 'Kofi A.',
    items: [
      { name: 'Mafé bœuf', qty: 3, price: 4000 },
      { name: 'Jus de gingembre', qty: 3, price: 700 },
    ],
    total: 14100,
    status: 'en_attente',
    createdAt: '2026-04-29T09:30:00',
  },
  {
    id: '4',
    number: 'ORD-34034',
    type: 'a_emporter',
    customer: 'Fatou D.',
    items: [{ name: 'Poulet braisé', qty: 1, price: 5500 }],
    total: 5500,
    status: 'en_preparation',
    createdAt: '2026-04-29T09:05:00',
  },
  {
    id: '5',
    number: 'ORD-34035',
    type: 'livraison',
    customer: 'Ibrahim S.',
    items: [
      { name: 'Kedjenou de volaille', qty: 2, price: 5000 },
      { name: 'Attiéké', qty: 2, price: 800 },
    ],
    total: 11600,
    status: 'en_preparation',
    createdAt: '2026-04-29T08:58:00',
  },
  {
    id: '6',
    number: 'ORD-34036',
    type: 'sur_place',
    customer: 'Nadia T.',
    items: [{ name: 'Salade tropicale', qty: 2, price: 2500 }],
    total: 5000,
    status: 'en_preparation',
    createdAt: '2026-04-29T08:50:00',
  },
  {
    id: '7',
    number: 'ORD-34037',
    type: 'a_emporter',
    customer: 'Oumar F.',
    items: [
      { name: 'Thiéboudienne', qty: 1, price: 3500 },
      { name: 'Kelewele', qty: 1, price: 1500 },
    ],
    total: 5000,
    status: 'en_preparation',
    createdAt: '2026-04-29T08:45:00',
  },
  {
    id: '8',
    number: 'ORD-34038',
    type: 'livraison',
    customer: 'Adja N.',
    items: [{ name: 'Soupe kandia', qty: 2, price: 3200 }],
    total: 6400,
    status: 'prete',
    createdAt: '2026-04-29T08:30:00',
  },
  {
    id: '9',
    number: 'ORD-34039',
    type: 'sur_place',
    customer: 'Moussa C.',
    items: [
      { name: 'Thiébou yapp', qty: 4, price: 4000 },
    ],
    total: 16000,
    status: 'prete',
    createdAt: '2026-04-29T08:20:00',
  },
]

// ── Menu ─────────────────────────────────────────────────────────────────────
export const MENU_ITEMS: MenuItem[] = [
  { id: 'm1', name: 'Thiéboudienne', category: 'Plats principaux', price: 3500, available: true },
  { id: 'm2', name: 'Yassa poulet', category: 'Plats principaux', price: 4500, available: true },
  { id: 'm3', name: 'Mafé bœuf', category: 'Plats principaux', price: 4000, available: true },
  { id: 'm4', name: 'Poulet braisé', category: 'Plats principaux', price: 5500, available: true },
  { id: 'm5', name: 'Kedjenou de volaille', category: 'Plats principaux', price: 5000, available: true },
  { id: 'm6', name: 'Soupe kandia', category: 'Plats principaux', price: 3200, available: true },
  { id: 'm7', name: 'Thiébou yapp', category: 'Plats principaux', price: 4000, available: true },
  { id: 'm8', name: 'Salade tropicale', category: 'Entrées', price: 2500, available: true },
  { id: 'm9', name: 'Kelewele', category: 'Entrées', price: 1500, available: true },
  { id: 'm10', name: 'Alloco banane', category: 'Entrées', price: 1200, available: true },
  { id: 'm11', name: 'Attiéké', category: 'Entrées', price: 800, available: true },
  { id: 'm12', name: 'Beignets de crevettes', category: 'Entrées', price: 2000, available: false },
  { id: 'm13', name: 'Fondant chocolat-noix', category: 'Desserts', price: 2200, available: true },
  { id: 'm14', name: 'Tarte mangue-coco', category: 'Desserts', price: 1800, available: true },
  { id: 'm15', name: 'Gâteau gingembre', category: 'Desserts', price: 1600, available: true },
  { id: 'm16', name: 'Bissap froid', category: 'Boissons', price: 500, available: true },
  { id: 'm17', name: 'Jus de gingembre', category: 'Boissons', price: 700, available: true },
  { id: 'm18', name: 'Ditakh', category: 'Boissons', price: 600, available: true },
]

export const MENU_CATEGORIES = ['Plats principaux', 'Entrées', 'Desserts', 'Boissons']

// ── Équipe ───────────────────────────────────────────────────────────────────
export const TEAM_MEMBERS: TeamMember[] = [
  { id: 't1', name: 'Souraka', role: 'Manager', pin: '0000', usages: 0, active: true },
  { id: 't2', name: 'Aminata', role: 'Caissière', pin: '3465', usages: 8, active: true },
  { id: 't3', name: 'Boubacar', role: 'Cuisinier', pin: '7821', usages: 5, active: true },
  { id: 't4', name: 'Ndeye', role: 'Serveuse', pin: '2290', usages: 2, active: false },
]

// ── Événements ───────────────────────────────────────────────────────────────
export const EVENTS: Event[] = [
  {
    id: 'e1',
    title: 'RESTAFY Innovation Night',
    date: '2026-04-26T19:00:00',
    ticketsSold: 0,
    totalTickets: 25,
    price: 0,
    status: 'a_venir',
  },
  {
    id: 'e2',
    title: 'Soirée Afro Fusion — Mai 2026',
    date: '2026-05-10T20:00:00',
    ticketsSold: 18,
    totalTickets: 80,
    price: 15000,
    status: 'a_venir',
  },
  {
    id: 'e3',
    title: 'Festival des Saveurs de l\'Ouest',
    date: '2026-03-15T18:00:00',
    ticketsSold: 45,
    totalTickets: 50,
    price: 10000,
    status: 'passe',
  },
  {
    id: 'e4',
    title: 'Brunch Dimanche Teranga',
    date: '2026-02-09T11:00:00',
    ticketsSold: 63,
    totalTickets: 63,
    price: 8000,
    status: 'passe',
  },
]

// ── Statistiques sparklines (7 jours) ────────────────────────────────────────
export const ORDERS_SPARKLINE = [
  { day: 'L', orders: 12 },
  { day: 'M', orders: 18 },
  { day: 'M', orders: 9 },
  { day: 'J', orders: 22 },
  { day: 'V', orders: 30 },
  { day: 'S', orders: 35 },
  { day: 'D', orders: 21 },
]

export const PAYMENT_SPLIT = [
  { name: 'Mobile Money', value: 58, color: '#2A6B5E' },
  { name: 'Espèces', value: 31, color: '#F3A739' },
  { name: 'Carte', value: 11, color: '#E86F3F' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
export const formatFCFA = (amount: number) =>
  `${amount.toLocaleString('fr-FR')} FCFA`

export const STATUS_LABELS: Record<OrderStatus, string> = {
  en_attente: 'En attente',
  en_preparation: 'En préparation',
  prete: 'Prête',
  livree: 'Livrée',
}

export const TYPE_LABELS: Record<OrderType, string> = {
  a_emporter: 'À emporter',
  livraison: 'Livraison',
  sur_place: 'Sur place',
}
