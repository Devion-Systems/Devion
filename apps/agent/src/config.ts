import { hostname } from "node:os";
import { z } from "zod";

const schema = z.object({
  DEVION_API_URL: z.string().url(),
  DEVION_AGENT_DATA_DIR: z.string().min(1).default("/var/lib/devion-agent"),
  DEVION_AGENT_REGISTRATION_TOKEN: z.string().min(32).optional(),
  DEVION_LOCAL_AGENT_TOKEN: z.string().min(32).optional(),
  DEVION_AGENT_NAME: z.string().min(1).max(100).default(hostname()),
  DEVION_AGENT_HOSTNAME: z.string().min(1).max(253).default(hostname()),
  // Explicitly supplied by the operator. Never derive this from hostname or
  // Docker networking because Traefik may run on another host.
  DEVION_AGENT_ADVERTISED_ADDRESS: z.string().min(1).max(253).optional(),
  DEVION_AGENT_ARCHITECTURE: z.string().min(1).max(64).default(process.arch),
  DEVION_AGENT_OS: z.string().min(1).max(128).default(process.platform),
  DEVION_AGENT_POLL_INTERVAL_MS: z.coerce.number().int().min(500).max(60_000).default(5_000),
  DEVION_AGENT_METRICS_INTERVAL_MS: z.coerce.number().int().min(5_000).max(300_000).default(30_000),
  DEVION_AGENT_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  // The compose bootstrap command uses this to enrol once without starting a
  // second long-running worker next to the resident agent.
  DEVION_AGENT_ENROLLMENT_ONLY: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  DOCKER_SOCKET_PATH: z.string().min(1).default("/var/run/docker.sock"),
});

export type AgentConfig = z.infer<typeof schema>;
export function loadConfig(env: Record<string, string | undefined> = process.env): AgentConfig {
  return schema.parse(env);
}
