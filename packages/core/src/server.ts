import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger } from "hono/logger";
import { getSystemStats } from "./system.js";
import { firewallMiddleware, syncBlacklistFromDb } from "./firewall.js";

// 1. Beim Server-Boot die Blacklist einmalig laden
await syncBlacklistFromDb();

const app = new Hono();

// --- STANDARD MIDDLEWARES ---

// Protokolliert alle Requests in der Konsole
app.use("*", logger());

// Fügt wichtige Security-Header hinzu (Schutz vor Clickjacking, XSS, etc.)
app.use("*", secureHeaders());

// CORS-Konfiguration: Erlaubt deinem Frontend den Zugriff
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173"], 
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length", "Retry-After"],
    maxAge: 600, // Preflight-Caching für 10 Minuten
    credentials: true,
  })
);

// --- FIREWALL MIDDLEWARE ---
// Schützt ab hier alle API-Routen vor unbefugtem Zugriff und Spam
app.use("/api/*", firewallMiddleware());

// --- ROUTEN ---

app.get("/api/stats", async (c) => {
  const stats = await getSystemStats();
  return c.json(stats);
});

// Fallback für nicht existierende Routen
app.notFound((c) => c.json({ error: "Not Found" }, 404));

// Fehler-Handler
app.onError((err, c) => {
  console.error(`[Server Error]:`, err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Export für Bun zum Starten des Servers
export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};