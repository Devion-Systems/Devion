import { Hono } from "hono";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

const routes = new Hono<AppEnv>();

routes.use("/*", requireAuthenticatedUser);

/**
 * Managed databases remain unavailable until their project ownership, agent
 * provisioning commands, and encrypted one-time secret delivery are defined.
 * Keeping this route small is intentional: the control-plane API must not
 * retain a Docker-capable fallback implementation.
 */
routes.all("/*", (c) =>
  c.json(
    {
      error:
        "Managed databases are unavailable until the agent provisioning and secret-delivery protocol is implemented",
      code: "MANAGED_DATABASE_RUNTIME_UNAVAILABLE",
    },
    501,
  ),
);

export { routes as managedDatabaseRoutes };
