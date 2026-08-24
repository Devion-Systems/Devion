import type { BuildMetadata, BuildRun, LogEntry, SourceSpec, Workflow } from "./domain.ts";

export interface CreateRunInput {
  workflow: Workflow;
  source: SourceSpec;
  inputs: Record<string, string>;
  secrets: Record<string, string>;
  idempotencyKey: string;
}

export interface RunRepository {
  create(input: CreateRunInput): Promise<{ run: BuildRun; created: boolean }>;
  get(id: string): Promise<BuildRun | null>;
  list(limit: number): Promise<BuildRun[]>;
  claim(workerId: string, leaseSeconds: number): Promise<BuildRun | null>;
  heartbeat(id: string, workerId: string, leaseSeconds: number): Promise<boolean>;
  markPushing(id: string, workerId: string): Promise<boolean>;
  recoverExpiredLeases(): Promise<number>;
  health(): Promise<void>;
  complete(id: string, workerId: string): Promise<void>;
  fail(id: string, workerId: string, error: string): Promise<void>;
  requestCancel(id: string): Promise<boolean>;
  updateMetadata(id: string, metadata: BuildMetadata): Promise<void>;
  appendLog(runId: string, stepId: string | null, stream: LogEntry["stream"], message: string): Promise<void>;
  appendLogs(entries: Array<Omit<LogEntry, "id" | "createdAt">>): Promise<void>;
  logs(runId: string, after: number): Promise<LogEntry[]>;
}
