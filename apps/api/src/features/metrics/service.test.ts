import { expect, test } from "bun:test";
import { aggregateWorkloadMetrics, metricBucketMs } from "./service.js";

test("aggregates counters into reset-safe rates without inventing CPU", () => {
  const at = (seconds: number) => new Date(1_000_000 + seconds * 1_000);
  const samples = [
    { workloadId: "a", nodeId: "n", recordedAt: at(0), cpuUsagePercent: null, memoryUsageBytes: 10, memoryLimitBytes: 20, networkRxBytes: 100, networkTxBytes: 40, diskReadBytes: 10, diskWriteBytes: 20 },
    { workloadId: "a", nodeId: "n", recordedAt: at(10), cpuUsagePercent: 50, memoryUsageBytes: 30, memoryLimitBytes: 20, networkRxBytes: 160, networkTxBytes: 70, diskReadBytes: 40, diskWriteBytes: 50 },
  ];
  const [bucket] = aggregateWorkloadMetrics(samples, 60_000);
  expect(bucket?.cpuAverage).toBe(50);
  expect(bucket?.memoryMaxBytes).toBe(30);
  expect(bucket?.networkRxBytesPerSecond).toBe(6);
  expect(bucket?.diskWriteBytesPerSecond).toBe(3);
  expect(metricBucketMs("7d")).toBe(3_600_000);
});

test("counter resets are treated as fresh counters rather than negative transfer", () => {
  const samples = [
    { workloadId: "a", nodeId: "n", recordedAt: new Date(0), cpuUsagePercent: 0, memoryUsageBytes: 1, memoryLimitBytes: null, networkRxBytes: 500, networkTxBytes: 500, diskReadBytes: 500, diskWriteBytes: 500 },
    { workloadId: "a", nodeId: "n", recordedAt: new Date(10_000), cpuUsagePercent: 0, memoryUsageBytes: 1, memoryLimitBytes: null, networkRxBytes: 5, networkTxBytes: 5, diskReadBytes: 5, diskWriteBytes: 5 },
  ];
  expect(aggregateWorkloadMetrics(samples, 60_000)[0]?.networkRxBytesPerSecond).toBe(0.5);
});

test("sums memory and network rates across replicas without sample-frequency bias", () => {
  const at = (seconds: number) => new Date(seconds * 1_000);
  const samples = [
    { workloadId: "a", nodeId: "n", recordedAt: at(0), cpuUsagePercent: 20, memoryUsageBytes: 10, memoryLimitBytes: 20, networkRxBytes: 0, networkTxBytes: 0, diskReadBytes: 0, diskWriteBytes: 0 },
    { workloadId: "a", nodeId: "n", recordedAt: at(10), cpuUsagePercent: 40, memoryUsageBytes: 30, memoryLimitBytes: 20, networkRxBytes: 100, networkTxBytes: 0, diskReadBytes: 0, diskWriteBytes: 0 },
    { workloadId: "b", nodeId: "n", recordedAt: at(0), cpuUsagePercent: 60, memoryUsageBytes: 50, memoryLimitBytes: 80, networkRxBytes: 0, networkTxBytes: 0, diskReadBytes: 0, diskWriteBytes: 0 },
    { workloadId: "b", nodeId: "n", recordedAt: at(10), cpuUsagePercent: 60, memoryUsageBytes: 70, memoryLimitBytes: 80, networkRxBytes: 200, networkTxBytes: 0, diskReadBytes: 0, diskWriteBytes: 0 },
  ];
  const [bucket] = aggregateWorkloadMetrics(samples, 60_000);
  expect(bucket?.cpuAverage).toBe(45);
  expect(bucket?.memoryAverageBytes).toBe(80);
  expect(bucket?.memoryMaxBytes).toBe(100);
  expect(bucket?.networkRxBytesPerSecond).toBe(30);
});

test("uses the preceding sample for a single-sample bucket rate", () => {
  const samples = [
    { workloadId: "a", nodeId: "n", recordedAt: new Date(0), cpuUsagePercent: 0, memoryUsageBytes: 1, memoryLimitBytes: null, networkRxBytes: 0, networkTxBytes: 0, diskReadBytes: 0, diskWriteBytes: 0 },
    { workloadId: "a", nodeId: "n", recordedAt: new Date(30_000), cpuUsagePercent: 0, memoryUsageBytes: 1, memoryLimitBytes: null, networkRxBytes: 300, networkTxBytes: 0, diskReadBytes: 0, diskWriteBytes: 0 },
  ];
  const buckets = aggregateWorkloadMetrics(samples, 30_000);
  expect(buckets[0]?.networkRxBytesPerSecond).toBe(0);
  expect(buckets[1]?.networkRxBytesPerSecond).toBe(10);
});
