import { AppError, ErrorCode } from "@repo/core";
import { vmManager } from "../features/firecracker/index.js";
import { Hono } from "hono";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

const vms = new Hono<AppEnv>();

vms.use("/*", requireAuthenticatedUser);

/**
 * GET / — List all managed VMs.
 */
vms.get("/", async (c) => {
  const logger = c.get("logger");
  logger.info("Listing VMs");

  // TODO: implement pagination
  const instances = await vmManager.listVms();
  return c.json({ vms: instances });
});

/**
 * POST / — Create a new Firecracker microVM.
 */
vms.post("/", async (c) => {
  const logger = c.get("logger");
  const body = await c.req.json();

  logger.info({ config: body }, "Creating VM");

  // TODO: validate body with Zod schema
  const vm = await vmManager.createVm(body);
  return c.json({ vm }, 201);
});

/**
 * GET /:id — Get details of a specific VM.
 */
vms.get("/:id", async (c) => {
  const id = c.req.param("id");
  const vm = await vmManager.getVm(id);

  if (!vm) {
    throw new AppError(`VM '${id}' not found`, ErrorCode.NOT_FOUND, 404);
  }

  return c.json({ vm });
});

/**
 * DELETE /:id — Destroy a VM.
 */
vms.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const logger = c.get("logger");

  logger.info({ vmId: id }, "Deleting VM");

  await vmManager.deleteVm(id);
  return c.json({ message: `VM '${id}' deleted` });
});

export { vms as vmRoutes };
