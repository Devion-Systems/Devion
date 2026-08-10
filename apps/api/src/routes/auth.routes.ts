import { Hono } from "hono";
import { auth } from "@repo/auth/config";
import type { AppEnv } from "../types/env.js";

const authRouter = new Hono<AppEnv>();

/**
 * Mount better-auth handler as a catch-all.
 * All /api/auth/* requests are delegated to better-auth.
 */
authRouter.all("/*", (c) => {
  return auth.handler(c.req.raw);
});

export { authRouter as authRoutes };
