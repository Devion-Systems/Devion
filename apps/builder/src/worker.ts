import { mkdir } from "node:fs/promises";
import { loadConfig } from "./config.ts";
import { WorkflowExecutor } from "./executor.ts";
import { LogBuffer } from "./log-buffer.ts";
import { connect, PostgresRunRepository } from "./postgres.ts";
import type { RunRepository } from "./repository.ts";

const config = loadConfig();
await mkdir(config.BUILDER_WORKDIR, { recursive: true });
const repository = new PostgresRunRepository(connect(config.DATABASE_URL), config.BUILDER_SECRET_ENCRYPTION_KEY);
await repository.migrate();
const logBuffer = new LogBuffer(repository);
const bufferedRepository = new Proxy(repository, {
  get(target, property, receiver) {
    if (property === "appendLog") {
      return (runId: string, stepId: string | null, stream: "system" | "stdout" | "stderr", message: string) => {
        logBuffer.append({ runId, stepId, stream, message });
        return Promise.resolve();
      };
    }
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as RunRepository;
const executor = new WorkflowExecutor({
  repository: bufferedRepository,
  workdir: config.BUILDER_WORKDIR,
  buildkitAddress: config.BUILDKIT_ADDRESS,
  ...(config.FIRECRACKER_AGENT_URL ? { firecrackerAgentUrl: config.FIRECRACKER_AGENT_URL } : {}),
});
console.log(`Devion Builder worker ${config.WORKER_ID} started with ${config.WORKER_CONCURRENCY} slots`);

async function work(slot: number): Promise<never> {
  const workerId = `${config.WORKER_ID}:${slot}`;
  while (true) {
    await repository.recoverExpiredLeases();
    const run = await repository.claim(workerId, config.WORKER_LEASE_SECONDS);
    if (!run) { await Bun.sleep(config.WORKER_POLL_MS); continue; }
    const controller = new AbortController();
    const cancellationPoll = setInterval(async () => { if ((await repository.get(run.id))?.cancelRequested) controller.abort(); }, 500);
    const heartbeat = setInterval(async () => {
      if (!(await repository.heartbeat(run.id, workerId, config.WORKER_LEASE_SECONDS))) controller.abort();
    }, Math.max(10_000, (config.WORKER_LEASE_SECONDS * 1000) / 3));
    try {
      await executor.execute(run, controller.signal);
      await logBuffer.flush();
      await repository.complete(run.id, workerId);
    } catch (error) {
      await logBuffer.flush();
      await repository.fail(run.id, workerId, error instanceof Error ? error.message : String(error));
    } finally {
      clearInterval(cancellationPoll);
      clearInterval(heartbeat);
    }
  }
}

await Promise.all(Array.from({ length: config.WORKER_CONCURRENCY }, (_, index) => work(index + 1)));
