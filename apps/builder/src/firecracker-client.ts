import type { RegistryCredentials } from "./registry.ts";

export interface DeployRequest {
  image: string;
  digest: string;
  instanceName: string;
  mode: "automatic" | "manual";
  resourceTemplate?: string;
  domain?: string;
  vcpuCount?: number;
  memoryMiB?: number;
  rootfsSizeMiB?: number;
  servicePort?: number;
  environment: Record<string, string>;
  registryCredentials: RegistryCredentials;
}

export async function deployToFirecracker(agentUrl: string, token: string, request: DeployRequest): Promise<{ instanceId: string; url: string }> {
  const url = new URL("/v1/deployments", agentUrl);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("Firecracker agent URL must use HTTPS outside local development");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Firecracker agent deployment failed with ${response.status}`);
  return await response.json() as { instanceId: string; url: string };
}
