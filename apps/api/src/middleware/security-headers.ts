import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types/env.js";

/**
 * Response hardening for the control-plane API. The API only returns data,
 * never HTML, so a restrictive policy is safe and prevents browser caching of
 * session-scoped or credential-bearing responses.
 */
export const securityHeadersMiddleware = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    await next();

    c.header("Cache-Control", "no-store, max-age=0");
    c.header("Pragma", "no-cache");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
    c.header("Cross-Origin-Opener-Policy", "same-origin");
    c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

    if (process.env.BETTER_AUTH_URL?.startsWith("https://")) {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  });
