import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { validateToken, createTemporaryToken } from "../../shared/token";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import * as db from "../db";
import { eq } from "drizzle-orm";
import { tickets } from "../../drizzle/schema";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.post("/api/auth/agent/login", async (req, res) => {
    const { email, password, restaurantName } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const expectedPassword = process.env.AGENT_PASSWORD || "restafy";
    if (password !== expectedPassword) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const openId = `local-agent:${normalizedEmail}`;
      const name = normalizedEmail.split("@")[0] || "Agent";

      await db.upsertUser({
        openId,
        email: normalizedEmail,
        name,
        role: "user",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });
      const apiToken = await createTemporaryToken(["scan:qr", "read:events"], 24 * 60 * 60);
      const cookieOptions = getSessionCookieOptions(req);

      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return res.json({
        agent: {
          id: openId,
          email: normalizedEmail,
          name,
          permissions: ["scan:qr", "read:events"],
        },
        restaurant: {
          id: "restafy-local",
          name: restaurantName || "Restaurant Restafy",
          logo: null,
        },
        token: apiToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      console.error("[Auth] Agent login failed", error);
      return res.status(500).json({ error: "Erreur de connexion" });
    }
  });

  app.post("/api/auth/agent/validate-token", async (req, res) => {
    const { token } = req.body ?? {};
    if (typeof token !== "string") {
      return res.status(400).json({ error: "Token is required" });
    }

    try {
      const tokenResult = await validateToken(token);
      if (!tokenResult.valid || !tokenResult.payload) {
        return res.status(401).json({ error: tokenResult.error || "Token invalide" });
      }

      const payload = tokenResult.payload;
      const openId = `token-agent:${payload.tokenId}`;
      const name = payload.eventName ? `Agent ${payload.eventName}` : "Agent Restafy";

      await db.upsertUser({
        openId,
        name,
        email: null,
        role: "user",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);

      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return res.json({
        agent: {
          id: openId,
          email: "agent@restafy.local",
          name,
          permissions: payload.permissions || [],
        },
        restaurant: {
          id: payload.eventId ? `event-${payload.eventId}` : "restafy-local",
          name: payload.eventName || "Événement Restafy",
          logo: null,
        },
        event: {
          id: payload.eventId ?? null,
          name: payload.eventName ?? null,
        },
        token,
        expiresAt: new Date(payload.expiresAt * 1000).toISOString(),
      });
    } catch (error) {
      console.error("[Auth] Token validation failed", error);
      return res.status(500).json({ error: "Erreur de validation du token" });
    }
  });

  app.post("/api/token/validate", async (req, res) => {
    const { token } = req.body ?? {};
    if (typeof token !== "string") {
      return res.status(400).json({ error: "Token is required" });
    }

    const validation = await validateToken(token);
    return res.status(validation.valid ? 200 : 401).json(validation);
  });

  app.get("/api/tickets/event", async (req, res) => {
    let payloadEventId: number | null = null;
    const authHeader = req.headers.authorization;

    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const validation = await validateToken(token);
      if (!validation.valid || !validation.payload) {
        return res.status(401).json({ error: validation.error || "Token invalide" });
      }

      if (validation.payload.eventId) {
        payloadEventId = Number(validation.payload.eventId);
      }
    } else {
      try {
        await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    // Try local DB first, then fallback to main API
    let ticketsPayload: any[] = [];

    try {
      const dbInstance = await db.getDb();
      if (dbInstance && payloadEventId) {
        const records = await db.getTicketsByEventId(payloadEventId);
        ticketsPayload = records.map(ticket => ({
          id: ticket.id,
          code: ticket.qrCodeData,
          eventId: ticket.eventId,
          customerName: ticket.customerName,
          customerEmail: ticket.customerEmail ?? "",
          ticketType: "standard",
          status: ticket.isUsed ? "used" : "valid",
          validatedAt: ticket.usedAt ?? null,
          validatedBy: null,
          synced: true,
        }));
      } else if (dbInstance) {
        const records = await dbInstance
          .select()
          .from(tickets)
          .where(eq(tickets.status, "confirmed"));

        ticketsPayload = records.map(ticket => ({
          id: ticket.id,
          code: ticket.qrCodeData,
          eventId: ticket.eventId,
          customerName: ticket.customerName,
          customerEmail: ticket.customerEmail ?? "",
          ticketType: "standard",
          status: ticket.isUsed ? "used" : "valid",
          validatedAt: ticket.usedAt ?? null,
          validatedBy: null,
          synced: true,
        }));
      }
    } catch (localError) {
      console.warn("[Tickets] Local DB unavailable, trying main API:", localError);
    }

    // If no tickets from local DB, try main RESTAFY API
    if (ticketsPayload.length === 0) {
      try {
        const apiUrl = process.env.RESTAFY_API_URL || "https://app.restafy.shop";
        const response = await fetch(`${apiUrl}/api/tickets/sync?eventId=${payloadEventId}`, {
          headers: {
            "Authorization": `Bearer ${process.env.SCANNER_API_KEY || ''}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.tickets) {
            ticketsPayload = data.tickets;
          }
        }
      } catch (apiError) {
        console.warn("[Tickets] Main API unavailable:", apiError);
      }
    }

    return res.json({ tickets: ticketsPayload });
  });

  // Validate ticket via QR code
  app.post("/api/tickets/validate", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const validation = await validateToken(token);
      if (!validation.valid || !validation.payload) {
        return res.status(401).json({ error: validation.error || "Token invalide" });
      }
    }

    const { qr_code_data, code } = req.body ?? {};
    const qrCode = qr_code_data || code;

    if (!qrCode) {
      return res.status(400).json({ error: "QR code requis" });
    }

    // Try local DB first
    let result: any = null;
    try {
      const dbInstance = await db.getDb();
      if (dbInstance) {
        const ticket = await db.getTicketByQRCode(qrCode);
        if (ticket) {
          const validation = await db.validateAndMarkTicketAsUsed(ticket.id, qrCode);
          result = validation;
        }
      }
    } catch (localError) {
      console.warn("[Validate] Local DB error:", localError);
    }

    // Fallback to main API
    if (!result?.success) {
      try {
        const apiUrl = process.env.RESTAFY_API_URL || "https://app.restafy.shop";
        const response = await fetch(`${apiUrl}/api/tickets/validate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.SCANNER_API_KEY || ''}`,
          },
          body: JSON.stringify({ qr_code_data: qrCode }),
        });
        if (response.ok) {
          result = await response.json();
        }
      } catch (apiError) {
        console.warn("[Validate] Main API error:", apiError);
      }
    }

    if (!result) {
      return res.status(500).json({ success: false, status: "error", message: "Service indisponible" });
    }

    return res.json(result);
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
