import { Hono } from "hono";
import { parseEnv, createLogger, registerProcessGuards, notFoundHandler } from "@repo/core";
import { checkDbHealth, closeDbPool } from "@repo/infrastructure";

import type { AppEnv } from "./types/env.js";
import {
  requestIdMiddleware,
  requestLoggerMiddleware,
  corsMiddleware,
  globalErrorHandler,
} from "./middleware/index.js";
import { routes } from "./routes/index.js";

// --- Bootstrap ---
const env = parseEnv();
const logger = createLogger("api");

const app = new Hono<AppEnv>();

// --- Global middleware (order matters) ---
app.use("*", corsMiddleware());
app.use("*", requestIdMiddleware());
app.use("*", requestLoggerMiddleware());

// --- Global error handling ---
app.onError(globalErrorHandler);
app.notFound(notFoundHandler);

// --- Mount all routes ---
app.route("/", routes);

// --- Process guards (uncaught exceptions, unhandled rejections) ---
registerProcessGuards();

// --- Startup ---
const port = env.API_PORT ?? 3000;

const startServer = async () => {
  // DB health check on startup
  try {
    const dbHealth = await checkDbHealth();
    logger.info({ status: dbHealth.status, latencyMs: dbHealth.latencyMs }, "Database connection verified");
  } catch (err) {
    logger.warn({ err }, "Database health check failed on startup — continuing anyway");
  }

  logger.info({ port }, `Devion API server starting on port ${port}`);
};

startServer();

// --- Graceful shutdown ---
const shutdown = async () => {
  logger.info("Shutting down gracefully...");
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