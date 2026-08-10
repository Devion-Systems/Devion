import type { Logger } from "pino";
import type { RequestId } from "@repo/core";

/**
 * Custom Hono environment type for typed context access
 * across all routes and middleware.
 */
export type AppEnv = {
  Variables: {
    requestId: RequestId;
    logger: Logger;
  };
};
