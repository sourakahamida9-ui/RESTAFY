import Dexie, { type Table } from 'dexie';

/**
 * Local IndexedDB database for offline ticket scanning
 * Stores tickets, scans, and sync queue for bidirectional synchronization
 */

export interface LocalTicket {
  id?: number;
  ticketNumber: string;
  qrCodeData: string;
  customerName: string;
  customerEmail?: string;
  status: 'pending' | 'confirmed' | 'used' | 'cancelled';
  isUsed: boolean;
  eventId: number;
  createdAt: number; // timestamp
}

export interface LocalScan {
  id?: number;
  ticketId: number;
  eventId: number;
  scannedAt: number; // timestamp
  scanTimeMs: number;
  deviceType: string;
  syncStatus: 'pending' | 'synced' | 'conflict';
  qrCodeData: string; // for reference
  ticketNumber: string; // for reference
}

export interface SyncQueueItem {
  id?: number;
  ticketId: number;
  eventId: number;
  action: 'scan' | 'mark_used';
  payload: string; // JSON stringified
  status: 'pending' | 'synced' | 'failed';
  syncAttempts: number;
  lastSyncAttempt?: number; // timestamp
  createdAt: number; // timestamp
}

export interface LocalEvent {
  id: number;
  title: string;
  description?: string;
  startTime: number; // timestamp
  endTime?: number; // timestamp
  location?: string;
  capacity?: number;
  totalTickets: number;
  scannedTickets: number;
  createdAt: number; // timestamp
}

export class QRScannerDB extends Dexie {
  tickets!: Table<LocalTicket>;
  scans!: Table<LocalScan>;
  syncQueue!: Table<SyncQueueItem>;
  events!: Table<LocalEvent>;

  constructor() {
    super('QRScannerDB');
    this.version(1).stores({
      tickets: '&qrCodeData, ticketNumber, eventId',
      scans: '++id, ticketId, eventId, syncStatus',
      syncQueue: '++id, ticketId, status, createdAt',
      events: '&id, startTime',
    });
  }
}

export const db = new QRScannerDB();

/**
 * Ticket operations
 */
export async function saveTickets(tickets: LocalTicket[]): Promise<void> {
  await db.tickets.bulkPut(tickets);
}

export async function getTicketByQRCode(qrCodeData: string): Promise<LocalTicket | undefined> {
  return db.tickets.get(qrCodeData);
}

export async function getTicketsByEventId(eventId: number): Promise<LocalTicket[]> {
  return db.tickets.where('eventId').equals(eventId).toArray();
}

export async function markTicketAsUsed(qrCodeData: string): Promise<void> {
  await db.tickets.update(qrCodeData, { isUsed: true });
}

export async function getUnusedTicketsCount(eventId: number): Promise<number> {
  return db.tickets.where('eventId').equals(eventId).filter(t => !t.isUsed).count();
}

/**
 * Scan history operations
 */
export async function saveScan(scan: LocalScan): Promise<number> {
  return db.scans.add(scan);
}

export async function getScansByEventId(eventId: number): Promise<LocalScan[]> {
  return db.scans.where('eventId').equals(eventId).toArray();
}

export async function getScansByTicketId(ticketId: number): Promise<LocalScan[]> {
  return db.scans.where('ticketId').equals(ticketId).toArray();
}

export async function getPendingSyncs(): Promise<LocalScan[]> {
  return db.scans.where('syncStatus').equals('pending').toArray();
}

export async function markScansAsSynced(scanIds: number[]): Promise<void> {
  await db.scans.bulkUpdate(scanIds.map(id => ({ key: id, changes: { syncStatus: 'synced' as const } })));
}

/**
 * Sync queue operations
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<number> {
  return db.syncQueue.add(item as SyncQueueItem);
}

export async function getPendingSyncQueueItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue.where('status').equals('pending').toArray();
}

export async function updateSyncQueueItem(id: number, updates: Partial<SyncQueueItem>): Promise<void> {
  await db.syncQueue.update(id, updates);
}

export async function markSyncQueueItemAsSynced(id: number): Promise<void> {
  await db.syncQueue.update(id, { status: 'synced' });
}

/**
 * Event operations
 */
export async function saveEvents(events: LocalEvent[]): Promise<void> {
  await db.events.bulkPut(events);
}

export async function getEventById(eventId: number): Promise<LocalEvent | undefined> {
  return db.events.get(eventId);
}

export async function getAllEvents(): Promise<LocalEvent[]> {
  return db.events.toArray();
}

export async function getActiveEvents(): Promise<LocalEvent[]> {
  const now = Date.now();
  return db.events.where('startTime').below(now + 86400000).toArray(); // events within next 24 hours
}

/**
 * Statistics operations
 */
export async function getEventStatistics(eventId: number) {
  const tickets = await getTicketsByEventId(eventId);
  const scans = await getScansByEventId(eventId);
  const usedTickets = tickets.filter(t => t.isUsed);

  return {
    totalTickets: tickets.length,
    scannedTickets: usedTickets.length,
    scanPercentage: tickets.length > 0 ? Math.round((usedTickets.length / tickets.length) * 100) : 0,
    totalScans: scans.length,
    pendingSyncs: scans.filter(s => s.syncStatus === 'pending').length,
  };
}

/**
 * Clear all data (for logout or reset)
 */
export async function clearAllData(): Promise<void> {
  await db.tickets.clear();
  await db.scans.clear();
  await db.syncQueue.clear();
  await db.events.clear();
}
