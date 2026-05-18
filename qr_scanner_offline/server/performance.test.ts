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

describe('Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate QR code within 500ms', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const ticket = {
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
    };

    vi.mocked(db.getTicketByQRCode).mockResolvedValueOnce(ticket);
    vi.mocked(db.validateAndMarkTicketAsUsed).mockResolvedValueOnce({
      success: true,
      ticket: { ...ticket, isUsed: 1, status: 'used' },
    });

    const startTime = performance.now();

    await caller.tickets.validateQR({
      qrCodeData: 'QR123',
      eventId: 1,
      deviceType: 'mobile',
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(500);
  });

  it('should sync 100 offline scans within 2 seconds', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const scans = Array.from({ length: 100 }, (_, i) => ({
      qrCodeData: `QR${String(i).padStart(3, '0')}`,
      scannedAt: Date.now() - (100 - i) * 1000,
      scanTimeMs: 100 + Math.random() * 50,
      deviceType: 'mobile',
    }));

    // Mock all tickets as valid
    vi.mocked(db.getTicketByQRCode).mockImplementation(async (qrCode) => ({
      id: parseInt(qrCode.replace('QR', ''), 10),
      eventId: 1,
      ticketNumber: `TICKET-${qrCode}`,
      qrCodeData: qrCode,
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      status: 'confirmed',
      isUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    vi.mocked(db.validateAndMarkTicketAsUsed).mockImplementation(async (ticketId) => ({
      success: true,
      ticket: {
        id: ticketId,
        eventId: 1,
        ticketNumber: `TICKET-${ticketId}`,
        qrCodeData: `QR${String(ticketId).padStart(3, '0')}`,
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        status: 'used',
        isUsed: 1,
        usedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));

    const startTime = performance.now();

    const result = await caller.scan.syncOfflineScans({
      eventId: 1,
      scans,
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.synced).toBe(100);
    expect(duration).toBeLessThan(2000);
  });

  it('should retrieve 50 scan history records within 200ms', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const mockHistory = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      ticketId: i + 1,
      eventId: 1,
      scannedBy: 1,
      scannedAt: new Date(Date.now() - (50 - i) * 1000),
      scanLocation: `Entrance ${String.fromCharCode(65 + (i % 4))}`,
      deviceType: i % 2 === 0 ? 'mobile' : 'desktop',
      ipAddress: `192.168.1.${i + 1}`,
      offlineSyncStatus: 'synced' as const,
      createdAt: new Date(),
    }));

    (db.getScanHistory as any).mockResolvedValueOnce(mockHistory);

    const startTime = performance.now();

    const result = await caller.scan.getHistory({
      eventId: 1,
      limit: 50,
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result).toHaveLength(50);
    expect(duration).toBeLessThan(200);
  });

  it('should handle concurrent scan validations efficiently', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const concurrentScans = 10;
    const ticket = {
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
    };

    vi.mocked(db.getTicketByQRCode).mockResolvedValue(ticket);
    vi.mocked(db.validateAndMarkTicketAsUsed).mockResolvedValue({
      success: true,
      ticket: { ...ticket, isUsed: 1, status: 'used' },
    });

    const startTime = performance.now();

    const promises = Array.from({ length: concurrentScans }, (_, i) =>
      caller.tickets.validateQR({
        qrCodeData: `QR${i}`,
        eventId: 1,
        deviceType: 'mobile',
      })
    );

    const results = await Promise.all(promises);

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(results).toHaveLength(concurrentScans);
    expect(results.every(r => r.success || !r.success)).toBe(true);
    expect(duration).toBeLessThan(2000); // 10 concurrent requests should complete in < 2s
  });
});
