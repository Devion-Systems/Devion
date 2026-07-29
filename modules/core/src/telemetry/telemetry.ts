import type { Context } from "hono";
import type { Logger } from "pino";
import { SystemWatcher, type SystemSnapshot } from "../system/system.js";
import { AppError, ErrorCode } from "../error/app-errors.js";

export type MetricLabels = Record<string, string | number | boolean>;

interface HistogramData {
  count: number;
  sum: number;
  min: number;
  max: number;
}

export interface TelemetryOptions {
  logger?: Logger;
  systemWatcher?: SystemWatcher;
  /** How often to auto-sample the system snapshot, in ms. 0 disables auto-sampling. Default 30_000. */
  sampleIntervalMs?: number;
  /** How many historical system snapshots to keep in memory. Default 120 (1h at 30s). */
  historySize?: number;
  /** Optional push exporter, called on every auto-sample with the latest snapshot. */
  exporter?: (event: TelemetryExportEvent) => Promise<void> | void;
}

export interface TelemetryExportEvent {
  timestamp: string;
  system: SystemSnapshot;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, HistogramData>;
}

function keyFor(name: string, labels?: MetricLabels): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return `${name}{${parts.join(",")}}`;
}

/**
 * In-process metrics + system telemetry. Not a Prometheus/OTel replacement —
 * a lightweight collector you can expose over HTTP and/or push to one via `exporter`.
 */
export class Telemetry {
  private logger?: Logger;
  private watcher: SystemWatcher;
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, HistogramData>();
  private history: SystemSnapshot[] = [];
  private historySize: number;
  private timer?: ReturnType<typeof setInterval>;
  private exporter?: TelemetryOptions["exporter"];

  constructor(opts: TelemetryOptions = {}) {
    this.logger = opts.logger;
    this.watcher = opts.systemWatcher ?? new SystemWatcher({ logger: opts.logger });
    this.historySize = opts.historySize ?? 120;
    this.exporter = opts.exporter;

    const interval = opts.sampleIntervalMs ?? 30_000;
    if (interval > 0) this.start(interval);
  }

  // --- metrics -----------------------------------------------------------

  incrementCounter(name: string, value = 1, labels?: MetricLabels): void {
    const key = keyFor(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  setGauge(name: string, value: number, labels?: MetricLabels): void {
    this.gauges.set(keyFor(name, labels), value);
  }

  recordHistogram(name: string, value: number, labels?: MetricLabels): void {
    const key = keyFor(name, labels);
    const existing = this.histograms.get(key);
    if (!existing) {
      this.histograms.set(key, { count: 1, sum: value, min: value, max: value });
      return;
    }
    existing.count += 1;
    existing.sum += value;
    existing.min = Math.min(existing.min, value);
    existing.max = Math.max(existing.max, value);
  }

  /** Records an AppError occurrence as a labeled counter — wire into your error handler's onError. */
  recordError(err: AppError): void {
    this.incrementCounter("errors_total", 1, { code: err.code, status: err.statusCode });
  }

  /** Times an async function and records its duration (ms) as a histogram. */
  async time<T>(name: string, fn: () => Promise<T>, labels?: MetricLabels): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.recordHistogram(name, performance.now() - start, labels);
    }
  }

  // --- system sampling -----------------------------------------------------

  async sampleNow(): Promise<SystemSnapshot> {
    const snapshot = await this.watcher.snapshot();
    this.history.push(snapshot);
    if (this.history.length > this.historySize) this.history.shift();
    return snapshot;
  }

  start(intervalMs: number): void {
    this.stop();
    this.timer = setInterval(async () => {
      try {
        const snapshot = await this.sampleNow();
        if (this.exporter) {
          await this.exporter(this.buildExportEvent(snapshot));
        }
      } catch (err) {
        this.logger?.warn({ err }, "Telemetry sample/export failed");
      }
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  getHistory(): SystemSnapshot[] {
    return [...this.history];
  }

  private buildExportEvent(snapshot: SystemSnapshot): TelemetryExportEvent {
    return {
      timestamp: snapshot.timestamp,
      system: snapshot,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(this.histograms),
    };
  }

  /** Manually pushes the latest state through the configured exporter. */
  async flush(): Promise<void> {
    if (!this.exporter) return;
    const latest = this.history.at(-1) ?? (await this.sampleNow());
    try {
      await this.exporter(this.buildExportEvent(latest));
    } catch (err) {
      throw new AppError("Telemetry export failed", ErrorCode.TELEMETRY_EXPORT_FAILED, 500, { cause: err });
    }
  }

  /** Snapshot of current metrics state, without triggering a new system sample. */
  toJSON() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(this.histograms),
      lastSystemSnapshot: this.history.at(-1) ?? null,
    };
  }

  /** Hono handler: `app.get("/telemetry", telemetry.handler())` */
  handler() {
    return (c: Context) => c.json(this.toJSON());
  }
}