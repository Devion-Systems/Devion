import { createLogger, notFoundHandler, parseEnv, registerProcessGuards } from "@repo/core";
import { checkDbHealth, closeDbPool } from "@repo/db";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { syncFeaturesToDatabase } from "./features/feature/sync_features.js";
import { startDeploymentController, stopDeploymentController } from "./modules/deployments/controller.js";
import {
  corsMiddleware,
  globalErrorHandler,
  requestIdMiddleware,
  requestLoggerMiddleware,
  securityHeadersMiddleware,
} from "./middleware/index.js";
import { routes } from "./routes/index.js";
import type { AppEnv } from "./types/env.js";

// --- Bootstrap ---
const env = parseEnv();
const logger = createLogger(env, { name: "api" });

const app = new Hono<AppEnv>();

// --- Global middleware (order matters) ---
app.use("*", corsMiddleware());
app.use("*", bodyLimit({ maxSize: 10 * 1024 * 1024 }));
app.use("*", requestIdMiddleware());
app.use("*", requestLoggerMiddleware());
app.use("*", securityHeadersMiddleware());

// --- Global error handling ---
app.onError(globalErrorHandler);
app.notFound(notFoundHandler);

// --- Mount all routes ---
app.route("/", routes);

// --- Process guards (uncaught exceptions, unhandled rejections) ---
registerProcessGuards({ logger });

// --- Startup ---
const port = env.API_PORT ?? 3000;

const startServer = async () => {
  try {
    await syncFeaturesToDatabase();
    logger.info("System feature flags synchronized");
  } catch (err) {
    logger.warn({ err }, "Feature flag synchronization failed on startup");
  }

  // DB health check on startup
  try {
    const dbHealth = await checkDbHealth();
    logger.info(
      { status: dbHealth.status, latencyMs: dbHealth.latencyMs },
      "Database connection verified",
    );
  } catch (err) {
    logger.warn({ err }, "Database health check failed on startup — continuing anyway");
  }

  logger.info({ port }, `Devion API server starting on port ${port}`);
  startDeploymentController(logger);
};

startServer();

// --- Graceful shutdown ---
const shutdown = async () => {
  logger.info("Shutting down gracefully...");
  stopDeploymentController();
  await closeDbPool();
  logger.info("Database pool closed");
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default {
  port,
  fetch: app.fetch,
};
