import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3010),
  DATABASE_URL: z.string().min(1),
  BUILDER_API_TOKEN: z.string().min(24),
  BUILDKIT_ADDRESS: z.string().min(1).default("tcp://buildkit:1234"),
  BUILDER_WORKDIR: z.string().min(1).default("/tmp/devion-builder"),
  FIRECRACKER_AGENT_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().default(""),
  WORKER_ID: z.string().min(1).default(() => crypto.randomUUID()),
  WORKER_POLL_MS: z.coerce.number().int().min(100).max(60_000).default(1000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
  WORKER_LEASE_SECONDS: z.coerce.number().int().min(30).max(3_600).default(120),
});

export type Config = z.infer<typeof configSchema>;
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return configSchema.parse(env);
}

const agentConfigSchema = z.object({
  FIRECRACKER_AGENT_PORT: z.coerce.number().int().min(1).max(65535).default(3020),
  FIRECRACKER_AGENT_HOST: z.string().min(1).default("127.0.0.1"),
  FIRECRACKER_AGENT_TOKEN: z.string().min(24),
  FIRECRACKER_BINARY_PATH: z.string().min(1).default("/usr/bin/firecracker"),
  FIRECRACKER_KERNEL_PATH: z.string().min(1),
  FIRECRACKER_SOCKET_DIR: z.string().min(1).default("/run/devion-builder/firecracker"),
  FIRECRACKER_ROOTFS_DIR: z.string().min(1).default("/var/lib/devion-builder/rootfs"),
  FIRECRACKER_IMAGE_DIR: z.string().min(1).default("/var/lib/devion-builder/images"),
  FIRECRACKER_TAP_BRIDGE: z.string().min(1).default("br0"),
  FIRECRACKER_BOOT_ARGS: z.string().min(1).default("console=ttyS0 reboot=k panic=1 pci=off"),
  FIRECRACKER_ALLOWED_REGISTRIES: z.string().min(1),
  FIRECRACKER_GUEST_IP_PREFIX: z.string().regex(/^\d{1,3}(?:\.\d{1,3}){2}$/),
  FIRECRACKER_GUEST_GATEWAY: z.string().regex(/^\d{1,3}(?:\.\d{1,3}){3}$/),
  FIRECRACKER_STATE_DIR: z.string().min(1).default("/var/lib/devion-builder/state"),
  FIRECRACKER_SETTINGS_FILE: z.string().min(1).default("/etc/devion-builder/hosting-settings.json"),
  TRAEFIK_DYNAMIC_CONFIG_DIR: z.string().min(1),
  TRAEFIK_BASE_DOMAIN: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/),
  TRAEFIK_CERT_RESOLVER: z.string().min(1).default("le-kunden"),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;
export function loadAgentConfig(env: Record<string, string | undefined> = process.env): AgentConfig {
  return agentConfigSchema.parse(env);
}
