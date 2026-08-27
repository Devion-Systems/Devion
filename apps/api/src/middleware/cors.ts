import { cors } from "hono/cors";

function configuredOrigins() {
  const rawOrigins = [
    process.env.BETTER_AUTH_URL,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []),
  ].filter((origin): origin is string => Boolean(origin?.trim()));
  return [...new Set(rawOrigins.flatMap((origin) => {
    try {
      return [new URL(origin.trim()).origin];
    } catch {
      // An invalid origin must never accidentally become trusted.
      return [];
    }
  }))];
}

export function isTrustedBrowserOrigin(origin: string | undefined) {
  if (!origin) return false;
  try {
    return configuredOrigins().includes(new URL(origin).origin);
  } catch {
    return false;
  }
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
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "X-Request-Id",
      "X-Devion-AI-Key",
    ],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86400,
    credentials: true,
  });
};
