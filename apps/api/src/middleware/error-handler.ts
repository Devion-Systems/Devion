import { AppError, ErrorCode, getLogger } from "@repo/core";
import type { ErrorHandler } from "hono";
import type { AppEnv } from "../types/env.js";

/**
 * Maps internal ErrorCode to HTTP status codes.
 */
const errorCodeToStatus: Record<string, 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

/**
 * Global error handler that catches thrown errors,
 * maps AppError instances to structured JSON responses,
 * and logs unexpected errors.
 */
export const globalErrorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const logger = c.get("logger") ?? getLogger();

  if (err instanceof AppError) {
    const status = errorCodeToStatus[err.code] ?? 500;
    logger.warn({ err, code: err.code, requestId: c.get("requestId") }, "Handled application error");

    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.expose && err.details ? { details: err.details } : {}),
          requestId: c.get("requestId"),
        },
      },
      status,
    );
  }

  // Unexpected error
  logger.error({ err, requestId: c.get("requestId") }, "Unhandled error");

  return c.json(
    {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred",
        requestId: c.get("requestId"),
      },
    },
    500,
  );
};
