export type WorkloadMetricSample = {
  workloadId: string;
  nodeId: string;
  recordedAt: Date;
  cpuUsagePercent: number | null;
  memoryUsageBytes: number;
  memoryLimitBytes: number | null;
  networkRxBytes: number;
  networkTxBytes: number;
  diskReadBytes: number;
  diskWriteBytes: number;
};

export interface WorkloadMetricsProvider {
  write(samples: WorkloadMetricSample[]): Promise<void>;
  /** `bucketMs` returns the first and last point per workload/bucket in SQL. */
  query(workloadIds: string[], from: Date, to: Date, bucketMs?: number): Promise<WorkloadMetricSample[]>;
  /** Deletes at most one bounded batch so retention cannot lock the table for a long time. */
  deleteExpired(before: Date, batchSize?: number): Promise<number>;
}
