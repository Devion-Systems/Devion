import { strict as assert } from "node:assert";
import { aggregateWorkloadMetrics } from "../src/features/metrics/service.js";
const ref = process.argv[2] ?? "b9bd57501a47caa1a4d88534510f21e0ff4b359d";
const source = Bun.spawnSync(["git", "show", `${ref}:apps/api/src/features/metrics/service.ts`]);
if (source.exitCode !== 0) throw new Error("Cannot load benchmark baseline");
const js = new Bun.Transpiler({ loader: "ts" }).transformSync(source.stdout.toString());
// Only executes the explicitly selected, local Git revision for this benchmark.
const baseline = new Function(`${js.replaceAll("export function ", "function ")}\nreturn { aggregateWorkloadMetrics };`)();
for (const workloads of [100, 1000]) {
  const samples = Array.from({ length: workloads * 20 }, (_, i) => ({
    workloadId: `w-${Math.floor(i / 20)}`, nodeId: "node", recordedAt: new Date((i % 20) * 30_000),
    cpuUsagePercent: i % 100, memoryUsageBytes: 1024, memoryLimitBytes: 2048,
    networkRxBytes: (i % 20) * 100, networkTxBytes: (i % 20) * 50, diskReadBytes: 0, diskWriteBytes: 0,
  }));
  assert.deepEqual(aggregateWorkloadMetrics(samples, 3_600_000), baseline.aggregateWorkloadMetrics(samples, 3_600_000));
  const measure = (fn: typeof aggregateWorkloadMetrics) => {
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now(); fn(samples, 3_600_000); times.push(performance.now() - start);
    }
    return times.sort((a,b) => a-b)[2];
  };
  console.log(JSON.stringify({ workloads, samples: samples.length, bucketMs: 3_600_000, baselineRef: ref,
    beforeMedianMs: measure(baseline.aggregateWorkloadMetrics), afterMedianMs: measure(aggregateWorkloadMetrics),
    scope: "synthetic in-process aggregation; 5 trials; identical outputs" }));
}
