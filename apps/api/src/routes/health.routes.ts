import { Hono } from "hono";
import { checkInfrastructureHealth } from "@repo/infrastructure";
import type { AppEnv } from "../types/env.js";

const health = new Hono<AppEnv>();

/**
 * Basic liveness probe — returns 200 if the server is up.
 */
health.get("/", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Detailed health check — queries infrastructure subsystems
 * (DB, blob storage, Docker registry) and returns aggregated status.
 */
health.get("/detailed", async (c) => {
  const logger = c.get("logger");

  try {
    const result = await checkInfrastructureHealth();
    const status = result.status === "ok" ? 200 : result.status === "degraded" ? 207 : 503;

    return c.json(
      {
        status: result.status,
        timestamp: new Date().toISOString(),
        services: result,
      },
      status,
    );
  } catch (err) {
    logger.error({ err }, "Health check failed");
    return c.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        message: "Failed to perform health check",
      },
      503,
    );
  }
});

export { health as healthRoutes };
