import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app.ts";
import type { BuildRun, LogEntry } from "../src/domain.ts";
import type { CreateRunInput, RunRepository } from "../src/repository.ts";

class MemoryRepository implements RunRepository {
  runs = new Map<string, BuildRun>();
  async create(input: CreateRunInput) {
    const existing = [...this.runs.values()].find((run) => run.idempotencyKey === input.idempotencyKey);
    if (existing) return { run: existing, created: false };
    const run: BuildRun = { id: crypto.randomUUID(), ...input, metadata: { exposedPorts: [], detectedDockerfiles: {} }, status: "queued", attempt: 0, leaseExpiresAt: null, workerId: null, cancelRequested: false, error: null, createdAt: new Date().toISOString(), startedAt: null, finishedAt: null };
    this.runs.set(run.id, run); return { run, created: true };
  }
  async get(id: string) { return this.runs.get(id) ?? null; }
  async list(limit: number) { return [...this.runs.values()].slice(0, limit); }
  async claim() { return null; }
  async heartbeat() { return true; }
  async markPushing() { return true; }
  async recoverExpiredLeases() { return 0; }
  async health() {}
  async complete() {}
  async fail() {}
  async requestCancel(id: string) { const run = this.runs.get(id); if (!run) return false; run.cancelRequested = true; return true; }
  async updateMetadata(id: string, metadata: BuildRun["metadata"]) { const run = this.runs.get(id); if (run) run.metadata = metadata; }
  async appendLog() {}
  async appendLogs() {}
  async logs(): Promise<LogEntry[]> { return []; }
}

const token = "a-secure-test-token-with-24-chars";
const workflow = { version: 1, name: "test", steps: [{ id: "build", run: "echo ok" }] };

describe("builder API", () => {
  test("requires bearer authentication", async () => {
    const response = await createApp(new MemoryRepository(), token).request("/v1/runs");
    expect(response.status).toBe(401);
  });

  test("reports readiness when the repository is reachable", async () => {
    const response = await createApp(new MemoryRepository(), token).request("/health/ready");
    expect(response.status).toBe(200);
  });

  test("queues valid runs and never returns secrets", async () => {
    const response = await createApp(new MemoryRepository(), token).request("/v1/runs", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ workflow, source: { repository: "https://example.com/repo.git", ref: "main" }, secrets: { TOKEN: "hidden" } }),
    });
    expect(response.status).toBe(202);
    const body = await response.json() as { data: Record<string, unknown> };
    expect(body.data.status).toBe("queued");
    expect(body.data.secrets).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("hidden");
  });

  test("honours idempotency keys", async () => {
    const repository = new MemoryRepository();
    const request = () => createApp(repository, token).request("/v1/runs", {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": "deploy-api-42" },
      body: JSON.stringify({ workflow, source: { repository: "https://example.com/repo.git", ref: "main" } }),
    });
    expect((await request()).status).toBe(202);
    expect((await request()).status).toBe(200);
    expect(repository.runs.size).toBe(1);
  });

  test("rejects malformed dependency graphs", async () => {
    const response = await createApp(new MemoryRepository(), token).request("/v1/runs", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ workflow: { ...workflow, steps: [{ id: "build", needs: ["missing"], run: "echo ok" }] }, source: { repository: "repo", ref: "main" } }),
    });
    expect(response.status).toBe(422);
  });
});
