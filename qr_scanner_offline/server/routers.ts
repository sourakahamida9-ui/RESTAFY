import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { tokenRouter } from "./routers/token";
import {
  getActiveEvents,
  getEventById,
  getTicketsByEventId,
  getTicketByQRCode,
  validateAndMarkTicketAsUsed,
  recordScan,
  getScanHistory,
  recordBehavioralData,
  addToSyncQueue,
  getPendingSyncQueueItems,
  markSyncQueueItemAsSynced,
  updateEventStatistics,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts: any) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }: any) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  /**
   * Events router - manage event data for scanning
   */
  events: router({
    /**
     * Get active events for the scanner
     */
    list: protectedProcedure.query(async () => {
      const events = await getActiveEvents();
      return events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        capacity: event.capacity,
        totalTickets: event.totalTickets,
        scannedTickets: event.scannedTickets,
      }));
    }),

    /**
     * Get event details with tickets for offline sync
     */
    getWithTickets: protectedProcedure
      .input(z.object({ eventId: z.number() }))
      .query(async ({ input }: any) => {
        const event = await getEventById(input.eventId);
        if (!event) {
          throw new Error('Event not found');
        }

        const tickets = await getTicketsByEventId(input.eventId);

        return {
          event: {
            id: event.id,
            title: event.title,
            description: event.description,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
            totalTickets: event.totalTickets,
            scannedTickets: event.scannedTickets,
          },
          tickets: tickets.map(ticket => ({
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            qrCodeData: ticket.qrCodeData,
            customerName: ticket.customerName,
            customerEmail: ticket.customerEmail,
            status: ticket.status,
            isUsed: Boolean(ticket.isUsed),
          })),
        };
      }),
  }),

  /**
   * Tickets router - validate and manage tickets
   */
  tickets: router({
    /**
     * Validate QR code and mark ticket as used (atomic operation)
     */
    validateQR: protectedProcedure
      .input(z.object({
        qrCodeData: z.string(),
        eventId: z.number(),
        scanLocation: z.string().optional(),
        deviceType: z.string().optional(),
        timezone: z.string().optional(),
        language: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }: any) => {
        const startTime = Date.now();

        try {
          // Get ticket by QR code
          const ticket = await getTicketByQRCode(input.qrCodeData);
          if (!ticket) {
            // Record failed scan
            await recordBehavioralData(ctx.user!.id, 'scan_failed_not_found', {
              eventId: input.eventId,
              scanTimeMs: Date.now() - startTime,
              errorType: 'ticket_not_found',
              deviceType: input.deviceType,
            });

            return {
              success: false,
              status: 'invalid',
              message: 'Ticket not found',
            };
          }

          // Validate and mark as used (atomic)
          const result = await validateAndMarkTicketAsUsed(ticket.id, input.qrCodeData);

          if (!result.success) {
            // Record failed scan
            await recordBehavioralData(ctx.user!.id, 'scan_failed_validation', {
              eventId: input.eventId,
              scanTimeMs: Date.now() - startTime,
              errorType: result.error,
              deviceType: input.deviceType,
            });

            if (result.error?.includes('already used')) {
              return {
                success: false,
                status: 'duplicate',
                message: 'Ticket already used',
                ticket: result.ticket ? {
                  ticketNumber: result.ticket.ticketNumber,
                  customerName: result.ticket.customerName,
                } : undefined,
              };
            }

            return {
              success: false,
              status: 'invalid',
              message: result.error || 'Validation failed',
            };
          }

          // Record successful scan
          await recordScan(
            ticket.id,
            input.eventId,
            ctx.user!.id,
            input.deviceType,
            ctx.req.ip,
            input.scanLocation
          );

          // Record behavioral data
          await recordBehavioralData(ctx.user!.id, 'scan_success', {
            eventId: input.eventId,
            scanTimeMs: Date.now() - startTime,
            deviceType: input.deviceType,
            timezone: input.timezone,
            language: input.language,
            ipAddress: ctx.req.ip,
          });

          // Update event statistics
          await updateEventStatistics(input.eventId);

          return {
            success: true,
            status: 'success',
            message: 'Ticket validated successfully',
            ticket: {
              ticketNumber: result.ticket!.ticketNumber,
              customerName: result.ticket!.customerName,
              customerEmail: result.ticket!.customerEmail,
            },
          };
        } catch (error) {
          console.error('Error validating QR code:', error);
          return {
            success: false,
            status: 'error',
            message: 'Server error during validation',
          };
        }
      }),
  }),

  /**
   * Scan router - manage scan history and sync
   */
  token: tokenRouter,
  scan: router({
    /**
     * Get scan history for an event
     */
    getHistory: protectedProcedure
      .input(z.object({ eventId: z.number(), limit: z.number().default(100) }))
      .query(async ({ input }: any) => {
        const history = await getScanHistory(input.eventId, input.limit);
        return history.map(scan => ({
          id: scan.id,
          ticketId: scan.ticketId,
          scannedAt: scan.scannedAt,
          scanLocation: scan.scanLocation,
          deviceType: scan.deviceType,
        }));
      }),

    /**
     * Sync offline scans from client
     */
    syncOfflineScans: protectedProcedure
      .input(z.object({
        eventId: z.number(),
        scans: z.array(z.object({
          qrCodeData: z.string(),
          scannedAt: z.number(),
          scanTimeMs: z.number(),
          deviceType: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }: any) => {
        const syncResults = [];

        for (const scan of input.scans) {
          try {
            // Get ticket
            const ticket = await getTicketByQRCode(scan.qrCodeData);
            if (!ticket) {
              syncResults.push({
                qrCodeData: scan.qrCodeData,
                success: false,
                error: 'Ticket not found',
              });
              continue;
            }

            // Validate and mark as used
            const result = await validateAndMarkTicketAsUsed(ticket.id, scan.qrCodeData);
            if (!result.success) {
              syncResults.push({
                qrCodeData: scan.qrCodeData,
                success: false,
                error: result.error,
              });
              continue;
            }

            // Record scan
            await recordScan(
              ticket.id,
              input.eventId,
              ctx.user!.id,
              scan.deviceType
            );

            syncResults.push({
              qrCodeData: scan.qrCodeData,
              success: true,
            });
          } catch (error) {
            syncResults.push({
              qrCodeData: scan.qrCodeData,
              success: false,
              error: 'Sync error',
            });
          }
        }

        // Update event statistics
        await updateEventStatistics(input.eventId);

        return {
          synced: syncResults.filter(r => r.success).length,
          failed: syncResults.filter(r => !r.success).length,
          results: syncResults,
        };
      }),

    /**
     * Record behavioral data for AI training
     */
    recordBehavior: protectedProcedure
      .input(z.object({
        eventId: z.number(),
        eventType: z.string(),
        scanTimeMs: z.number().optional(),
        errorType: z.string().optional(),
        deviceType: z.string().optional(),
        timezone: z.string().optional(),
        language: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }: any) => {
        await recordBehavioralData(ctx.user!.id, input.eventType, {
          eventId: input.eventId,
          scanTimeMs: input.scanTimeMs,
          errorType: input.errorType,
          deviceType: input.deviceType,
          timezone: input.timezone,
          language: input.language,
          ipAddress: ctx.req.ip,
        });

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
