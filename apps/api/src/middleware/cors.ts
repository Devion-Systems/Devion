import { cors } from "hono/cors";

/**
 * Pre-configured CORS middleware.
 * Allows all origins in development; restrict in production via env config.
 */
export const corsMiddleware = (allowedOrigins?: string[]) =>
  cors({
    origin: allowedOrigins ?? "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86400,
    credentials: true,
  });
