import pino, { type Logger, type LoggerOptions } from "pino";
import type { CoreEnv } from "../config/env.js";

export type { Logger };

let rootLogger: Logger | undefined;

export interface CreateLoggerOptions {
  name?: string;
  /** Extra bindings attached to every log line (service, region, instance id...). */
  base?: Record<string, unknown>;
}

/**
 * Creates the root pino logger from validated env. Call once at boot (e.g. right
 * after `parseEnv()`), then use `getLogger()` / `.child()` everywhere else.
 */
export function createLogger(env: Pick<CoreEnv, "LOG_LEVEL" | "NODE_ENV" | "APP_NAME">, opts: CreateLoggerOptions = {}): Logger {
  const isDev = env.NODE_ENV === "development";

  const options: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: { app: env.APP_NAME, ...opts.base },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.password",
        "*.secret",
        "*.token",
        "*.apiKey",
        "*.S3_SECRET_KEY",
        "*.BETTER_AUTH_SECRET",
      ],
      censor: "[redacted]",
    },
    transport: isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  };

  rootLogger = pino(options).child({ component: opts.name ?? "core" });
  return rootLogger;
}

/** Returns the root logger created via `createLogger()`. Throws if called before boot. */
export function getLogger(): Logger {
  if (!rootLogger) {
    throw new Error("Logger not initialized. Call createLogger(env) once at application startup.");
  }
  return rootLogger;
}

/** Convenience for module-scoped child loggers: `const log = childLogger("db")`. */
export function childLogger(component: string, bindings: Record<string, unknown> = {}): Logger {
  return getLogger().child({ component, ...bindings });
}