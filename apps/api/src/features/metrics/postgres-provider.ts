import { db, getDbPool, workloadMetrics } from "@repo/db";
import { and, asc, gte, inArray, lt } from "drizzle-orm";
import type { WorkloadMetricSample, WorkloadMetricsProvider } from "./provider.js";

export class PostgresWorkloadMetricsProvider implements WorkloadMetricsProvider {
  async write(samples: WorkloadMetricSample[]): Promise<void> {
    if (samples.length) await db.insert(workloadMetrics).values(samples).onConflictDoNothing();
  }
  async query(workloadIds: string[], from: Date, to: Date, bucketMs?: number): Promise<WorkloadMetricSample[]> {
    if (!workloadIds.length) return [];
    if (bucketMs) {
      type Row = { workload_id: string; node_id: string; recorded_at: Date; cpu_usage_percent: number | null; memory_usage_bytes: string | number; memory_limit_bytes: string | number | null; network_rx_bytes: string | number; network_tx_bytes: string | number; disk_read_bytes: string | number; disk_write_bytes: string | number };
      const result = await getDbPool().query<Row>(
        `WITH bucketed AS (
           SELECT *, floor(extract(epoch FROM recorded_at) * 1000 / $4) * $4 AS bucket
           FROM workload_metrics
           WHERE workload_id = ANY($1::text[]) AND recorded_at >= $2 AND recorded_at < $3
         ), ranked AS (
           SELECT *,
             row_number() OVER (PARTITION BY workload_id, bucket ORDER BY recorded_at ASC) AS first_rank,
             row_number() OVER (PARTITION BY workload_id, bucket ORDER BY recorded_at DESC) AS last_rank
           FROM bucketed
         )
         SELECT workload_id, node_id, recorded_at, cpu_usage_percent, memory_usage_bytes, memory_limit_bytes,
                network_rx_bytes, network_tx_bytes, disk_read_bytes, disk_write_bytes
         FROM ranked
         WHERE first_rank = 1 OR last_rank = 1
         ORDER BY workload_id ASC, recorded_at ASC`,
        [workloadIds, from, to, bucketMs],
      );
      return result.rows.map((row) => ({
        workloadId: row.workload_id, nodeId: row.node_id, recordedAt: row.recorded_at,
        cpuUsagePercent: row.cpu_usage_percent, memoryUsageBytes: Number(row.memory_usage_bytes), memoryLimitBytes: row.memory_limit_bytes === null ? null : Number(row.memory_limit_bytes),
        networkRxBytes: Number(row.network_rx_bytes), networkTxBytes: Number(row.network_tx_bytes), diskReadBytes: Number(row.disk_read_bytes), diskWriteBytes: Number(row.disk_write_bytes),
      }));
    }
    return db.select({ workloadId: workloadMetrics.workloadId, nodeId: workloadMetrics.nodeId, recordedAt: workloadMetrics.recordedAt, cpuUsagePercent: workloadMetrics.cpuUsagePercent, memoryUsageBytes: workloadMetrics.memoryUsageBytes, memoryLimitBytes: workloadMetrics.memoryLimitBytes, networkRxBytes: workloadMetrics.networkRxBytes, networkTxBytes: workloadMetrics.networkTxBytes, diskReadBytes: workloadMetrics.diskReadBytes, diskWriteBytes: workloadMetrics.diskWriteBytes }).from(workloadMetrics).where(and(inArray(workloadMetrics.workloadId, workloadIds), gte(workloadMetrics.recordedAt, from), lt(workloadMetrics.recordedAt, to))).orderBy(asc(workloadMetrics.workloadId), asc(workloadMetrics.recordedAt));
  }
  async deleteExpired(before: Date, batchSize = 10_000): Promise<number> {
    const candidates = await db.select({ id: workloadMetrics.id }).from(workloadMetrics).where(lt(workloadMetrics.recordedAt, before)).orderBy(asc(workloadMetrics.recordedAt)).limit(batchSize);
    if (!candidates.length) return 0;
    const deleted = await db.delete(workloadMetrics).where(inArray(workloadMetrics.id, candidates.map((candidate) => candidate.id))).returning({ id: workloadMetrics.id });
    return deleted.length;
  }
}
