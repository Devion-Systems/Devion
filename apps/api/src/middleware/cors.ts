import { cors } from "hono/cors";

function configuredOrigins() {
  const origins =
    process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];
  const authOrigin = process.env.BETTER_AUTH_URL;
  return authOrigin ? [...new Set([authOrigin, ...origins])] : origins;
}

export function isTrustedBrowserOrigin(origin: string | undefined) {
  return Boolean(origin && configuredOrigins().includes(origin));
}

/**
 * Pre-configured CORS middleware.
 * Credentialed requests are fail-closed: deployments must explicitly list the
 * dashboard origin in BETTER_AUTH_TRUSTED_ORIGINS.
 */
export const corsMiddleware = (allowedOrigins?: string[]) => {
  const origins = allowedOrigins ?? configuredOrigins();
  return cors({
    origin: (origin) => (origins.includes(origin) ? origin : ""),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-Devion-AI-Key"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86400,
    credentials: true,
  });
};
