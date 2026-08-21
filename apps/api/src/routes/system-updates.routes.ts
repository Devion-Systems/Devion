import { Hono } from "hono";
import { z } from "zod";
import { SystemUpdater } from "../lib/system-updater.js";
import { requirePlatformAdmin } from "../middleware/auth.js";
import { isTrustedBrowserOrigin } from "../middleware/cors.js";
import type { AppEnv } from "../types/env.js";

const updates = new Hono<AppEnv>();
const updater = new SystemUpdater();
const payload = z.object({ ref: z.string().regex(/^[A-Za-z0-9._/-]{1,128}$/) });

updates.use("/*", requirePlatformAdmin);
updates.get("/status", async (c) => {
  try { return c.json({ status: await updater.status(), refs: await updater.refs() }); }
  catch (error) {
    c.get("logger").error({ error }, "System updater status unavailable");
    return c.json({ error: error instanceof Error ? `Update service: ${error.message}` : "System updater is unavailable" }, 503);
  }
});
updates.post("/run", async (c) => {
  if (!isTrustedBrowserOrigin(c.req.header("origin"))) return c.json({ error: "A trusted browser origin is required" }, 403);
  const parsed = payload.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "A valid branch or version is required" }, 400);
  try { return c.json(await updater.start(parsed.data.ref), 202); }
  catch (error) { c.get("logger").error({ error }, "System update could not be started"); return c.json({ error: error instanceof Error ? error.message : "System update could not be started" }, 503); }
});

export { updates as systemUpdateRoutes };
