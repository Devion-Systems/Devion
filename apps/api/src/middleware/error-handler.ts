import type { ErrorHandler } from "hono";
import { AppError, ErrorCode } from "@repo/core";
import { getLogger } from "@repo/core";
import type { AppEnv } from "../types/env.js";
import type { StatusCode } from "hono/utils/http-status";

const fallbackLogger = getLogger("api:error");

/**
 * Maps internal ErrorCode to HTTP status codes.
 */
const errorCodeToStatus: Record<string, StatusCode> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

/**
 * Global error handler that catches thrown errors,
 * maps AppError instances to structured JSON responses,
 * and logs unexpected errors.
 */
export const globalErrorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const logger = c.get("logger") ?? fallbackLogger;

  if (err instanceof AppError) {
    const status = errorCodeToStatus[err.code] ?? 500;
    logger.warn({ err, code: err.code }, "Handled application error");

    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      status as StatusCode,
    );
  }

  // Unexpected error
  logger.error({ err }, "Unhandled error");

  return c.json(
    {
      error: {
        code: ErrorCode.INTERNAL,
        message: "An unexpected error occurred",
      },
    },
    500,
  );
};
