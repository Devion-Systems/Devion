import { AppError, ErrorCode } from "@repo/core";
import { Hono } from "hono";
import { isFeatureEnabled, setFeatureStatus } from "../features/feature/index.js";
import { requirePlatformAdmin } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

const features = new Hono<AppEnv>();

features.use("/*", requirePlatformAdmin);

/**
 * GET /:name — Check if a specific feature flag is enabled.
 */
features.get("/:name", async (c) => {
  const name = c.req.param("name");
  const enabled = await isFeatureEnabled(name);

  return c.json({ feature: name, enabled });
});

/**
 * PUT /:name — Toggle a feature flag on or off.
 * TODO: Add admin auth guard.
 */
features.put("/:name", async (c) => {
  const name = c.req.param("name");
  const body = await c.req.json<{ enabled: boolean }>();

  if (typeof body.enabled !== "boolean") {
    throw new AppError("Field 'enabled' must be a boolean", ErrorCode.VALIDATION_ERROR, 400);
  }

  await setFeatureStatus(name, body.enabled);
  const logger = c.get("logger");
  logger.info({ feature: name, enabled: body.enabled }, "Feature flag updated");

  return c.json({ feature: name, enabled: body.enabled });
});

export { features as featureRoutes };
