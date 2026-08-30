import { mkdir, readFile, statfs, writeFile } from "node:fs/promises";
import { cpus, freemem, hostname, totalmem } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { ContainerRuntime } from "./runtime/container-runtime.js";
import { volumeMountsPayload } from "./runtime/volume-policy.js";

const config = loadConfig();
const identityPath = join(config.DEVION_AGENT_DATA_DIR, "identity.json");
const identitySchema = z.object({ nodeId: z.string().uuid(), agentToken: z.string().min(32) });
const commandSchema = z.object({
  commandId: z.string().uuid(),
  type: z.enum([
    "workload.start",
    "workload.stop",
    "workload.restart",
    "workload.delete",
    "image.pull",
    "volume.create",
    "volume.delete",
    "volume.attach",
    "volume.detach",
    "runtime.inspect",
    "workload.logs",
    "minecraft.command",
    "minecraft.logs",
    "minecraft.files.list",
    "minecraft.files.read",
    "minecraft.files.write",
  ]),
  resourceId: z.string().uuid(),
  payload: z.unknown(),
});
const startPayload = z.object({
  workloadId: z.string().uuid(),
  image: z.string().min(1),
  runtime: z.literal("container"),
  requirements: z.object({
    cpuMilli: z.number().int().positive(),
    memoryMib: z.number().int().positive(),
  }),
  runtimeConfig: z
    .object({
      environment: z.record(z.string()).optional(),
      ports: z
        .array(
          z.object({
            containerPort: z.number().int().min(1).max(65_535),
            protocol: z.enum(["tcp", "udp"]).optional(),
            exposure: z.enum(["private", "public"]).optional(),
            externalPort: z.number().int().min(1).max(65_535).optional(),
          }),
        )
        .optional(),
      volumes: volumeMountsPayload.optional(),
      restartPolicy: z.enum(["no", "on-failure", "always", "unless-stopped"]).optional(),
      gracefulShutdownSeconds: z.number().int().min(1).max(600).optional(),
      registryCredentialReference: z.string().uuid().optional(),
      command: z.string().min(1).max(2_000).optional(),
      workingDirectory: z.string().min(1).max(512).optional(),
      healthCheck: z.object({ command: z.string().min(1).max(2_000), intervalSeconds: z.number().int().min(1).max(3_600), timeoutSeconds: z.number().int().min(1).max(600), retries: z.number().int().min(1).max(20), startPeriodSeconds: z.number().int().min(0).max(3_600) }).optional(),
    })
    .default({}),
});
const runtime = new ContainerRuntime(config.DOCKER_SOCKET_PATH, config.DEVION_AGENT_REQUEST_TIMEOUT_MS);
const minecraftCommandPayload = z.object({ command: z.string().trim().min(1).max(1_024) });
const minecraftLogsPayload = z.object({ tail: z.number().int().min(1).max(2_000).default(500) });
const minecraftFilePath = z.string().min(1).max(240).refine(
  (path) => !path.startsWith("/") && !path.split("/").some((part) => part === "." || part === ".." || part === ""),
  "Path must stay within the Minecraft data directory",
);
const minecraftFileReadPayload = z.object({ path: minecraftFilePath });
const minecraftFileWritePayload = z.object({ path: minecraftFilePath, content: z.string().max(512 * 1024) });
const volumeDeletePayload = z.object({ runtimeName: z.string().regex(/^devion-v-[a-f0-9]{32}$/) });
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Bounds every control-plane call so a hung connection cannot stall the agent forever. */
async function apiFetch(input: URL | string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.DEVION_AGENT_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function loadIdentity() {
  try {
    return { identity: identitySchema.parse(JSON.parse(await readFile(identityPath, "utf8"))), enrolled: false };
  } catch {
    const registrationToken = config.DEVION_AGENT_REGISTRATION_TOKEN;
    const localToken = config.DEVION_LOCAL_AGENT_TOKEN;
    if (!registrationToken && !localToken) return null;
    const response = await apiFetch(new URL(registrationToken ? "/api/agents/register" : "/api/agents/local/register", config.DEVION_API_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(registrationToken ? { registrationToken } : { localToken }),
        name: config.DEVION_AGENT_NAME,
        hostname: config.DEVION_AGENT_HOSTNAME,
        ...(config.DEVION_AGENT_ADVERTISED_ADDRESS ? { advertisedAddress: config.DEVION_AGENT_ADVERTISED_ADDRESS } : {}),
        architecture: config.DEVION_AGENT_ARCHITECTURE,
        os: config.DEVION_AGENT_OS,
        agentVersion: "0.1.0",
        runtimes: ["container"],
      }),
    });
    if (!response.ok) throw new Error(`Agent registration failed: ${response.status}`);
    const identity = identitySchema.parse(await response.json());
    await mkdir(config.DEVION_AGENT_DATA_DIR, { recursive: true });
    await writeFile(identityPath, JSON.stringify(identity), { mode: 0o600 });
    return { identity, enrolled: true };
  }
}

/** A resident Compose agent waits for the one-shot enrollment command. */
async function resolveIdentity() {
  for (;;) {
    try {
      const loaded = await loadIdentity();
      if (loaded) return loaded;
      console.log("Devion Agent is waiting for enrollment. Create a token in Hardware > Node verbinden.");
    } catch (error) {
      console.error("Agent enrollment failed; retrying", error);
    }
    await wait(5_000);
  }
}

async function resources() {
  const cpuMilli = cpus().length * 1_000;
  const memoryMib = Math.floor(totalmem() / 1024 / 1024);
  let storageMib = { capacity: 0, allocatable: 0, reserved: 0, usage: 0 };
  try {
    const filesystem = await statfs(config.DEVION_AGENT_DATA_DIR);
    const blockSize = filesystem.bsize;
    const capacity = Math.floor((filesystem.blocks * blockSize) / 1024 / 1024);
    const available = Math.floor((filesystem.bavail * blockSize) / 1024 / 1024);
    storageMib = { capacity, allocatable: available, reserved: 0, usage: capacity - available };
  } catch {
    // The agent remains useful on platforms where filesystem statistics are unavailable.
  }
  return {
    cpuMilli: { capacity: cpuMilli, allocatable: cpuMilli, reserved: 0, usage: 0 },
    memoryMib: {
      capacity: memoryMib,
      allocatable: memoryMib,
      reserved: 0,
      usage: Math.floor((totalmem() - freemem()) / 1024 / 1024),
    },
    storageMib,
  };
}

async function report(
  identity: z.infer<typeof identitySchema>,
  commandId: string,
  status: "succeeded" | "failed",
  data?: unknown,
  error?: { code: string; message: string },
) {
  await apiFetch(new URL("/api/agents/commands/results", config.DEVION_API_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${identity.agentToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      commandId,
      status,
      ...(data === undefined ? {} : { data }),
      ...(error ? { error } : {}),
    }),
  });
}

async function workloadSecrets(identity: z.infer<typeof identitySchema>, workloadId: string): Promise<Record<string, string>> {
  const response = await apiFetch(new URL(`/api/agents/workloads/${workloadId}/secrets`, config.DEVION_API_URL), {
    headers: { authorization: `Bearer ${identity.agentToken}` },
  });
  if (!response.ok) throw new Error(`Workload secret retrieval failed: ${response.status}`);
  const payload = z.object({ environment: z.record(z.string()) }).parse(await response.json());
  return payload.environment;
}

async function workloadRegistryCredentials(identity: z.infer<typeof identitySchema>, workloadId: string): Promise<{ username: string; password: string } | undefined> {
  const response = await apiFetch(new URL(`/api/agents/workloads/${workloadId}/registry-credentials`, config.DEVION_API_URL), { headers: { authorization: `Bearer ${identity.agentToken}` } });
  if (!response.ok) throw new Error(`Registry credential retrieval failed: ${response.status}`);
  const payload = z.object({ credentials: z.object({ username: z.string().min(1), password: z.string().min(1) }).nullable() }).parse(await response.json());
  return payload.credentials ?? undefined;
}

const assignmentSchema = z.object({ workloadId: z.string().uuid(), cpuMilli: z.number().int().positive(), reportGeneration: z.number().int().positive() });
type Assignment = z.infer<typeof assignmentSchema>;
const previousCpu = new Map<string, { timestamp: number; totalUsageNanos: number }>();
let lastMetricsReportAt = 0;
let lastPortReportAt = 0;
let tickInFlight = false;

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]!);
    }
  }));
  return results;
}

async function workloadAssignments(identity: z.infer<typeof identitySchema>): Promise<Assignment[]> {
  const response = await apiFetch(new URL("/api/agents/workloads", config.DEVION_API_URL), { headers: { authorization: `Bearer ${identity.agentToken}` } });
  if (!response.ok) throw new Error(`Workload listing failed: ${response.status}`);
  return z.array(assignmentSchema).parse(await response.json());
}

async function reportWorkloadTelemetry(identity: z.infer<typeof identitySchema>, assignments: Assignment[]): Promise<void> {
  const includePorts = Date.now() - lastPortReportAt >= config.DEVION_AGENT_METRICS_INTERVAL_MS;
  const reports = await mapWithConcurrency(assignments, 8, async ({ workloadId, reportGeneration }) => {
    const inspection = await runtime.inspect(workloadId);
    return { workloadId, reportGeneration, actualState: inspection.actualState, healthStatus: inspection.healthStatus, observedAt: new Date().toISOString(), ...(inspection.healthMessage ? { healthMessage: inspection.healthMessage } : {}), ...(includePorts ? { ports: inspection.ports } : {}) };
  });
  const accepted = await apiFetch(new URL("/api/agents/workloads/telemetry", config.DEVION_API_URL), { method: "POST", headers: { authorization: `Bearer ${identity.agentToken}`, "content-type": "application/json" }, body: JSON.stringify({ reports }) });
  if (!accepted.ok) throw new Error(`Workload telemetry report failed: ${accepted.status}`);
  if (includePorts) lastPortReportAt = Date.now();
}

async function reportWorkloadMetrics(identity: z.infer<typeof identitySchema>, assignments: Assignment[]): Promise<void> {
  const now = Date.now();
  if (now - lastMetricsReportAt < config.DEVION_AGENT_METRICS_INTERVAL_MS) return;
  const assignedWorkloads = new Set(assignments.map((assignment) => assignment.workloadId));
  for (const workloadId of previousCpu.keys()) {
    if (!assignedWorkloads.has(workloadId)) previousCpu.delete(workloadId);
  }
  const samples = (await mapWithConcurrency(assignments, 8, async (assignment) => {
    const stats = await runtime.metrics(assignment.workloadId);
    if (!stats) return null;
    const previous = previousCpu.get(assignment.workloadId);
    previousCpu.set(assignment.workloadId, { timestamp: now, totalUsageNanos: stats.cpuTotalUsageNanos });
    const elapsedNanos = previous ? (now - previous.timestamp) * 1_000_000 : 0;
    const usedNanos = previous ? Math.max(0, stats.cpuTotalUsageNanos - previous.totalUsageNanos) : 0;
    const cpuUsagePercent = previous && elapsedNanos > 0
      ? Math.max(0, (usedNanos / elapsedNanos) / (assignment.cpuMilli / 1_000) * 100)
      : null;
    return { workloadId: assignment.workloadId, recordedAt: new Date(now).toISOString(), cpuUsagePercent, memoryUsageBytes: stats.memoryUsageBytes, memoryLimitBytes: stats.memoryLimitBytes, networkRxBytes: stats.networkRxBytes, networkTxBytes: stats.networkTxBytes, diskReadBytes: stats.diskReadBytes, diskWriteBytes: stats.diskWriteBytes };
  })).filter((sample): sample is NonNullable<typeof sample> => sample !== null);
  if (samples.length === 0) {
    lastMetricsReportAt = Date.now();
    return;
  }
  const accepted = await apiFetch(new URL("/api/agents/workloads/metrics", config.DEVION_API_URL), { method: "POST", headers: { authorization: `Bearer ${identity.agentToken}`, "content-type": "application/json" }, body: JSON.stringify({ samples }) });
  if (!accepted.ok) throw new Error(`Workload metrics report failed: ${accepted.status}`);
  lastMetricsReportAt = Date.now();
}

async function execute(identity: z.infer<typeof identitySchema>, raw: unknown): Promise<void> {
  const command = commandSchema.parse(raw);
  try {
    if (command.type === "workload.start") {
      const payload = startPayload.parse(command.payload);
      const secrets = await workloadSecrets(identity, payload.workloadId);
      const registryCredentials = payload.runtimeConfig.registryCredentialReference ? await workloadRegistryCredentials(identity, payload.workloadId) : undefined;
      const { registryCredentialReference: _, ...runtimeConfig } = payload.runtimeConfig;
      const started = await runtime.start({
        workloadId: payload.workloadId,
        image: payload.image,
        cpuMilli: payload.requirements.cpuMilli,
        memoryMib: payload.requirements.memoryMib,
        ...runtimeConfig,
        ...(registryCredentials ? { registryCredentials } : {}),
        environment: { ...runtimeConfig.environment, ...secrets },
      });
      await report(identity, command.commandId, "succeeded", started);
      return;
    }
    if (command.type === "workload.stop") {
      const stop = z.object({ gracefulShutdownSeconds: z.number().int().min(1).max(600).optional() }).safeParse(command.payload);
      await runtime.stop(command.resourceId, stop.success ? stop.data.gracefulShutdownSeconds : undefined);
      await report(identity, command.commandId, "succeeded");
      return;
    }
    if (command.type === "workload.delete") {
      await runtime.remove(command.resourceId);
      await report(identity, command.commandId, "succeeded");
      return;
    }
    if (command.type === "volume.delete") {
      const payload = volumeDeletePayload.parse(command.payload);
      await runtime.removeVolume(payload.runtimeName);
      await report(identity, command.commandId, "succeeded");
      return;
    }
    if (command.type === "minecraft.command") {
      const payload = minecraftCommandPayload.parse(command.payload);
      const output = await runtime.minecraftCommand(command.resourceId, payload.command);
      await report(identity, command.commandId, "succeeded", { output });
      return;
    }
    if (command.type === "minecraft.logs") {
      const payload = minecraftLogsPayload.parse(command.payload);
      const logs = await runtime.logs(command.resourceId, payload.tail);
      await report(identity, command.commandId, "succeeded", { logs });
      return;
    }
    if (command.type === "workload.logs") {
      const payload = minecraftLogsPayload.parse(command.payload);
      await report(identity, command.commandId, "succeeded", { logs: await runtime.logs(command.resourceId, payload.tail) });
      return;
    }
    if (command.type === "minecraft.files.list") {
      await report(identity, command.commandId, "succeeded", { entries: await runtime.minecraftFiles(command.resourceId) });
      return;
    }
    if (command.type === "minecraft.files.read") {
      const payload = minecraftFileReadPayload.parse(command.payload);
      await report(identity, command.commandId, "succeeded", { content: await runtime.minecraftFileRead(command.resourceId, payload.path) });
      return;
    }
    if (command.type === "minecraft.files.write") {
      const payload = minecraftFileWritePayload.parse(command.payload);
      await runtime.minecraftFileWrite(command.resourceId, payload.path, payload.content);
      await report(identity, command.commandId, "succeeded");
      return;
    }
    await report(identity, command.commandId, "failed", undefined, {
      code: "UNSUPPORTED_COMMAND",
      message: `Unsupported command type: ${command.type}`,
    });
  } catch (error) {
    await report(identity, command.commandId, "failed", undefined, {
      code: "RUNTIME_ERROR",
      message: error instanceof Error ? error.message : "Runtime command failed",
    });
  }
}

async function tick(identity: z.infer<typeof identitySchema>): Promise<void> {
  await apiFetch(new URL("/api/agents/heartbeat", config.DEVION_API_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${identity.agentToken}`, "content-type": "application/json" },
    body: JSON.stringify({ status: "ready", resources: await resources() }),
  });
  const response = await apiFetch(new URL("/api/agents/commands", config.DEVION_API_URL), {
    headers: { authorization: `Bearer ${identity.agentToken}` },
  });
  if (!response.ok) throw new Error(`Command poll failed: ${response.status}`);
  for (const command of z.array(z.unknown()).parse(await response.json()))
    await execute(identity, command);
  const assignments = await workloadAssignments(identity);
  await reportWorkloadTelemetry(identity, assignments);
  // Stats are an independent, best-effort telemetry channel; a Docker stats
  // failure must not interrupt heartbeat, command processing, or deployment.
  try { await reportWorkloadMetrics(identity, assignments); }
  catch (error) { console.error("Workload metrics report failed", error); }
}

const { identity, enrolled } = await resolveIdentity();
if (config.DEVION_AGENT_ENROLLMENT_ONLY && enrolled) {
  console.log(`Devion Agent ${identity.nodeId} enrolled successfully.`);
  process.exit(0);
}
console.log(`Devion Agent ${identity.nodeId} connected from ${hostname()}`);
async function runTick(identity: z.infer<typeof identitySchema>): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try { await tick(identity); }
  catch (error) { console.error("Agent tick failed", error); }
  finally { tickInFlight = false; }
}

await runTick(identity);
setInterval(() => void runTick(identity), config.DEVION_AGENT_POLL_INTERVAL_MS);
