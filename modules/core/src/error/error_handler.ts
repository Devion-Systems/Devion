import type { Context, ErrorHandler, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Logger } from "pino";
import { AppError, ErrorCode } from "./app-errors.js";

export interface ErrorHandlerOptions {
  logger: Logger;
  /** Include the error message/details in 5xx responses. Keep false in production. */
  exposeInternals?: boolean;
  /** Called after logging, e.g. to forward to telemetry.recordError(). */
  onError?: (err: AppError, c: Context) => void;
}

/**
 * Hono `onError` handler. Normalizes any thrown value into an AppError,
 * logs it at the right level, and returns a consistent JSON error body.
 * Usage: `app.onError(createErrorHandler({ logger }))`
 */
export function createErrorHandler(opts: ErrorHandlerOptions): ErrorHandler {
  const { logger, exposeInternals = false, onError } = opts;

  return (err, c) => {
    const appError = toAppError(err);

    const logPayload = { ...appError.toLog(), path: c.req.path, method: c.req.method };
    if (appError.statusCode >= 500) {
      logger.error(logPayload, "Request failed");
    } else {
      logger.warn(logPayload, "Request rejected");
    }

    onError?.(appError, c);

    const body = appError.toResponse();
    if (exposeInternals && appError.statusCode >= 500 && !appError.expose) {
      (body.error as Record<string, unknown>).debugMessage = appError.message;
    }

    return c.json(body, appError.statusCode as any);
  };
}

function toAppError(err: unknown): AppError {
  if (AppError.isAppError(err)) return err;
  if (err instanceof HTTPException) {
    return new AppError(err.message, ErrorCode.INTERNAL_ERROR, err.status, { cause: err });
  }
  return AppError.from(err);
}

/**
 * 404 handler for unmatched routes. Usage: `app.notFound(notFoundHandler)`
 */
export const notFoundHandler = (c: Context) => {
  const err = new AppError(`Route not found: ${c.req.method} ${c.req.path}`, ErrorCode.NOT_FOUND);
  return c.json(err.toResponse(), 404);
};

/**
 * Wraps a route handler so any thrown/rejected error is forwarded to Hono's
 * onError pipeline instead of crashing the process, without needing try/catch
 * in every handler.
 */
export function asyncGuard(handler: MiddlewareHandler): MiddlewareHandler {
  return async (c, next) => {
    try {
      await handler(c, next);
    } catch (err) {
      throw AppError.isAppError(err) ? err : AppError.from(err);
    }
  };
}

export interface ProcessGuardOptions {
  logger: Logger;
  /** Called before the process exits, e.g. to flush telemetry/logger. Should resolve quickly. */
  onFatal?: (err: AppError) => void | Promise<void>;
  /** Exit code used after an uncaught exception. Default 1. */
  exitCode?: number;
}

/**
 * Registers process-level guards for uncaughtException / unhandledRejection.
 * Logs the error, runs an optional shutdown hook, then exits — never leaves
 * the process running in an unknown state. Call once at boot.
 */
export function registerProcessGuards(opts: ProcessGuardOptions): void {
  const { logger, onFatal, exitCode = 1 } = opts;

  const handleFatal = (source: string) => async (err: unknown) => {
    const appError = AppError.from(err, ErrorCode.INTERNAL_ERROR);
    logger.fatal({ ...appError.toLog(), source }, "Fatal error, shutting down");
    try {
      await onFatal?.(appError);
    } catch (hookErr) {
      logger.error({ err: hookErr }, "onFatal hook itself threw");
    } finally {
      process.exit(exitCode);
    }
  };

  process.on("uncaughtException", handleFatal("uncaughtException"));
  process.on("unhandledRejection", handleFatal("unhandledRejection"));
}