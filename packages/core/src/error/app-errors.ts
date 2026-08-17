export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  CONFLICT = "CONFLICT",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  HEALTH_CHECK_FAILED = "HEALTH_CHECK_FAILED",
  SYSTEM_METRIC_FAILED = "SYSTEM_METRIC_FAILED",
  TELEMETRY_EXPORT_FAILED = "TELEMETRY_EXPORT_FAILED",
}

const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.HEALTH_CHECK_FAILED]: 503,
  [ErrorCode.SYSTEM_METRIC_FAILED]: 500,
  [ErrorCode.TELEMETRY_EXPORT_FAILED]: 500,
};

export interface AppErrorOptions {
  /** Original error that caused this one, kept for logging, never sent to clients. */
  cause?: unknown;
  /** Extra structured context, logged but only exposed to clients if `expose` is true. */
  details?: Record<string, unknown>;
  /** Whether `details` is safe to send back in an API response. Default false. */
  expose?: boolean;
  /** Marks the error as operational (expected, e.g. bad input) vs a programming bug. */
  isOperational?: boolean;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly cause?: unknown;
  public readonly details?: Record<string, unknown>;
  public readonly expose: boolean;
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    statusCode?: number,
    options: AppErrorOptions = {}
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode ?? HTTP_STATUS_BY_CODE[code] ?? 500;
    this.cause = options.cause;
    this.details = options.details;
    this.expose = options.expose ?? false;
    this.isOperational = options.isOperational ?? true;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace?.(this, AppError);
  }

  /** Shape returned to API clients. Never leaks `cause` or internal stack traces. */
  toResponse() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.expose && this.details ? { details: this.details } : {}),
        timestamp: this.timestamp,
      },
    };
  }

  /** Shape written to the logger. Includes everything, including `cause`. */
  toLog() {
    return {
      code: this.code,
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
      isOperational: this.isOperational,
      cause:
        this.cause instanceof Error
          ? { name: this.cause.name, message: this.cause.message, stack: this.cause.stack }
          : this.cause,
      stack: this.stack,
    };
  }

  static isAppError(err: unknown): err is AppError {
    return err instanceof AppError;
  }

  /** Wraps any unknown thrown value into an AppError without losing the original. */
  static from(err: unknown, fallbackCode: ErrorCode = ErrorCode.INTERNAL_ERROR): AppError {
    if (AppError.isAppError(err)) return err;
    if (err instanceof Error) {
      return new AppError(err.message, fallbackCode, undefined, {
        cause: err,
        isOperational: false,
      });
    }
    return new AppError(typeof err === "string" ? err : "Unknown error", fallbackCode, undefined, {
      cause: err,
      isOperational: false,
    });
  }
}