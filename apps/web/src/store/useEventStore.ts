import { create } from 'zustand';

export interface Event {
  id: string;
  title: string;
  description: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  time: string;
  location: string;
  imageUrl: string;
  type: 'Concert' | 'Soirée' | 'Atelier' | 'Dîner';
  priceRange: string;
  totalCapacity: number;
  soldTickets: number;
  ticketTypes: TicketType[];
}

export interface TicketType {
  id: string;
  name: string;
  price: number;
  benefits: string[];
  capacity: number;
  sold: number;
}

export interface Ticket {
  id: string;
  eventId: string;
  eventTitle: string;
  ticketTypeId: string;
  ticketTypeName: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  qrCodeData: string;
  isUsed: boolean;
  purchaseDate: string;
}

interface EventStore {
  events: Event[];
  myTickets: Ticket[];
  addTicket: (ticket: Ticket) => void;
  getEventById: (id: string) => Event | undefined;
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: [
    {
      id: 'e1',
      title: 'Soirée Afro-Jazz au Maquis',
      description: 'Une soirée inoubliable avec les meilleurs artistes de jazz béninois.',
      restaurantId: '1',
      restaurantName: 'Maquis Le Béninois',
      date: '2026-03-15',
      time: '20:00',
      location: 'Haie Vive, Cotonou',
      imageUrl: 'https://picsum.photos/seed/jazz/800/400',
      type: 'Concert',
      priceRange: '5.000 - 15.000 FCFA',
      totalCapacity: 100,
      soldTickets: 77,
      ticketTypes: [
        { id: 'tt1', name: 'Standard', price: 5000, benefits: ['Accès concert'], capacity: 70, sold: 60 },
        { id: 'tt2', name: 'VIP', price: 15000, benefits: ['Accès concert', 'Boisson offerte', 'Place assise'], capacity: 30, sold: 17 },
      ]
    },
    {
      id: 'e2',
      title: 'Atelier Cuisine Traditionnelle',
      description: 'Apprenez à préparer le vrai Atassi avec notre chef étoilé.',
      restaurantId: '1',
      restaurantName: 'Maquis Le Béninois',
      date: '2026-03-20',
      time: '10:00',
      location: 'Haie Vive, Cotonou',
      imageUrl: 'https://picsum.photos/seed/cooking/800/400',
      type: 'Atelier',
      priceRange: '10.000 FCFA',
      totalCapacity: 20,
      soldTickets: 5,
      ticketTypes: [
        { id: 'tt3', name: 'Unique', price: 10000, benefits: ['Ingrédients inclus', 'Dégustation'], capacity: 20, sold: 5 },
      ]
    }
  ],
  myTickets: [],
  addTicket: (ticket) => set((state) => ({ myTickets: [...state.myTickets, ticket] })),
  getEventById: (id) => get().events.find((e) => e.id === id),
}));
