import { checkDbHealth } from "@repo/db";
import { dockerRegistry } from "@repo/registry";
import { blobStorage } from "@repo/s3";
import { Hono } from "hono";
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
    const [database, registry] = await Promise.all([checkDbHealth(), dockerRegistry.ping()]);

    let storage: "ok" | "error" = "ok";
    try {
      await blobStorage.ensureBucketExists("devion-health-check");
    } catch {
      storage = "error";
    }

    const status = database.status === "ok" && registry && storage === "ok" ? "ok" : "degraded";
    const httpStatus = status === "ok" ? 200 : 207;

    return c.json(
      {
        status,
        timestamp: new Date().toISOString(),
        services: {
          database,
          storage,
          registry: registry ? "ok" : "error",
        },
      },
      httpStatus,
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
