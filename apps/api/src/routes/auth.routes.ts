import { Hono } from "hono";
import { auth } from "../features/auth/config.js";
import { getInstallation } from "../features/setup/service.js";
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
authRouter.all("/*", async (c) => {
  if (c.req.method === "POST" && c.req.path.endsWith("/sign-up/email")) {
    const installation = await getInstallation();
    if (installation) {
      return c.json(
        {
          error:
            "Public registration is disabled. Ask your company administrator for an invitation.",
        },
        403,
      );
    }
    return c.json(
      { error: "Use the protected first-installation wizard to create the administrator." },
      403,
    );
  }
  return auth.handler(c.req.raw);
});

export { authRouter as authRoutes };
