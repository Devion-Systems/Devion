import { Hono } from "hono";
import { auth } from "../features/auth/config.js";
import type { AppEnv } from "../types/env.js";

const authRouter = new Hono<AppEnv>();

authRouter.get("/me", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ session: null, user: null }, 401);
  }
  return c.json(session);
});

/**
 * Mount better-auth handler as a catch-all.
 * All /api/auth/* requests are delegated to better-auth.
 */
authRouter.all("/*", (c) => {
  return auth.handler(c.req.raw);
});

export { authRouter as authRoutes };
