// Service de stockage offline pour les tickets et sessions

import type { AgentSession, OfflineTicket, ValidationResult } from '@/types/agent';

const STORAGE_KEYS = {
  SESSION: 'agent_session',
  TICKETS: 'offline_tickets',
  VALIDATIONS: 'pending_validations',
  LAST_SYNC: 'last_sync',
  RESTAURANT_DATA: 'restaurant_data',
};

// Session Agent
export function saveAgentSession(session: AgentSession): void {
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
}

export function getAgentSession(): AgentSession | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!data) return null;
    const session = JSON.parse(data);
    // Vérifier expiration
    if (new Date(session.expiresAt) < new Date()) {
      clearAgentSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearAgentSession(): void {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
  localStorage.removeItem(STORAGE_KEYS.TICKETS);
  localStorage.removeItem(STORAGE_KEYS.VALIDATIONS);
}

export function updateSessionOfflineStatus(isOffline: boolean): void {
  const session = getAgentSession();
  if (session) {
    session.isOffline = isOffline;
    if (!isOffline) {
      session.lastSync = new Date();
    }
    saveAgentSession(session);
  }
}

// Tickets Offline
export function saveTickets(tickets: OfflineTicket[]): void {
  localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
  localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
}

export function getOfflineTickets(): OfflineTicket[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TICKETS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addTicket(ticket: OfflineTicket): void {
  const tickets = getOfflineTickets();
  const existingIndex = tickets.findIndex(t => t.code === ticket.code);
  if (existingIndex >= 0) {
    tickets[existingIndex] = ticket;
  } else {
    tickets.push(ticket);
  }
  saveTickets(tickets);
}

export function updateTicketStatus(
  code: string, 
  status: OfflineTicket['status'], 
  validatedBy: string
): OfflineTicket | null {
  const tickets = getOfflineTickets();
  const ticket = tickets.find(t => t.code === code);
  if (ticket) {
    ticket.status = status;
    ticket.validatedAt = new Date();
    ticket.validatedBy = validatedBy;
    ticket.synced = false;
    saveTickets(tickets);
    return ticket;
  }
  return null;
}

// Validation Offline
export function validateTicketOffline(
  code: string, 
  agentId: string
): ValidationResult {
  const tickets = getOfflineTickets();
  const ticket = tickets.find(t => t.code === code);
  
  if (!ticket) {
    return {
      success: false,
      error: 'Ticket non trouvé dans la base offline',
      isOffline: true,
    };
  }
  
  if (ticket.status === 'used') {
    return {
      success: false,
      error: 'Ticket déjà utilisé',
      ticket,
      isOffline: true,
    };
  }
  
  if (ticket.status === 'invalid') {
    return {
      success: false,
      error: 'Ticket invalide',
      ticket,
      isOffline: true,
    };
  }
  
  // Marquer comme utilisé
  const updated = updateTicketStatus(code, 'used', agentId);
  
  // Ajouter à la file d'attente de synchronisation
  addPendingValidation({
    ticketId: ticket.id,
    code: ticket.code,
    validatedAt: new Date(),
    validatedBy: agentId,
  });
  
  return {
    success: true,
    ticket: updated || ticket,
    isOffline: true,
  };
}

interface PendingValidation {
  ticketId: string;
  code: string;
  validatedAt: Date;
  validatedBy: string;
}

export function addPendingValidation(validation: PendingValidation): void {
  const pending = getPendingValidations();
  pending.push(validation);
  localStorage.setItem(STORAGE_KEYS.VALIDATIONS, JSON.stringify(pending));
}

export function getPendingValidations(): PendingValidation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.VALIDATIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function clearPendingValidations(): void {
  localStorage.removeItem(STORAGE_KEYS.VALIDATIONS);
}

// Restaurant Data (pour affichage offline)
export function saveRestaurantData(data: {
  id: string;
  name: string;
  eventName?: string;
  logo?: string;
}): void {
  localStorage.setItem(STORAGE_KEYS.RESTAURANT_DATA, JSON.stringify(data));
}

export function getRestaurantData() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RESTAURANT_DATA);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// Vérifier connexion
export function isOnline(): boolean {
  return navigator.onLine;
}
