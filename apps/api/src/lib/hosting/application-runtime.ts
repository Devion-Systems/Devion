import http from "node:http";

const socketPath = process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
const network = process.env.APPLICATION_DOCKER_NETWORK ?? "devion";
type DockerContainer = { State?: { Running?: boolean; Status?: string; Health?: { Status?: string } }; NetworkSettings?: { Ports?: Record<string, Array<{ HostPort: string }> | null> } };

function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({ socketPath, method, path: `/v1.45${path}`, headers: payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : undefined }, (res) => { let output = ""; res.setEncoding("utf8"); res.on("data", (chunk) => output += chunk); res.on("end", () => { if ((res.statusCode ?? 500) >= 300) return reject(new Error(`Docker API ${res.statusCode}: ${output || "request failed"}`)); try { resolve(output ? JSON.parse(output) as T : undefined as T); } catch { resolve(output as T); } }); });
    req.on("error", reject); if (payload) req.write(payload); req.end();
  });
}

export class ApplicationRuntime {
  async deploy(input: { containerName: string; imageName: string; internalPort: number; labels: Record<string, string> }) {
    await this.removeIfPresent(input.containerName);
    await request("POST", `/images/create?fromImage=${encodeURIComponent(input.imageName)}`);
    await request("POST", `/containers/create?name=${encodeURIComponent(input.containerName)}`, { Image: input.imageName, Labels: { ...input.labels, "devion.managed": "true", "devion.kind": "application" }, ExposedPorts: { [`${input.internalPort}/tcp`]: {} }, HostConfig: { RestartPolicy: { Name: "unless-stopped" } }, NetworkingConfig: { EndpointsConfig: { [network]: {} } } });
    await request("POST", `/containers/${encodeURIComponent(input.containerName)}/start`);
    return this.status(input.containerName);
  }
  async stop(containerName: string) { await request("POST", `/containers/${encodeURIComponent(containerName)}/stop?t=15`); return this.status(containerName); }
  async remove(containerName: string) { await this.removeIfPresent(containerName); }
  async deployMinecraft(input: { containerName: string; name: string; version: string; memoryMib: number; labels: Record<string, string> }) { const image = "itzg/minecraft-server:java21"; const volume = `${input.containerName}-data`; await this.removeIfPresent(input.containerName); await request("POST", `/images/create?fromImage=${encodeURIComponent(image)}`); await request("POST", "/volumes/create", { Name: volume, Labels: { "devion.managed": "true", "devion.kind": "game-server" } }); await request("POST", `/containers/create?name=${encodeURIComponent(input.containerName)}`, { Image: image, Env: ["EULA=TRUE", `VERSION=${input.version}`, `MOTD=${input.name}`, `MEMORY=${input.memoryMib}M`], Labels: { ...input.labels, "devion.managed": "true", "devion.kind": "minecraft-java" }, ExposedPorts: { "25565/tcp": {} }, HostConfig: { Memory: input.memoryMib * 1024 * 1024, MemorySwap: input.memoryMib * 1024 * 1024, RestartPolicy: { Name: "unless-stopped" }, PortBindings: { "25565/tcp": [{ HostIp: "0.0.0.0", HostPort: "" }] }, Mounts: [{ Type: "volume", Source: volume, Target: "/data" }] }, NetworkingConfig: { EndpointsConfig: { [network]: {} } } }); await request("POST", `/containers/${encodeURIComponent(input.containerName)}/start`); return this.gameStatus(input.containerName); }
  async gameStatus(containerName: string) { try { const container = await request<DockerContainer>("GET", `/containers/${encodeURIComponent(containerName)}/json`); return { status: container.State?.Running ? "running" : "stopped", port: container.NetworkSettings?.Ports?.["25565/tcp"]?.[0]?.HostPort ?? null }; } catch { return { status: "failed", port: null }; } }
  async status(containerName: string) { try { const container = await request<DockerContainer>("GET", `/containers/${encodeURIComponent(containerName)}/json`); if (!container.State?.Running) return "stopped" as const; if (container.State.Health?.Status === "unhealthy") return "degraded" as const; return "healthy" as const; } catch { return "failed" as const; } }
  private async removeIfPresent(containerName: string) { try { await request("DELETE", `/containers/${encodeURIComponent(containerName)}?force=true`); } catch (error) { if (!(error instanceof Error) || !error.message.startsWith("Docker API 404:")) throw error; } }
}
