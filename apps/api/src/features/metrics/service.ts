import type { WorkloadMetricSample, WorkloadMetricsProvider } from "./provider.js";

export type MetricBucket = { timestamp: string; cpuAverage: number | null; cpuMax: number | null; memoryAverageBytes: number; memoryMaxBytes: number; networkRxBytesPerSecond: number; networkTxBytesPerSecond: number; diskReadBytesPerSecond: number; diskWriteBytesPerSecond: number };

export function aggregateWorkloadMetrics(samples: WorkloadMetricSample[], bucketMs: number): MetricBucket[] {
  const buckets = new Map<number, WorkloadMetricSample[]>();
  for (const sample of samples) {
    const key = Math.floor(sample.recordedAt.getTime() / bucketMs) * bucketMs;
    buckets.set(key, [...(buckets.get(key) ?? []), sample]);
  }
  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([timestamp, values]) => {
    const byWorkload = new Map<string, WorkloadMetricSample[]>();
    for (const value of values) byWorkload.set(value.workloadId, [...(byWorkload.get(value.workloadId) ?? []), value]);
    const series = [...byWorkload.values()];
    // First aggregate within a workload, then across workloads. This keeps a
    // fast-reporting replica from biasing the application-level figures.
    const cpuByWorkload = series.flatMap((items) => {
      const cpu = items.map((item) => item.cpuUsagePercent).filter((value): value is number => value !== null);
      return cpu.length ? [cpu.reduce((total, value) => total + value, 0) / cpu.length] : [];
    });
    const memoryByWorkload = series.map((items) => items.reduce((total, item) => total + item.memoryUsageBytes, 0) / items.length);
    const memoryMaxByWorkload = series.map((items) => Math.max(...items.map((item) => item.memoryUsageBytes)));
    const rate = (field: "networkRxBytes" | "networkTxBytes" | "diskReadBytes" | "diskWriteBytes") => [...byWorkload.values()].reduce((total, series) => {
      if (series.length < 2) return total;
      const elapsed = Math.max(1, (series.at(-1)!.recordedAt.getTime() - series[0]!.recordedAt.getTime()) / 1_000);
      const delta = series.slice(1).reduce((sum, item, index) => {
        const previous = series[index]![field];
        return sum + (item[field] >= previous ? item[field] - previous : item[field]);
      }, 0);
      return total + delta / elapsed;
    }, 0);
    return { timestamp: new Date(timestamp).toISOString(), cpuAverage: cpuByWorkload.length ? cpuByWorkload.reduce((total, value) => total + value, 0) / cpuByWorkload.length : null, cpuMax: cpuByWorkload.length ? Math.max(...cpuByWorkload) : null, memoryAverageBytes: memoryByWorkload.reduce((total, value) => total + value, 0), memoryMaxBytes: memoryMaxByWorkload.reduce((total, value) => total + value, 0), networkRxBytesPerSecond: rate("networkRxBytes"), networkTxBytesPerSecond: rate("networkTxBytes"), diskReadBytesPerSecond: rate("diskReadBytes"), diskWriteBytesPerSecond: rate("diskWriteBytes") };
  });
}

export function metricBucketMs(range: string): number {
  return ({ "15m": 30_000, "1h": 60_000, "6h": 300_000, "24h": 900_000, "7d": 3_600_000 } as Record<string, number>)[range] ?? 60_000;
}
