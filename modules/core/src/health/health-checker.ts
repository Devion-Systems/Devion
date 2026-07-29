import type { Context } from "hono";
import type { Logger } from "pino";

export type HealthStatus = "ok" | "degraded" | "down";

export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  details?: Record<string, unknown>;
  /** Milliseconds the check took to run. Filled in automatically. */
  durationMs?: number;
}

export type HealthCheckFn = () => Promise<HealthCheckResult> | HealthCheckResult;

export interface RegisteredCheck {
  name: string;
  fn: HealthCheckFn;
  /** If true, a "down" result here brings the overall status to "down" instead of "degraded". */
  critical: boolean;
  timeoutMs: number;
}

export interface AggregateHealth {
  status: HealthStatus;
  uptimeSeconds: number;
  timestamp: string;
  checks: Record<string, HealthCheckResult>;
}

export interface HealthRegistryOptions {
  logger?: Logger;
  defaultTimeoutMs?: number;
}

export class HealthRegistry {
  private checks = new Map<string, RegisteredCheck>();
  private logger?: Logger;
  private defaultTimeoutMs: number;
  private startedAt = Date.now();

  constructor(opts: HealthRegistryOptions = {}) {
    this.logger = opts.logger;
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 2000;
  }

  register(name: string, fn: HealthCheckFn, options: { critical?: boolean; timeoutMs?: number } = {}): void {
    this.checks.set(name, {
      name,
      fn,
      critical: options.critical ?? true,
      timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
    });
  }

  unregister(name: string): void {
    this.checks.delete(name);
  }

  private async runOne(check: RegisteredCheck): Promise<HealthCheckResult> {
    const start = performance.now();
    try {
      const result = await Promise.race([
        Promise.resolve(check.fn()),
        new Promise<HealthCheckResult>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), check.timeoutMs)
        ),
      ]);
      return { ...result, durationMs: Math.round(performance.now() - start) };
    } catch (err) {
      this.logger?.warn({ check: check.name, err }, "Health check failed");
      return {
        status: "down",
        message: err instanceof Error ? err.message : "Health check threw",
        durationMs: Math.round(performance.now() - start),
      };
    }
  }

  /** Runs every registered check in parallel and aggregates the overall status. */
  async run(): Promise<AggregateHealth> {
    const entries = [...this.checks.values()];
    const results = await Promise.all(entries.map((c) => this.runOne(c)));

    const checks: Record<string, HealthCheckResult> = {};
    let status: HealthStatus = "ok";

    entries.forEach((check, i) => {
      const result = results[i]!;
      checks[check.name] = result;
      if (result.status === "down") {
        status = check.critical ? "down" : status === "down" ? "down" : "degraded";
      } else if (result.status === "degraded" && status === "ok") {
        status = "degraded";
      }
    });

    return {
      status,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /** Hono handler: `app.get("/health", registry.handler())`. Returns 503 when status is "down". */
  handler() {
    return async (c: Context) => {
      const result = await this.run();
      const httpStatus = result.status === "down" ? 503 : 200;
      return c.json(result, httpStatus);
    };
  }

  /** Lightweight liveness probe — process is up, no dependency checks. For k8s livenessProbe. */
  static liveHandler() {
    return (c: Context) => c.json({ status: "ok", timestamp: new Date().toISOString() });
  }
}

// --- Common check factories -------------------------------------------------

/** Checks a Postgres/Supabase connection via a trivial query function you provide. */
export function createDbCheck(ping: () => Promise<unknown>): HealthCheckFn {
  return async () => {
    await ping();
    return { status: "ok" };
  };
}

/** Checks an S3-compatible endpoint by HEADing it. */
export function createHttpDependencyCheck(url: string): HealthCheckFn {
  return async () => {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) {
      return { status: "degraded", message: `HTTP ${res.status}`, details: { url } };
    }
    return { status: "ok", details: { url } };
  };
}