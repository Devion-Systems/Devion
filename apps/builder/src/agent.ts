import { timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { join, resolve } from "node:path";
import { Hono } from "hono";
import { z } from "zod";
import { loadAgentConfig } from "./config.ts";
import { runProcess } from "./process.ts";

const requestSchema = z.object({
  image: z.string().min(3).max(512),
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  instanceName: z.string().regex(/^[a-z][a-z0-9-]{0,62}$/),
  mode: z.enum(["automatic", "manual"]),
  resourceTemplate: z.string().regex(/^[a-z][a-z0-9-]{0,62}$/).optional(),
  domain: z.string().optional(),
  vcpuCount: z.number().int().min(1).max(32).optional(),
  memoryMiB: z.number().int().min(128).max(65_536).optional(),
  rootfsSizeMiB: z.number().int().min(256).max(262_144).optional(),
  servicePort: z.number().int().min(1).max(65_535).optional(),
  environment: z.record(z.string(), z.string()).default({}),
  registryCredentials: z.object({ username: z.string().optional(), password: z.string().optional() }).default({}),
});
type DeployInput = z.infer<typeof requestSchema>;
const resourcesSchema = z.object({ vcpuCount: z.number().int().min(1).max(32), memoryMiB: z.number().int().min(128).max(65_536), rootfsSizeMiB: z.number().int().min(256).max(262_144) });
const settingsSchema = z.object({ defaultResources: resourcesSchema, defaultServicePort: z.number().int().min(1).max(65_535), templates: z.record(z.string(), resourcesSchema).default({}) });
type HostingSettings = z.infer<typeof settingsSchema>;

const config = loadAgentConfig();
const allowedRegistries = new Set(config.FIRECRACKER_ALLOWED_REGISTRIES.split(",").map((item) => item.trim()).filter(Boolean));
const app = new Hono();
app.get("/health/live", (c) => c.json({ status: "ok" }));
app.use("/v1/*", async (c, next) => {
  const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (token.length !== config.FIRECRACKER_AGENT_TOKEN.length || !timingSafeEqual(Buffer.from(token), Buffer.from(config.FIRECRACKER_AGENT_TOKEN))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});
app.post("/v1/deployments", async (c) => {
  const parsed = requestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid deployment request", issues: parsed.error.issues }, 422);
  try {
    const deployment = await deploy(parsed.data);
    return c.json(deployment, 201);
  } catch (error) {
    console.error("Deployment failed", error instanceof Error ? error.message : error);
    return c.json({ error: "deployment failed" }, 502);
  }
});
app.get("/v1/deployments", async (c) => c.json({ data: await readDeploymentStates() }));
app.delete("/v1/deployments/:id", async (c) => {
  const state = (await readDeploymentStates()).find((item) => item.id === c.req.param("id"));
  if (!state) return c.json({ error: "not found" }, 404);
  if (state.pid) { try { process.kill(state.pid, "SIGTERM"); } catch { /* process already exited */ } }
  await Bun.sleep(250);
  await cleanupDeployment(state, deploymentPaths(state));
  return c.json({ status: "stopped" });
});

export default { hostname: config.FIRECRACKER_AGENT_HOST, port: config.FIRECRACKER_AGENT_PORT, fetch: app.fetch };
console.log(`Firecracker host agent listening on ${config.FIRECRACKER_AGENT_HOST}:${config.FIRECRACKER_AGENT_PORT}`);

interface DeploymentState { id: string; name: string; domain: string; ip: string; port: number; pid?: number; tap?: string }
let allocationTail = Promise.resolve();

async function deploy(input: DeployInput): Promise<{ instanceId: string; url: string }> {
  const registry = input.image.split("/")[0] ?? "";
  if (!allowedRegistries.has(registry)) throw new Error("Registry is not allowed on this host");
  if ((input.registryCredentials.username && !input.registryCredentials.password) || (!input.registryCredentials.username && input.registryCredentials.password)) {
    throw new Error("Incomplete registry credentials");
  }
  const hosting = resolveHosting(input, await loadHostingSettings());
  const id = `${input.instanceName}-${crypto.randomUUID().slice(0, 8)}`;
  const imageDir = resolve(config.FIRECRACKER_IMAGE_DIR, id);
  const unpackDir = resolve(config.FIRECRACKER_IMAGE_DIR, `${id}-unpacked`);
  const rootfs = resolve(config.FIRECRACKER_ROOTFS_DIR, `${id}.ext4`);
  const socketPath = resolve(config.FIRECRACKER_SOCKET_DIR, `${id}.socket`);
  const tap = `fc${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const authFile = resolve(config.FIRECRACKER_IMAGE_DIR, `${id}-auth.json`);
  const ip = await reserveGuestIp({ id, name: input.instanceName, domain: hosting.domain, port: hosting.servicePort });
  await Promise.all([mkdir(config.FIRECRACKER_IMAGE_DIR, { recursive: true }), mkdir(config.FIRECRACKER_ROOTFS_DIR, { recursive: true }), mkdir(config.FIRECRACKER_SOCKET_DIR, { recursive: true })]);
  try {
    if (input.registryCredentials.username && input.registryCredentials.password) {
      await Bun.write(authFile, JSON.stringify({ auths: { [registry]: { auth: btoa(`${input.registryCredentials.username}:${input.registryCredentials.password}`) } } }), { mode: 0o600 });
    }
    const copy = await runProcess([
      "skopeo", "copy", ...(input.registryCredentials.username ? ["--authfile", authFile] : []),
      `docker://${repositoryOf(input.image)}@${input.digest}`, `oci:${imageDir}:image`,
    ], { cwd: config.FIRECRACKER_IMAGE_DIR });
    if (copy.exitCode !== 0) throw new Error("Unable to pull the verified OCI image");
    const unpack = await runProcess(["umoci", "unpack", "--image", `${imageDir}:image`, unpackDir], { cwd: config.FIRECRACKER_IMAGE_DIR });
    if (unpack.exitCode !== 0) throw new Error("Unable to unpack OCI image");
    const guestEnv = join(unpackDir, "rootfs", "etc", "devion-builder.env");
    await mkdir(resolve(guestEnv, ".."), { recursive: true });
    await Bun.write(guestEnv, Object.entries(input.environment).map(([key, value]) => `${key}=${value.replaceAll("\n", "\\n")}`).join("\n"), { mode: 0o600 });
    const createRootfs = await runProcess(["truncate", "-s", `${hosting.resources.rootfsSizeMiB}M`, rootfs], { cwd: config.FIRECRACKER_ROOTFS_DIR });
    if (createRootfs.exitCode !== 0) throw new Error("Unable to allocate root filesystem");
    const formatRootfs = await runProcess(["mkfs.ext4", "-F", "-d", join(unpackDir, "rootfs"), rootfs], { cwd: config.FIRECRACKER_ROOTFS_DIR });
    if (formatRootfs.exitCode !== 0) throw new Error("Unable to create root filesystem");
    const child = await startFirecracker({ id, socketPath, rootfs, tap, ip, vcpuCount: hosting.resources.vcpuCount, memoryMiB: hosting.resources.memoryMiB });
    const state = { id, name: input.instanceName, domain: hosting.domain, ip, port: hosting.servicePort, pid: child.pid, tap };
    await writeDeploymentState(state);
    await writeTraefikRoute(state);
    void child.exited.then(() => cleanupDeployment(state, { imageDir, unpackDir, rootfs, socketPath, tap })).catch(() => undefined);
    return { instanceId: id, url: `https://${hosting.domain}` };
  } catch (error) {
    await cleanup({ imageDir, unpackDir, rootfs, socketPath, tap });
    await rm(statePath(id), { force: true });
    throw error;
  } finally {
    await rm(authFile, { force: true });
  }
}

async function loadHostingSettings(): Promise<HostingSettings> {
  try {
    return settingsSchema.parse(JSON.parse(await readFile(config.FIRECRACKER_SETTINGS_FILE, "utf8")));
  } catch (error) {
    throw new Error(`Unable to load hosting settings: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function resolveHosting(input: DeployInput, settings: HostingSettings): { domain: string; servicePort: number; resources: z.infer<typeof resourcesSchema> } {
  if (input.mode === "manual") {
    if (!input.domain || !input.servicePort || !input.vcpuCount || !input.memoryMiB || !input.rootfsSizeMiB) throw new Error("Manual deployment requires domain, port, and all resource values");
    if (!input.domain.endsWith(`.${config.TRAEFIK_BASE_DOMAIN}`)) throw new Error("Manual domain must be below the configured Traefik base domain");
    return { domain: input.domain, servicePort: input.servicePort, resources: { vcpuCount: input.vcpuCount, memoryMiB: input.memoryMiB, rootfsSizeMiB: input.rootfsSizeMiB } };
  }
  const resources = input.resourceTemplate ? settings.templates[input.resourceTemplate] : settings.defaultResources;
  if (!resources) throw new Error(`Unknown resource template: ${input.resourceTemplate}`);
  return { domain: `${input.instanceName}.${config.TRAEFIK_BASE_DOMAIN}`, servicePort: input.servicePort ?? settings.defaultServicePort, resources };
}

async function startFirecracker(input: { id: string; socketPath: string; rootfs: string; tap: string; ip: string; vcpuCount: number; memoryMiB: number }): Promise<ReturnType<typeof Bun.spawn>> {
  await runRequired(["ip", "tuntap", "add", "dev", input.tap, "mode", "tap"]);
  await runRequired(["ip", "link", "set", input.tap, "master", config.FIRECRACKER_TAP_BRIDGE]);
  await runRequired(["ip", "link", "set", input.tap, "up"]);
  const child = Bun.spawn([config.FIRECRACKER_BINARY_PATH, "--api-sock", input.socketPath], { stdout: "ignore", stderr: "ignore" });
  try {
    await waitForSocket(input.socketPath);
    await firecrackerRequest(input.socketPath, "PUT", "/machine-config", { vcpu_count: input.vcpuCount, mem_size_mib: input.memoryMiB });
    await firecrackerRequest(input.socketPath, "PUT", "/boot-source", { kernel_image_path: config.FIRECRACKER_KERNEL_PATH, boot_args: `${config.FIRECRACKER_BOOT_ARGS} ip=${input.ip}::${config.FIRECRACKER_GUEST_GATEWAY}:255.255.255.0::eth0:off` });
    await firecrackerRequest(input.socketPath, "PUT", "/drives/rootfs", { drive_id: "rootfs", path_on_host: input.rootfs, is_root_device: true, is_read_only: false });
    await firecrackerRequest(input.socketPath, "PUT", "/network-interfaces/eth0", { iface_id: "eth0", host_dev_name: input.tap, guest_mac: randomMac() });
    await firecrackerRequest(input.socketPath, "PUT", "/actions", { action_type: "InstanceStart" });
    return child;
  } catch (error) {
    child.kill();
    throw error;
  }
}

async function firecrackerRequest(socketPath: string, method: string, path: string, body: unknown): Promise<void> {
  await new Promise<void>((resolveRequest, reject) => {
    const req = httpRequest({ socketPath, method, path, headers: { "content-type": "application/json" } }, (response) => {
      response.resume();
      response.on("end", () => response.statusCode && response.statusCode < 300 ? resolveRequest() : reject(new Error(`Firecracker API ${response.statusCode ?? 0}`)));
    });
    req.on("error", reject); req.end(JSON.stringify(body));
  });
}

async function waitForSocket(path: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await stat(path)).isSocket()) return; } catch { /* waiting for Firecracker */ }
    await Bun.sleep(100);
  }
  throw new Error("Timed out waiting for Firecracker socket");
}

async function runRequired(command: string[]): Promise<void> {
  const result = await runProcess(command, { cwd: config.FIRECRACKER_IMAGE_DIR });
  if (result.exitCode !== 0) throw new Error(`Host command failed: ${command[0]}`);
}

async function cleanup(paths: { imageDir?: string; unpackDir?: string; rootfs?: string; socketPath?: string; tap?: string }): Promise<void> {
  if (paths.tap) await runProcess(["ip", "link", "delete", paths.tap], { cwd: config.FIRECRACKER_IMAGE_DIR }).catch(() => undefined);
  await Promise.all([paths.imageDir, paths.unpackDir, paths.rootfs, paths.socketPath].filter((value): value is string => Boolean(value)).map((path) => rm(path, { recursive: true, force: true })));
}

async function reserveGuestIp(state: Omit<DeploymentState, "ip">): Promise<string> {
  let release: (() => void) | undefined;
  const previous = allocationTail;
  allocationTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    await mkdir(config.FIRECRACKER_STATE_DIR, { recursive: true });
    const states = await readDeploymentStates();
    const used = new Set(states.map((item) => item.ip));
    for (let host = 2; host < 255; host++) {
      const ip = `${config.FIRECRACKER_GUEST_IP_PREFIX}.${host}`;
      if (used.has(ip)) continue;
      await writeDeploymentState({ ...state, ip });
      return ip;
    }
    throw new Error("Firecracker guest IP pool is exhausted");
  } finally {
    release?.();
  }
}

async function readDeploymentStates(): Promise<DeploymentState[]> {
  try {
    const files = await readdir(config.FIRECRACKER_STATE_DIR);
    const values = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => {
      try { return JSON.parse(await readFile(join(config.FIRECRACKER_STATE_DIR, file), "utf8")) as DeploymentState; } catch { return null; }
    }));
    return values.filter((value): value is DeploymentState => value !== null);
  } catch { return []; }
}

function statePath(id: string): string { return join(config.FIRECRACKER_STATE_DIR, `${id}.json`); }
function routePath(name: string): string { return join(config.TRAEFIK_DYNAMIC_CONFIG_DIR, `firecracker-${name}.yml`); }

async function writeDeploymentState(state: DeploymentState): Promise<void> {
  await mkdir(config.FIRECRACKER_STATE_DIR, { recursive: true });
  const destination = statePath(state.id);
  const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
  await Bun.write(temporary, JSON.stringify(state));
  await rename(temporary, destination);
}

async function writeTraefikRoute(state: DeploymentState): Promise<void> {
  await mkdir(config.TRAEFIK_DYNAMIC_CONFIG_DIR, { recursive: true });
  const service = `firecracker-${state.name}`;
  const destination = routePath(state.name);
  const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
  const configFile = `# deployment-id: ${state.id}
http:
  routers:
    ${service}:
      rule: "Host(\`${state.domain}\`)"
      entryPoints:
        - websecure
      tls:
        certResolver: ${config.TRAEFIK_CERT_RESOLVER}
      service: ${service}
  services:
    ${service}:
      loadBalancer:
        servers:
          - url: "http://${state.ip}:${state.port}"
`;
  await Bun.write(temporary, configFile, { mode: 0o640 });
  await rename(temporary, destination);
}

async function cleanupDeployment(state: DeploymentState, paths: { imageDir: string; unpackDir: string; rootfs: string; socketPath: string; tap: string }): Promise<void> {
  await cleanup(paths);
  try {
    const current = JSON.parse(await readFile(statePath(state.id), "utf8")) as DeploymentState;
    if (current.id !== state.id) return;
    await rm(statePath(state.id), { force: true });
    const route = routePath(state.name);
    const routeContent = await readFile(route, "utf8").catch(() => "");
    if (routeContent.startsWith(`# deployment-id: ${state.id}\n`)) await rm(route, { force: true });
  } catch { /* state was replaced or already removed */ }
}

function deploymentPaths(state: DeploymentState): { imageDir: string; unpackDir: string; rootfs: string; socketPath: string; tap: string } {
  return {
    imageDir: resolve(config.FIRECRACKER_IMAGE_DIR, state.id),
    unpackDir: resolve(config.FIRECRACKER_IMAGE_DIR, `${state.id}-unpacked`),
    rootfs: resolve(config.FIRECRACKER_ROOTFS_DIR, `${state.id}.ext4`),
    socketPath: resolve(config.FIRECRACKER_SOCKET_DIR, `${state.id}.socket`),
    tap: state.tap ?? "",
  };
}

function randomMac(): string { return [0x02, 0, 0, ...crypto.getRandomValues(new Uint8Array(3))].map((part) => part.toString(16).padStart(2, "0")).join(":"); }

function repositoryOf(image: string): string {
  const digest = image.indexOf("@");
  if (digest >= 0) return image.slice(0, digest);
  const slash = image.lastIndexOf("/");
  const tag = image.lastIndexOf(":");
  return tag > slash ? image.slice(0, tag) : image;
}
