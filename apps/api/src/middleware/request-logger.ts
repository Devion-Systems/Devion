import { createMiddleware } from "hono/factory";
import { createLogger, childLogger } from "@repo/core";
import type { AppEnv } from "../types/env.js";

const baseLogger = createLogger("api");

/**
 * Attaches a child logger (scoped to the current requestId) to context
 * and logs request method, path, status, and duration.
 */
export const requestLoggerMiddleware = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const requestId = c.get("requestId");
    const logger = childLogger(baseLogger, { requestId });
    c.set("logger", logger);

    const start = performance.now();
    const method = c.req.method;
    const path = c.req.path;

    logger.info({ method, path }, "Incoming request");

    await next();

    const duration = Math.round(performance.now() - start);
    const status = c.res.status;

    logger.info({ method, path, status, durationMs: duration }, "Request completed");
  });
