import { createMiddleware } from "hono/factory";
import { isTrustedBrowserOrigin } from "./cors.js";
import type { AppEnv } from "../types/env.js";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Cookies authenticate the dashboard. Browser mutations therefore need to
 * originate from a configured dashboard origin. Non-browser automation can
 * still use a session or future service token without an Origin header.
 */
export const csrfOriginMiddleware = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!unsafeMethods.has(c.req.method)) return next();
    const origin = c.req.header("origin");
    if (origin && !isTrustedBrowserOrigin(origin)) {
      return c.json({ error: "Untrusted browser origin" }, 403);
    }
    await next();
  });
