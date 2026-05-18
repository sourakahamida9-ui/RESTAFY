import { describe, expect, it, beforeEach, vi } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';
import * as db from './db';

// Mock database functions
vi.mock('./db', () => ({
  getDb: vi.fn(),
  getTicketByQRCode: vi.fn(),
  validateAndMarkTicketAsUsed: vi.fn(),
  recordScan: vi.fn(),
  recordBehavioralData: vi.fn(),
  updateEventStatistics: vi.fn(),
}));

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      loginMethod: 'manus',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: 'https',
      headers: {},
      ip: '192.168.1.1',
    } as any,
    res: {} as any,
  };
}

describe('tickets.validateQR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully validate and mark a ticket as used', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Mock successful validation
    vi.mocked(db.getTicketByQRCode).mockResolvedValueOnce({
      id: 1,
      eventId: 1,
      ticketNumber: 'TICKET-001',
      qrCodeData: 'QR123',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      status: 'confirmed',
      isUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(db.validateAndMarkTicketAsUsed).mockResolvedValueOnce({
      success: true,
      ticket: {
        id: 1,
        eventId: 1,
        ticketNumber: 'TICKET-001',
        qrCodeData: 'QR123',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        status: 'used',
        isUsed: 1,
        usedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await caller.tickets.validateQR({
      qrCodeData: 'QR123',
      eventId: 1,
      deviceType: 'mobile',
      timezone: 'Europe/Paris',
      language: 'fr',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('success');
    expect(result.ticket?.ticketNumber).toBe('TICKET-001');
    expect(result.ticket?.customerName).toBe('John Doe');
  });

  it('should return duplicate status for already used ticket', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getTicketByQRCode).mockResolvedValueOnce({
      id: 1,
      eventId: 1,
      ticketNumber: 'TICKET-001',
      qrCodeData: 'QR123',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      status: 'used',
      isUsed: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(db.validateAndMarkTicketAsUsed).mockResolvedValueOnce({
      success: false,
      error: 'Ticket already used',
      ticket: {
        id: 1,
        eventId: 1,
        ticketNumber: 'TICKET-001',
        qrCodeData: 'QR123',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        status: 'used',
        isUsed: 1,
        usedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await caller.tickets.validateQR({
      qrCodeData: 'QR123',
      eventId: 1,
      deviceType: 'mobile',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('duplicate');
    expect(result.message).toContain('already used');
  });

  it('should return invalid status for non-existent ticket', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getTicketByQRCode).mockResolvedValueOnce(undefined);

    const result = await caller.tickets.validateQR({
      qrCodeData: 'INVALID_QR',
      eventId: 1,
      deviceType: 'mobile',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('invalid');
    expect(result.message).toContain('not found');
  });

  it('should record behavioral data on successful scan', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getTicketByQRCode).mockResolvedValueOnce({
      id: 1,
      eventId: 1,
      ticketNumber: 'TICKET-001',
      qrCodeData: 'QR123',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      status: 'confirmed',
      isUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(db.validateAndMarkTicketAsUsed).mockResolvedValueOnce({
      success: true,
      ticket: {
        id: 1,
        eventId: 1,
        ticketNumber: 'TICKET-001',
        qrCodeData: 'QR123',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        status: 'used',
        isUsed: 1,
        usedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await caller.tickets.validateQR({
      qrCodeData: 'QR123',
      eventId: 1,
      deviceType: 'mobile',
      timezone: 'Europe/Paris',
      language: 'fr',
    });

    expect(db.recordBehavioralData).toHaveBeenCalledWith(
      ctx.user!.id,
      'scan_success',
      expect.objectContaining({
        eventId: 1,
        deviceType: 'mobile',
        timezone: 'Europe/Paris',
        language: 'fr',
      })
    );
  });
});
