export { parseEnv, type CoreEnv } from "./config/env.js";

export { AppError, ErrorCode, type AppErrorOptions } from "./error/app-errors.js";
export {
  createErrorHandler,
  notFoundHandler,
  asyncGuard,
  registerProcessGuards,
  type ErrorHandlerOptions,
  type ProcessGuardOptions,
} from "./error/error_handler.js";

export { createLogger, getLogger, childLogger, type CreateLoggerOptions, type Logger } from "./logger/logger.js";

export {
  HealthRegistry,
  createDbCheck,
  createHttpDependencyCheck,
  type HealthStatus,
  type HealthCheckResult,
  type HealthCheckFn,
  type AggregateHealth,
  type HealthRegistryOptions,
} from "./health/health-checker.js";

export {
  SystemWatcher,
  type SystemSnapshot,
  type CpuMetrics,
  type RamMetrics,
  type GpuMetrics,
  type StorageMetrics,
  type SystemWatcherOptions,
} from "./system/system.js";

export {
  Telemetry,
  type TelemetryOptions,
  type TelemetryExportEvent,
  type MetricLabels,
} from "./telemetry/telemetry.js";