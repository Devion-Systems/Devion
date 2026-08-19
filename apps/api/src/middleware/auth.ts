import type { MiddlewareHandler } from "hono";
import { auth } from "../features/auth/config.js";
import type { AppEnv } from "../types/env.js";

/** Validates sessions against Better Auth's server-side session store. */
export const requireAuthenticatedUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Authentication required" }, 401);
  }

  await next();
};

/** Restricts platform-level controls to Better Auth admin-plugin users. */
export const requirePlatformAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    return c.json({ error: "Platform administrator role required" }, 403);
  }

  await next();
};
