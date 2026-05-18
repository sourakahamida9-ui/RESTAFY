import { describe, expect, it, beforeEach, vi } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';
import * as db from './db';

// Type assertion for mocked functions
type MockedDb = typeof db & {
  getScanHistory: ReturnType<typeof vi.fn>;
};

// Mock database functions
vi.mock('./db', () => ({
  getDb: vi.fn(),
  getTicketByQRCode: vi.fn(),
  validateAndMarkTicketAsUsed: vi.fn(),
  recordScan: vi.fn(),
  recordBehavioralData: vi.fn(),
  updateEventStatistics: vi.fn(),
  getScanHistory: vi.fn(),
  getEventById: vi.fn(),
  getActiveEvents: vi.fn(),
  getTicketsByEventId: vi.fn(),
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

describe('scan.syncOfflineScans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sync multiple offline scans', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Mock successful validations for multiple tickets
    const tickets = [
      {
        id: 1,
        eventId: 1,
        ticketNumber: 'TICKET-001',
        qrCodeData: 'QR001',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        status: 'confirmed',
        isUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        eventId: 1,
        ticketNumber: 'TICKET-002',
        qrCodeData: 'QR002',
        customerName: 'Jane Smith',
        customerEmail: 'jane@example.com',
        status: 'confirmed',
        isUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(db.getTicketByQRCode)
      .mockResolvedValueOnce(tickets[0])
      .mockResolvedValueOnce(tickets[1]);

    vi.mocked(db.validateAndMarkTicketAsUsed)
      .mockResolvedValueOnce({
        success: true,
        ticket: { ...tickets[0], isUsed: 1, status: 'used' },
      })
      .mockResolvedValueOnce({
        success: true,
        ticket: { ...tickets[1], isUsed: 1, status: 'used' },
      });

    const result = await caller.scan.syncOfflineScans({
      eventId: 1,
      scans: [
        {
          qrCodeData: 'QR001',
          scannedAt: Date.now() - 60000,
          scanTimeMs: 150,
          deviceType: 'mobile',
        },
        {
          qrCodeData: 'QR002',
          scannedAt: Date.now() - 30000,
          scanTimeMs: 120,
          deviceType: 'mobile',
        },
      ],
    });

    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results.every(r => r.success)).toBe(true);
  });

  it('should handle partial sync failures', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const ticket = {
      id: 1,
      eventId: 1,
      ticketNumber: 'TICKET-001',
      qrCodeData: 'QR001',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      status: 'confirmed',
      isUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // First scan succeeds, second fails (ticket not found)
    vi.mocked(db.getTicketByQRCode)
      .mockResolvedValueOnce(ticket)
      .mockResolvedValueOnce(undefined);

    vi.mocked(db.validateAndMarkTicketAsUsed).mockResolvedValueOnce({
      success: true,
      ticket: { ...ticket, isUsed: 1, status: 'used' },
    });

    const result = await caller.scan.syncOfflineScans({
      eventId: 1,
      scans: [
        {
          qrCodeData: 'QR001',
          scannedAt: Date.now() - 60000,
          scanTimeMs: 150,
          deviceType: 'mobile',
        },
        {
          qrCodeData: 'INVALID_QR',
          scannedAt: Date.now() - 30000,
          scanTimeMs: 120,
          deviceType: 'mobile',
        },
      ],
    });

    expect(result.synced).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(false);
  });

  it('should update event statistics after sync', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const ticket = {
      id: 1,
      eventId: 1,
      ticketNumber: 'TICKET-001',
      qrCodeData: 'QR001',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      status: 'confirmed',
      isUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getTicketByQRCode).mockResolvedValueOnce(ticket);
    vi.mocked(db.validateAndMarkTicketAsUsed).mockResolvedValueOnce({
      success: true,
      ticket: { ...ticket, isUsed: 1, status: 'used' },
    });

    await caller.scan.syncOfflineScans({
      eventId: 1,
      scans: [
        {
          qrCodeData: 'QR001',
          scannedAt: Date.now() - 60000,
          scanTimeMs: 150,
          deviceType: 'mobile',
        },
      ],
    });

    expect(db.updateEventStatistics).toHaveBeenCalledWith(1);
  });
});

describe('scan.getHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve scan history for an event', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const mockHistory = [
      {
        id: 1,
        ticketId: 1,
        eventId: 1,
        scannedBy: 1,
        scannedAt: new Date(),
        scanLocation: 'Entrance A',
        deviceType: 'mobile',
        ipAddress: '192.168.1.1',
        offlineSyncStatus: 'synced',
        createdAt: new Date(),
      },
      {
        id: 2,
        ticketId: 2,
        eventId: 1,
        scannedBy: 1,
        scannedAt: new Date(),
        scanLocation: 'Entrance B',
        deviceType: 'desktop',
        ipAddress: '192.168.1.2',
        offlineSyncStatus: 'synced',
        createdAt: new Date(),
      },
    ];

    (db.getScanHistory as any).mockResolvedValueOnce(mockHistory);

    const result = await caller.scan.getHistory({
      eventId: 1,
      limit: 50,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.scanLocation).toBe('Entrance A');
    expect(result[1]?.scanLocation).toBe('Entrance B');
  });
});
