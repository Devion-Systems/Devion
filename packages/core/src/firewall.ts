import type { MiddlewareHandler } from "hono";
import { getConnInfo } from "hono/bun"; 
import { ipBlacklist } from "./db/schema.js";
import { db } from "./db/db.js";

// --- KONFIGURATION ---
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 30;

const cachedBlacklist = new Set<string>();
const requestTracker = new Map<string, { count: number; windowStart: number }>();

// Synchronisiert den RAM-Cache mit der DB (Prepared Statement -> Sicher vor SQL-I)
export async function syncBlacklistFromDb(): Promise<void> {
  try {
    const records = await db.select({ ip: ipBlacklist.ip }).from(ipBlacklist);
    cachedBlacklist.clear();
    for (const record of records) {
      cachedBlacklist.add(record.ip);
    }
    console.log(`[Firewall] ${cachedBlacklist.size} blockierte IPs aus DB geladen.`);
  } catch (error) {
    console.error("[Firewall] Fehler beim Laden der Blacklist:", error);
  }
}

// Alle 5 Minuten im Hintergrund updaten
setInterval(syncBlacklistFromDb, 5 * 60 * 1000);

// IP blockieren (Parametrisiert durch Drizzle -> Sicher vor SQL-I)
export async function blacklistIp(ip: string, reason?: string): Promise<void> {
  try {
    await db.insert(ipBlacklist).values({ ip, reason }).onConflictDoNothing();
    cachedBlacklist.add(ip);
    console.log(`[Firewall] IP blockiert: ${ip} | Grund: ${reason || "Keine Angabe"}`);
  } catch (error) {
    console.error(`[Firewall] Fehler beim Speichern der IP (${ip}):`, error);
  }
}

/**
 * Hono Middleware: Schützt alle nachfolgenden Routen
 */
export const firewallMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    // 1. IP des Clients auslesen (sicher verpackt über Bun)
    const info = getConnInfo(c);
    const ip = info.remote.address || "unknown";

    // 2. Blacklist-Abfrage (In-Memory Cache)
    if (cachedBlacklist.has(ip)) {
      return c.json({ error: "Access Denied. Your IP is blacklisted." }, 403);
    }

    // 3. Rate-Limiting
    const now = Date.now();
    const clientData = requestTracker.get(ip);

    if (!clientData || now - clientData.windowStart > RATE_LIMIT_WINDOW_MS) {
      requestTracker.set(ip, { count: 1, windowStart: now });
    } else {
      clientData.count++;
      
      if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
        const retryAfter = Math.ceil((clientData.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
        
        // Automatischer Bann bei massivem Missbrauch (z.B. dreifaches Limit)
        if (clientData.count > MAX_REQUESTS_PER_WINDOW * 3) {
          await blacklistIp(ip, "Automatischer Block: Extremes API-Spamming");
        }

        c.header("Retry-After", String(retryAfter));
        return c.json({ error: "Too many requests. Slow down." }, 429);
      }
    }

    await next();
  };
};