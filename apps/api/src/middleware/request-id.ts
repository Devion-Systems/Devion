import type { RequestId } from "@repo/core";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types/env.js";

/**
 * Extracts or generates a unique request ID for every incoming request.
 * Sets it on context variables and the response header.
 */
export const requestIdMiddleware = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const id = (c.req.header("X-Request-Id") ?? crypto.randomUUID()) as RequestId;
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    await next();
  });
