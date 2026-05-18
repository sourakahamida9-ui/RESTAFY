import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Events table - stores event information for ticket scanning
 */
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  location: varchar("location", { length: 255 }),
  capacity: int("capacity"),
  totalTickets: int("total_tickets").default(0).notNull(),
  scannedTickets: int("scanned_tickets").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

/**
 * Tickets table - stores individual event tickets
 */
export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("event_id").notNull(),
  ticketNumber: varchar("ticket_number", { length: 100 }).notNull().unique(),
  qrCodeData: varchar("qr_code_data", { length: 500 }).notNull().unique(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }),
  status: mysqlEnum("status", ["pending", "confirmed", "used", "cancelled"]).default("pending").notNull(),
  isUsed: int("is_used").default(0).notNull(), // 0 = false, 1 = true for MySQL compatibility
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;

/**
 * Scan history table - records each ticket scan event
 */
export const scanHistory = mysqlTable("scan_history", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticket_id").notNull(),
  eventId: int("event_id").notNull(),
  scannedBy: int("scanned_by").notNull(), // User ID of the staff member
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
  scanLocation: varchar("scan_location", { length: 255 }),
  deviceType: varchar("device_type", { length: 50 }), // mobile, tablet, desktop
  ipAddress: varchar("ip_address", { length: 45 }),
  offlineSyncStatus: mysqlEnum("offline_sync_status", ["pending", "synced", "conflict"]).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ScanHistory = typeof scanHistory.$inferSelect;
export type InsertScanHistory = typeof scanHistory.$inferInsert;

/**
 * Scan analytics table - aggregated statistics for each event
 */
export const scanAnalytics = mysqlTable("scan_analytics", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("event_id").notNull(),
  scanDate: timestamp("scan_date").notNull(),
  totalScans: int("total_scans").default(0).notNull(),
  validScans: int("valid_scans").default(0).notNull(),
  duplicateScans: int("duplicate_scans").default(0).notNull(),
  invalidScans: int("invalid_scans").default(0).notNull(),
  avgScanTimeMs: int("avg_scan_time_ms").default(0).notNull(),
  peakScanTime: timestamp("peak_scan_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ScanAnalytic = typeof scanAnalytics.$inferSelect;
export type InsertScanAnalytic = typeof scanAnalytics.$inferInsert;

/**
 * Behavioral data table - stores user interaction and contextual data for AI training
 */
export const behavioralData = mysqlTable("behavioral_data", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  eventId: int("event_id"),
  eventType: varchar("event_type", { length: 50 }).notNull(), // scan_attempt, scan_success, error, etc.
  scanTimeMs: int("scan_time_ms"),
  errorType: varchar("error_type", { length: 100 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  timezone: varchar("timezone", { length: 50 }),
  language: varchar("language", { length: 10 }),
  deviceType: varchar("device_type", { length: 50 }),
  userAgent: text("user_agent"),
  metadata: text("metadata"), // JSON string for additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BehavioralData = typeof behavioralData.$inferSelect;
export type InsertBehavioralData = typeof behavioralData.$inferInsert;

/**
 * Offline sync queue table - stores pending syncs for offline operations
 */
export const offlineSyncQueue = mysqlTable("offline_sync_queue", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  eventId: int("event_id").notNull(),
  ticketId: int("ticket_id").notNull(),
  action: varchar("action", { length: 50 }).notNull(), // scan, mark_used, etc.
  payload: text("payload").notNull(), // JSON string
  status: mysqlEnum("status", ["pending", "synced", "failed"]).default("pending").notNull(),
  syncAttempts: int("sync_attempts").default(0).notNull(),
  lastSyncAttempt: timestamp("last_sync_attempt"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type OfflineSyncQueue = typeof offlineSyncQueue.$inferSelect;
export type InsertOfflineSyncQueue = typeof offlineSyncQueue.$inferInsert;