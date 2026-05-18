import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser,
  InsertBehavioralData,
  users,
  events,
  tickets,
  scanHistory,
  scanAnalytics,
  behavioralData,
  offlineSyncQueue,
  type Event,
  type Ticket,
  type ScanHistory,
  type ScanAnalytic,
  type BehavioralData,
  type OfflineSyncQueue,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Event operations
 */
export async function getActiveEvents(): Promise<Event[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  return db.select()
    .from(events)
    .where(sql`${events.startTime} > DATE_SUB(NOW(), INTERVAL 24 HOUR)`)
    .orderBy(desc(events.startTime))
    .limit(50);
}

export async function getEventById(eventId: number): Promise<Event | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Ticket operations
 */
export async function getTicketsByEventId(eventId: number): Promise<Ticket[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(tickets)
    .where(and(
      eq(tickets.eventId, eventId),
      eq(tickets.status, 'confirmed')
    ))
    .limit(10000); // Limit for offline sync
}

export async function getTicketByQRCode(qrCodeData: string): Promise<Ticket | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(tickets)
    .where(eq(tickets.qrCodeData, qrCodeData))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Atomic ticket validation and marking as used
 * Returns success/failure status and ticket info
 */
export async function validateAndMarkTicketAsUsed(
  ticketId: number,
  qrCodeData: string
): Promise<{
  success: boolean;
  ticket?: Ticket;
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'Database not available' };
  }

  try {
    // Get ticket with current state
    const ticket = await db.select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (ticket.length === 0) {
      return { success: false, error: 'Ticket not found' };
    }

    const currentTicket = ticket[0];

    // Check if already used
    if (currentTicket.isUsed) {
      return { 
        success: false, 
        error: 'Ticket already used',
        ticket: currentTicket 
      };
    }

    // Check status
    if (currentTicket.status !== 'confirmed') {
      return { 
        success: false, 
        error: `Ticket status is ${currentTicket.status}, not confirmed`,
        ticket: currentTicket 
      };
    }

    // Atomic update: mark as used with double-check
    await db.update(tickets)
      .set({ 
        isUsed: 1, 
        status: 'used',
        usedAt: new Date() 
      })
      .where(and(
        eq(tickets.id, ticketId),
        eq(tickets.isUsed, 0) // Double-check: only if not already used
      ));

    // Verify the update was successful
    const verifyTicket = await db.select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!verifyTicket[0] || !verifyTicket[0].isUsed) {
      // Double-check failed, ticket might have been used by another process
      const recheckTicket = await db.select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      
      return { 
        success: false, 
        error: 'Ticket was already marked as used (race condition)',
        ticket: recheckTicket[0] || currentTicket 
      };
    }

    // Return updated ticket
    const updatedTicket = await db.select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    return { 
      success: true, 
      ticket: updatedTicket[0] 
    };
  } catch (error) {
    console.error('[Database] Error validating ticket:', error);
    return { 
      success: false, 
      error: 'Database error during validation' 
    };
  }
}

/**
 * Scan history operations
 */
export async function recordScan(
  ticketId: number,
  eventId: number,
  scannedBy: number,
  deviceType?: string,
  ipAddress?: string,
  scanLocation?: string
): Promise<ScanHistory | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.insert(scanHistory).values({
      ticketId,
      eventId,
      scannedBy,
      deviceType: deviceType || undefined,
      ipAddress: ipAddress || undefined,
      scanLocation: scanLocation || undefined,
      offlineSyncStatus: 'synced',
    });

    // Return the created scan record
    return {
      id: 0, // Will be auto-generated
      ticketId,
      eventId,
      scannedBy,
      scannedAt: new Date(),
      scanLocation: scanLocation || null,
      deviceType: deviceType || null,
      ipAddress: ipAddress || null,
      offlineSyncStatus: 'synced',
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('[Database] Error recording scan:', error);
    return null;
  }
}

export async function getScanHistory(eventId: number, limit: number = 100): Promise<ScanHistory[]> {
  const db = await getDb();
  if (!db) return [];

  return (await db.select()
    .from(scanHistory)
    .where(eq(scanHistory.eventId, eventId))
    .orderBy(desc(scanHistory.scannedAt))
    .limit(limit)) as ScanHistory[];
}

/**
 * Analytics operations
 */
export async function recordBehavioralData(
  userId: number,
  eventType: string,
  data: Partial<BehavioralData>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(behavioralData).values({
      userId,
      eventType,
      ...data,
    } as InsertBehavioralData);
  } catch (error) {
    console.error('[Database] Error recording behavioral data:', error);
  }
}

/**
 * Offline sync queue operations
 */
export async function addToSyncQueue(
  userId: number,
  eventId: number,
  ticketId: number,
  action: string,
  payload: Record<string, any>
): Promise<OfflineSyncQueue | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.insert(offlineSyncQueue).values({
      userId,
      eventId,
      ticketId,
      action,
      payload: JSON.stringify(payload),
      status: 'pending',
    });

    return {
      id: 0, // Will be auto-generated
      userId,
      eventId,
      ticketId,
      action,
      payload: JSON.stringify(payload),
      status: 'pending',
      syncAttempts: 0,
      lastSyncAttempt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error('[Database] Error adding to sync queue:', error);
    return null;
  }
}

export async function getPendingSyncQueueItems(limit: number = 100): Promise<OfflineSyncQueue[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(offlineSyncQueue)
    .where(eq(offlineSyncQueue.status, 'pending'))
    .orderBy(offlineSyncQueue.createdAt)
    .limit(limit);
}

export async function markSyncQueueItemAsSynced(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(offlineSyncQueue)
    .set({ status: 'synced' })
    .where(eq(offlineSyncQueue.id, id));
}

/**
 * Update event statistics
 */
export async function updateEventStatistics(eventId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // Count scanned tickets
    const scannedResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .where(and(
        eq(tickets.eventId, eventId),
        eq(tickets.isUsed, 1)
      ));

    const scannedCount = scannedResult[0]?.count || 0;

    // Update event
    await db.update(events)
      .set({ scannedTickets: scannedCount })
      .where(eq(events.id, eventId));
  } catch (error) {
    console.error('[Database] Error updating event statistics:', error);
  }
}
