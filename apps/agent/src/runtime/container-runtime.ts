import http from "node:http";

export interface ContainerStartSpec {
  workloadId: string;
  image: string;
  cpuMilli: number;
  memoryMib: number;
  environment?: Record<string, string>;
  ports?: Array<{ containerPort: number; protocol?: "tcp" | "udp"; exposure?: "private" | "public" }>;
  volumes?: Array<{ name: string; target: string; readOnly?: boolean }>;
  restartPolicy?: "no" | "on-failure" | "always" | "unless-stopped";
  gracefulShutdownSeconds?: number;
  command?: string;
  workingDirectory?: string;
  healthCheck?: { command: string; intervalSeconds: number; timeoutSeconds: number; retries: number; startPeriodSeconds: number };
}

/** Docker Engine API adapter. The agent is the only process that accesses its local socket. */
export class ContainerRuntime {
  constructor(private readonly socketPath: string) {}

  async start(
    spec: ContainerStartSpec,
  ): Promise<{ runtimeId: string; ports: Record<string, number> }> {
    const name = `devion-workload-${spec.workloadId.replaceAll("-", "")}`;
    await this.removeIfPresent(name);
    await this.request("POST", `/images/create?fromImage=${encodeURIComponent(spec.image)}`);
    const exposedPorts = Object.fromEntries(
      (spec.ports ?? []).map((port) => [`${port.containerPort}/${port.protocol ?? "tcp"}`, {}]),
    );
    const portBindings = Object.fromEntries(
      (spec.ports ?? []).filter((port) => port.exposure === "public").map((port) => [
        `${port.containerPort}/${port.protocol ?? "tcp"}`,
        [{ HostIp: "0.0.0.0", HostPort: "" }],
      ]),
    );
    for (const volume of spec.volumes ?? []) {
      await this.request("POST", "/volumes/create", {
        Name: volume.name,
        Labels: { "devion.managed": "true", "devion.workload-id": spec.workloadId },
      });
    }
    await this.request("POST", `/containers/create?name=${encodeURIComponent(name)}`, {
      Image: spec.image,
      ...(spec.environment
        ? { Env: Object.entries(spec.environment).map(([key, value]) => `${key}=${value}`) }
        : {}),
      ...(spec.command ? { Cmd: ["/bin/sh", "-lc", spec.command] } : {}),
      ...(spec.workingDirectory ? { WorkingDir: spec.workingDirectory } : {}),
      Labels: { "devion.managed": "true", "devion.workload-id": spec.workloadId },
      ...(spec.healthCheck ? { Healthcheck: { Test: ["CMD-SHELL", spec.healthCheck.command], Interval: spec.healthCheck.intervalSeconds * 1_000_000_000, Timeout: spec.healthCheck.timeoutSeconds * 1_000_000_000, Retries: spec.healthCheck.retries, StartPeriod: spec.healthCheck.startPeriodSeconds * 1_000_000_000 } } : {}),
      ...(Object.keys(exposedPorts).length > 0 ? { ExposedPorts: exposedPorts } : {}),
      HostConfig: {
        NanoCpus: spec.cpuMilli * 1_000_000,
        Memory: spec.memoryMib * 1024 * 1024,
        MemorySwap: spec.memoryMib * 1024 * 1024,
        RestartPolicy: { Name: spec.restartPolicy ?? "unless-stopped" },
        ...(Object.keys(portBindings).length > 0 ? { PortBindings: portBindings } : {}),
        ...(spec.volumes?.length
          ? {
              Mounts: spec.volumes.map((volume) => ({
                Type: "volume",
                Source: volume.name,
                Target: volume.target,
                ReadOnly: volume.readOnly ?? false,
              })),
            }
          : {}),
      },
    });
    await this.request("POST", `/containers/${encodeURIComponent(name)}/start`);
    const inspection = await this.request<{
      NetworkSettings?: { Ports?: Record<string, Array<{ HostPort: string }> | null> };
    }>("GET", `/containers/${encodeURIComponent(name)}/json`);
    const ports = Object.fromEntries(
      Object.entries(inspection.NetworkSettings?.Ports ?? {}).flatMap(
        ([containerPort, bindings]) =>
          bindings?.[0]?.HostPort ? [[containerPort, Number(bindings[0].HostPort)]] : [],
      ),
    );
    return { runtimeId: name, ports };
  }

  async stop(workloadId: string, gracefulShutdownSeconds = 15): Promise<void> {
    await this.request(
      "POST",
      `/containers/${encodeURIComponent(this.name(workloadId))}/stop?t=${gracefulShutdownSeconds}`,
    );
  }

  async inspect(workloadId: string): Promise<{ actualState: "running" | "stopped" | "failed" | "unknown"; healthStatus: "none" | "starting" | "healthy" | "unhealthy" }> {
    try {
      const container = await this.request<{ State?: { Running?: boolean; Dead?: boolean; Error?: string; Health?: { Status?: string } } }>("GET", `/containers/${encodeURIComponent(this.name(workloadId))}/json`);
      const health = container.State?.Health?.Status;
      const healthStatus = health === "starting" || health === "healthy" || health === "unhealthy" ? health : "none";
      return { actualState: container.State?.Running ? "running" : container.State?.Dead || container.State?.Error ? "failed" : "stopped", healthStatus };
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) return { actualState: "stopped", healthStatus: "none" };
      return { actualState: "unknown", healthStatus: "none" };
    }
  }

  async remove(workloadId: string): Promise<void> {
    await this.removeIfPresent(this.name(workloadId));
  }

  /** Executes only the Minecraft RCON client, never an arbitrary shell command. */
  async minecraftCommand(workloadId: string, command: string): Promise<string> {
    const created = await this.request<{ Id: string }>(
      "POST",
      `/containers/${encodeURIComponent(this.name(workloadId))}/exec`,
      {
        AttachStdout: true,
        AttachStderr: true,
        Cmd: ["rcon-cli", command],
      },
    );
    if (!created?.Id) throw new Error("Docker did not create the Minecraft console command");
    return decodeDockerLogFrames(
      await this.requestBuffer("POST", `/exec/${encodeURIComponent(created.Id)}/start`, {
        Detach: false,
        Tty: false,
      }),
    );
  }

  async logs(workloadId: string, tail: number): Promise<string> {
    const output = await this.requestBuffer(
      "GET",
      `/containers/${encodeURIComponent(this.name(workloadId))}/logs?stdout=true&stderr=true&timestamps=true&tail=${tail}`,
    );
    return decodeDockerLogFrames(output);
  }

  async minecraftFiles(workloadId: string): Promise<string> {
    return this.execText(workloadId, ["sh", "-lc", "find /data -mindepth 1 -maxdepth 6 -printf '%y\\t%P\\t%s\\n' | sort"]);
  }

  async minecraftFileRead(workloadId: string, path: string): Promise<string> {
    return this.execText(workloadId, ["sh", "-lc", 'test -f "/data/$1" && head -c 524288 -- "/data/$1"', "devion-file", path]);
  }

  async minecraftFileWrite(workloadId: string, path: string, content: string): Promise<void> {
    await this.execText(
      workloadId,
      ["sh", "-lc", 'mkdir -p "$(dirname "/data/$1")" && printf %s "$DEVION_FILE_CONTENT" > "/data/$1"', "devion-file", path],
      { DEVION_FILE_CONTENT: content },
    );
  }

  private async execText(workloadId: string, cmd: string[], environment?: Record<string, string>): Promise<string> {
    const created = await this.request<{ Id: string }>("POST", `/containers/${encodeURIComponent(this.name(workloadId))}/exec`, {
      AttachStdout: true, AttachStderr: true, Cmd: cmd,
      ...(environment ? { Env: Object.entries(environment).map(([key, value]) => `${key}=${value}`) } : {}),
    });
    if (!created?.Id) throw new Error("Docker did not create the file operation");
    return decodeDockerLogFrames(await this.requestBuffer("POST", `/exec/${encodeURIComponent(created.Id)}/start`, { Detach: false, Tty: false }));
  }

  private name(workloadId: string): string {
    return `devion-workload-${workloadId.replaceAll("-", "")}`;
  }
  private async removeIfPresent(name: string): Promise<void> {
    try {
      await this.request("DELETE", `/containers/${encodeURIComponent(name)}?force=true`);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Docker API 404:")) throw error;
    }
  }

  private request<T = void>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const request = http.request(
        {
          socketPath: this.socketPath,
          method,
          path: `/v1.45${path}`,
          headers: payload
            ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) }
            : undefined,
        },
        (response) => {
          let output = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            output += chunk;
          });
          response.on("end", () => {
            if ((response.statusCode ?? 500) >= 300)
              return reject(
                new Error(`Docker API ${response.statusCode}: ${output || "request failed"}`),
              );
            try {
              resolve((output ? JSON.parse(output) : undefined) as T);
            } catch {
              resolve(undefined as T);
            }
          });
        },
      );
      request.on("error", reject);
      if (payload) request.write(payload);
      request.end();
    });
  }

  private requestBuffer(method: string, path: string, body?: unknown): Promise<Buffer> {
    return this.requestRaw(method, path, body) as Promise<Buffer>;
  }

  private requestRaw(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Buffer | string> {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const request = http.request(
        {
          socketPath: this.socketPath,
          method,
          path: `/v1.45${path}`,
          headers: payload
            ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) }
            : undefined,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
          response.on("end", () => {
            const output = Buffer.concat(chunks);
            if ((response.statusCode ?? 500) >= 300)
              return reject(new Error(`Docker API ${response.statusCode}: ${output.toString("utf8") || "request failed"}`));
            resolve(output);
          });
        },
      );
      request.on("error", reject);
      if (payload) request.write(payload);
      request.end();
    });
  }
}

function decodeDockerLogFrames(data: Buffer): string {
  const lines: string[] = [];
  for (let offset = 0; offset + 8 <= data.length; ) {
    const size = data.readUInt32BE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    if (end > data.length) return data.toString("utf8");
    lines.push(data.subarray(start, end).toString("utf8"));
    offset = end;
  }
  return lines.length > 0 ? lines.join("") : data.toString("utf8");
}
