// Types pour le serveur RESTAFY QR Scanner

export interface TrpcContext {
  user?: {
    id: string;
    role: string;
  };
  db: any;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
}

export interface TokenInput {
  eventId: string;
  eventName: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface TokenValidationInput {
  token: string;
  eventId?: string;
}

export interface TokenListInput {
  eventId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface TokenRevokeInput {
  tokenId: string;
  reason?: string;
}

export interface QRCodeInput {
  token: string;
  size?: number;
}
