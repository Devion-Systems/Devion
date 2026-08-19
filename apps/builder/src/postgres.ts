import postgres from "postgres";
import type { BuildRun, LogEntry } from "./domain.ts";
import type { CreateRunInput, RunRepository } from "./repository.ts";

type Sql = ReturnType<typeof postgres>;
type JsonValue = Parameters<Sql["json"]>[0];
type Row = Record<string, unknown>;

export class PostgresRunRepository implements RunRepository {
  constructor(private readonly sql: Sql) {}

  async migrate(): Promise<void> {
    await this.sql.unsafe(await Bun.file(new URL("../migrations/001_init.sql", import.meta.url)).text());
  }

  async create(input: CreateRunInput): Promise<{ run: BuildRun; created: boolean }> {
    const id = crypto.randomUUID();
    const rows = await this.sql`
      INSERT INTO builder_runs (id, workflow, source, inputs, secrets, idempotency_key)
      VALUES (${id}, ${this.sql.json(jsonValue(input.workflow))}, ${this.sql.json(jsonValue(input.source))}, ${this.sql.json(input.inputs)}, ${this.sql.json(input.secrets)}, ${input.idempotencyKey})
      ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING *, (xmax = 0) AS inserted`;
    const row = rows[0] as Row;
    return { run: mapRun(row), created: Boolean(row.inserted) };
  }

  async get(id: string): Promise<BuildRun | null> {
    const rows = await this.sql`SELECT * FROM builder_runs WHERE id = ${id}`;
    return rows[0] ? mapRun(rows[0] as Row) : null;
  }

  async list(limit: number): Promise<BuildRun[]> {
    const rows = await this.sql`SELECT * FROM builder_runs ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map((row) => mapRun(row as Row));
  }

  async claim(workerId: string, leaseSeconds: number): Promise<BuildRun | null> {
    const rows = await this.sql`
      WITH next_run AS (
        SELECT id FROM builder_runs WHERE status = 'queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE builder_runs SET status = 'running', worker_id = ${workerId}, attempt = attempt + 1, started_at = now(), lease_expires_at = now() + (${leaseSeconds} * interval '1 second')
      FROM next_run WHERE builder_runs.id = next_run.id RETURNING builder_runs.*`;
    const row = rows[0];
    return row ? mapRun(row as Row) : null;
  }

  async heartbeat(id: string, workerId: string, leaseSeconds: number): Promise<boolean> {
    const rows = await this.sql`UPDATE builder_runs SET lease_expires_at = now() + (${leaseSeconds} * interval '1 second') WHERE id = ${id} AND worker_id = ${workerId} AND status = 'running' RETURNING id`;
    return rows.length > 0;
  }

  async recoverExpiredLeases(): Promise<number> {
    const rows = await this.sql`UPDATE builder_runs SET status = 'queued', worker_id = NULL, lease_expires_at = NULL, started_at = NULL WHERE status = 'running' AND lease_expires_at < now() RETURNING id`;
    return rows.length;
  }

  async health(): Promise<void> { await this.sql`SELECT 1`; }

  async complete(id: string, workerId: string): Promise<void> {
    await this.sql`UPDATE builder_runs SET status = CASE WHEN cancel_requested THEN 'cancelled' ELSE 'succeeded' END, finished_at = now(), lease_expires_at = NULL, secrets = '{}'::jsonb WHERE id = ${id} AND worker_id = ${workerId}`;
  }

  async fail(id: string, workerId: string, error: string): Promise<void> {
    await this.sql`UPDATE builder_runs SET status = CASE WHEN cancel_requested THEN 'cancelled' ELSE 'failed' END, error = ${error.slice(0, 8000)}, finished_at = now(), lease_expires_at = NULL, secrets = '{}'::jsonb WHERE id = ${id} AND worker_id = ${workerId}`;
  }

  async requestCancel(id: string): Promise<boolean> {
    const rows = await this.sql`UPDATE builder_runs SET cancel_requested = true, status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END, finished_at = CASE WHEN status = 'queued' THEN now() ELSE finished_at END WHERE id = ${id} AND status IN ('queued', 'running') RETURNING id`;
    return rows.length > 0;
  }

  async updateMetadata(id: string, metadata: BuildRun["metadata"]): Promise<void> {
    await this.sql`UPDATE builder_runs SET metadata = ${this.sql.json(jsonValue(metadata))} WHERE id = ${id}`;
  }

  async appendLog(runId: string, stepId: string | null, stream: LogEntry["stream"], message: string): Promise<void> {
    await this.appendLogs([{ runId, stepId, stream, message }]);
  }

  async appendLogs(entries: Array<Omit<LogEntry, "id" | "createdAt">>): Promise<void> {
    if (!entries.length) return;
    await this.sql.begin(async (tx) => {
      for (const entry of entries) {
        await tx`INSERT INTO builder_logs (run_id, step_id, stream, message) VALUES (${entry.runId}, ${entry.stepId}, ${entry.stream}, ${entry.message.slice(0, 32_000)})`;
      }
    });
  }

  async logs(runId: string, after: number): Promise<LogEntry[]> {
    const rows = await this.sql`SELECT * FROM builder_logs WHERE run_id = ${runId} AND id > ${after} ORDER BY id LIMIT 1000`;
    return rows.map((row) => ({ id: Number(row.id), runId: String(row.run_id), stepId: row.step_id ? String(row.step_id) : null, stream: row.stream as LogEntry["stream"], message: String(row.message), createdAt: new Date(row.created_at as string).toISOString() }));
  }
}

export function connect(url: string): Sql {
  return postgres(url, { max: 10, idle_timeout: 20 });
}

function mapRun(row: Row): BuildRun {
  return {
    id: String(row.id), workflow: row.workflow as BuildRun["workflow"], source: row.source as BuildRun["source"],
    inputs: row.inputs as Record<string, string>, secrets: row.secrets as Record<string, string>, metadata: (row.metadata ?? { exposedPorts: [], detectedDockerfiles: {} }) as BuildRun["metadata"], status: row.status as BuildRun["status"],
    attempt: Number(row.attempt), idempotencyKey: String(row.idempotency_key), leaseExpiresAt: row.lease_expires_at ? new Date(row.lease_expires_at as string).toISOString() : null, cancelRequested: Boolean(row.cancel_requested), error: row.error ? String(row.error) : null,
    createdAt: new Date(row.created_at as string).toISOString(), startedAt: row.started_at ? new Date(row.started_at as string).toISOString() : null,
    finishedAt: row.finished_at ? new Date(row.finished_at as string).toISOString() : null,
  };
}

function jsonValue(value: object): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
