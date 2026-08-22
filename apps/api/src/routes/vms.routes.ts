import { Hono } from "hono";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

/**
 * MicroVMs are deliberately unavailable until their node-agent protocol,
 * networking and volume contracts are implemented. The API must never spawn
 * Firecracker processes or configure host networking itself.
 */
const vms = new Hono<AppEnv>();
vms.use("/*", requireAuthenticatedUser);
vms.all("/*", (c) =>
  c.json(
    {
      error:
        "MicroVM workloads are not available until the Firecracker node-agent runtime is implemented",
      code: "MICROVM_RUNTIME_UNAVAILABLE",
    },
    501,
  ),
);

export { vms as vmRoutes };
