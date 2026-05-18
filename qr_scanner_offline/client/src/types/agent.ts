// Types pour l'authentification agent

export interface AgentCredentials {
  email: string;
  password: string;
}

export interface AgentToken {
  token: string;
  restaurantId: string;
  eventId?: string;
  permissions: string[];
  expiresAt: string;
}

export interface AgentSession {
  id: string;
  email: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  token: string;
  permissions: string[];
  isOffline: boolean;
  lastSync: Date | null;
  expiresAt: Date;
}

export interface OfflineTicket {
  id: string;
  code: string;
  eventId: string;
  customerName: string;
  customerEmail: string;
  ticketType: string;
  status: 'valid' | 'used' | 'invalid' | 'pending_sync';
  validatedAt?: Date;
  validatedBy?: string;
  synced: boolean;
}

export interface ValidationResult {
  success: boolean;
  ticket?: OfflineTicket;
  error?: string;
  isOffline: boolean;
}
