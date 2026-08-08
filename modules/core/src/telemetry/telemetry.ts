import type { Context } from "hono";
import type { Logger } from "pino";
import { SystemWatcher, type SystemSnapshot } from "../system/system.js";
import { AppError, ErrorCode } from "../error/app-errors.js";
import {
  metrics,
  type Meter,
  type Counter,
  type ObservableGauge,
  type Histogram,
} from "@opentelemetry/api";
import {
  MeterProvider,
  MetricReader,
  DataPointType,
} from "@opentelemetry/sdk-metrics";

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
 * A specification-compliant helper reader to collect metrics in-memory.
 */
class InMemoryMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}
}

/**
 * OpenTelemetry-backed metrics + system telemetry. Exposes collected metrics
 * over HTTP and/or pushes them to a custom exporter.
 */
export class Telemetry {
  private logger?: Logger;
  private watcher: SystemWatcher;
  private history: SystemSnapshot[] = [];
  private historySize: number;
  private timer?: ReturnType<typeof setInterval>;
  private exporter?: TelemetryOptions["exporter"];

  // OpenTelemetry components
  private provider: MeterProvider;
  private reader: InMemoryMetricReader;
  private meter: Meter;
  
  private otelCounters = new Map<string, Counter>();
  private otelHistograms = new Map<string, Histogram>();
  private otelGauges = new Map<string, ObservableGauge>();
  private gaugeValues = new Map<string, { name: string; value: number; labels: MetricLabels }>();

  constructor(opts: TelemetryOptions = {}) {
    this.logger = opts.logger;
    this.watcher = opts.systemWatcher ?? new SystemWatcher({ logger: opts.logger });
    this.historySize = opts.historySize ?? 120;
    this.exporter = opts.exporter;

    // Initialize OpenTelemetry Metrics SDK
    this.reader = new InMemoryMetricReader();
    this.provider = new MeterProvider({
      readers: [this.reader],
    });
    this.meter = this.provider.getMeter("devion-core");

    const interval = opts.sampleIntervalMs ?? 30_000;
    if (interval > 0) this.start(interval);
  }

  // --- OpenTelemetry Collector helper ---

  private async collectMetrics() {
    const counters = new Map<string, number>();
    const gauges = new Map<string, number>();
    const histograms = new Map<string, HistogramData>();

    const collectionResult = await this.reader.collect();
    if (collectionResult.resourceMetrics) {
      for (const scopeMetrics of collectionResult.resourceMetrics.scopeMetrics) {
        for (const metric of scopeMetrics.metrics) {
          const name = metric.descriptor.name;
          
          for (const point of metric.dataPoints) {
            const labels = point.attributes as MetricLabels;
            const key = keyFor(name, labels);

            if (metric.dataPointType === DataPointType.SUM) {
              counters.set(key, point.value as number);
            } else if (metric.dataPointType === DataPointType.GAUGE) {
              gauges.set(key, point.value as number);
            } else if (metric.dataPointType === DataPointType.HISTOGRAM) {
              const val = point.value as any;
              histograms.set(key, {
                count: val.count ?? 0,
                sum: val.sum ?? 0,
                min: val.min ?? 0,
                max: val.max ?? 0,
              });
            }
          }
        }
      }
    }

    return { counters, gauges, histograms };
  }

  // --- metrics -----------------------------------------------------------

  incrementCounter(name: string, value = 1, labels?: MetricLabels): void {
    let counter = this.otelCounters.get(name);
    if (!counter) {
      counter = this.meter.createCounter(name);
      this.otelCounters.set(name, counter);
    }
    counter.add(value, labels);
  }

  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    const key = keyFor(name, labels);
    this.gaugeValues.set(key, { name, value, labels });

    if (!this.otelGauges.has(name)) {
      const gauge = this.meter.createObservableGauge(name);
      gauge.addCallback((result) => {
        for (const [_, g] of this.gaugeValues.entries()) {
          if (g.name === name) {
            result.observe(g.value, g.labels);
          }
        }
      });
      this.otelGauges.set(name, gauge);
    }
  }

  recordHistogram(name: string, value: number, labels?: MetricLabels): void {
    let histogram = this.otelHistograms.get(name);
    if (!histogram) {
      histogram = this.meter.createHistogram(name);
      this.otelHistograms.set(name, histogram);
    }
    histogram.record(value, labels);
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
          await this.exporter(await this.buildExportEvent(snapshot));
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

  private async buildExportEvent(snapshot: SystemSnapshot): Promise<TelemetryExportEvent> {
    const collected = await this.collectMetrics();
    return {
      timestamp: snapshot.timestamp,
      system: snapshot,
      counters: Object.fromEntries(collected.counters),
      gauges: Object.fromEntries(collected.gauges),
      histograms: Object.fromEntries(collected.histograms),
    };
  }

  /** Manually pushes the latest state through the configured exporter. */
  async flush(): Promise<void> {
    if (!this.exporter) return;
    const latest = this.history.at(-1) ?? (await this.sampleNow());
    try {
      await this.exporter(await this.buildExportEvent(latest));
    } catch (err) {
      throw new AppError("Telemetry export failed", ErrorCode.TELEMETRY_EXPORT_FAILED, 500, { cause: err });
    }
  }

  /** Snapshot of current metrics state, without triggering a new system sample. */
  async toJSON() {
    const collected = await this.collectMetrics();
    return {
      counters: Object.fromEntries(collected.counters),
      gauges: Object.fromEntries(collected.gauges),
      histograms: Object.fromEntries(collected.histograms),
      lastSystemSnapshot: this.history.at(-1) ?? null,
    };
  }

  /** Hono handler: `app.get("/telemetry", telemetry.handler())` */
  handler() {
    return async (c: Context) => c.json(await this.toJSON());
  }
}