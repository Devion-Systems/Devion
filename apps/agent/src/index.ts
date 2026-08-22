import { mkdir, readFile, statfs, writeFile } from "node:fs/promises";
import { cpus, freemem, hostname, totalmem } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { ContainerRuntime } from "./runtime/container-runtime.js";

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
          }),
        )
        .optional(),
      volumes: z
        .array(
          z.object({
            name: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/),
            target: z.string().startsWith("/"),
          }),
        )
        .optional(),
    })
    .default({}),
});
const runtime = new ContainerRuntime(config.DOCKER_SOCKET_PATH);
const minecraftCommandPayload = z.object({ command: z.string().trim().min(1).max(1_024) });
const minecraftLogsPayload = z.object({ tail: z.number().int().min(1).max(2_000).default(500) });
const minecraftFilePath = z.string().min(1).max(240).refine(
  (path) => !path.startsWith("/") && !path.split("/").some((part) => part === "." || part === ".." || part === ""),
  "Path must stay within the Minecraft data directory",
);
const minecraftFileReadPayload = z.object({ path: minecraftFilePath });
const minecraftFileWritePayload = z.object({ path: minecraftFilePath, content: z.string().max(512 * 1024) });
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function loadIdentity() {
  try {
    return { identity: identitySchema.parse(JSON.parse(await readFile(identityPath, "utf8"))), enrolled: false };
  } catch {
    if (!config.DEVION_AGENT_REGISTRATION_TOKEN) return null;
    const response = await fetch(new URL("/api/agents/register", config.DEVION_API_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        registrationToken: config.DEVION_AGENT_REGISTRATION_TOKEN,
        name: config.DEVION_AGENT_NAME,
        hostname: config.DEVION_AGENT_HOSTNAME,
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
  await fetch(new URL("/api/agents/commands/results", config.DEVION_API_URL), {
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

async function execute(identity: z.infer<typeof identitySchema>, raw: unknown): Promise<void> {
  const command = commandSchema.parse(raw);
  try {
    if (command.type === "workload.start") {
      const payload = startPayload.parse(command.payload);
      const started = await runtime.start({
        workloadId: payload.workloadId,
        image: payload.image,
        cpuMilli: payload.requirements.cpuMilli,
        memoryMib: payload.requirements.memoryMib,
        ...payload.runtimeConfig,
      });
      await report(identity, command.commandId, "succeeded", started);
      return;
    }
    if (command.type === "workload.stop") {
      await runtime.stop(command.resourceId);
      await report(identity, command.commandId, "succeeded");
      return;
    }
    if (command.type === "workload.delete") {
      await runtime.remove(command.resourceId);
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
  await fetch(new URL("/api/agents/heartbeat", config.DEVION_API_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${identity.agentToken}`, "content-type": "application/json" },
    body: JSON.stringify({ status: "ready", resources: await resources() }),
  });
  const response = await fetch(new URL("/api/agents/commands", config.DEVION_API_URL), {
    headers: { authorization: `Bearer ${identity.agentToken}` },
  });
  if (!response.ok) throw new Error(`Command poll failed: ${response.status}`);
  for (const command of z.array(z.unknown()).parse(await response.json()))
    await execute(identity, command);
}

const { identity, enrolled } = await resolveIdentity();
if (config.DEVION_AGENT_ENROLLMENT_ONLY && enrolled) {
  console.log(`Devion Agent ${identity.nodeId} enrolled successfully.`);
  process.exit(0);
}
console.log(`Devion Agent ${identity.nodeId} connected from ${hostname()}`);
await tick(identity);
setInterval(
  () => void tick(identity).catch((error) => console.error("Agent tick failed", error)),
  config.DEVION_AGENT_POLL_INTERVAL_MS,
);
