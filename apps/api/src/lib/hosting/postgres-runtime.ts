import http from "node:http";

const SOCKET_PATH = process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
const NETWORK = process.env.DATABASE_DOCKER_NETWORK ?? "devion";

export const databasePlans = {
  starter: { cpuMillicores: 250, memoryMib: 512, storageGib: 10 },
  standard: { cpuMillicores: 1000, memoryMib: 2048, storageGib: 50 },
  performance: { cpuMillicores: 2000, memoryMib: 4096, storageGib: 200 },
} as const;

export const postgresVersions = ["17", "16", "15", "14"] as const;

export type DatabasePlan = keyof typeof databasePlans;

type DockerContainer = {
  State?: { Running?: boolean; Status?: string; Health?: { Status?: string } };
  Config?: { Env?: string[] };
};

function dockerRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = http.request(
      {
        socketPath: SOCKET_PATH,
        method,
        path: `/v1.45${path}`,
        headers: payload
          ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) }
          : undefined,
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (responseBody += chunk));
        response.on("end", () => {
          if ((response.statusCode ?? 500) >= 300) {
            reject(
              new Error(`Docker API ${response.statusCode}: ${responseBody || "request failed"}`),
            );
            return;
          }
          if (!responseBody) {
            resolve(undefined as T);
            return;
          }
          try {
            resolve(JSON.parse(responseBody) as T);
          } catch {
            // Image pulls and TTY-enabled exec sessions return plain text.
            resolve(responseBody as T);
          }
        });
      },
    );
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function resourceLimits(plan: DatabasePlan) {
  const resources = databasePlans[plan];
  return {
    NanoCpus: resources.cpuMillicores * 1_000_000,
    Memory: resources.memoryMib * 1024 * 1024,
    MemorySwap: resources.memoryMib * 1024 * 1024,
  };
}

export class PostgresRuntime {
  async provision(input: {
    containerName: string;
    databaseName: string;
    username: string;
    password: string;
    version: string;
    plan: DatabasePlan;
  }) {
    const volumeName = `${input.containerName}-data`;
    await dockerRequest(
      "POST",
      `/images/create?fromImage=${encodeURIComponent(`postgres:${input.version}-alpine`)}`,
    );
    await dockerRequest("POST", "/volumes/create", {
      Name: volumeName,
      Labels: { "devion.managed": "true" },
    });
    await dockerRequest(
      "POST",
      `/containers/create?name=${encodeURIComponent(input.containerName)}`,
      {
        Image: `postgres:${input.version}-alpine`,
        Env: [
          `POSTGRES_DB=${input.databaseName}`,
          `POSTGRES_USER=${input.username}`,
          `POSTGRES_PASSWORD=${input.password}`,
        ],
        Labels: { "devion.managed": "true", "devion.kind": "postgresql" },
        Healthcheck: {
          Test: ["CMD-SHELL", `pg_isready -U ${input.username} -d ${input.databaseName}`],
          Interval: 10_000_000_000,
          Timeout: 3_000_000_000,
          Retries: 12,
        },
        HostConfig: {
          ...resourceLimits(input.plan),
          RestartPolicy: { Name: "unless-stopped" },
          Mounts: [{ Type: "volume", Source: volumeName, Target: "/var/lib/postgresql/data" }],
        },
        NetworkingConfig: { EndpointsConfig: { [NETWORK]: {} } },
      },
    );
    await dockerRequest("POST", `/containers/${encodeURIComponent(input.containerName)}/start`);
  }

  async status(containerName: string) {
    try {
      const container = await dockerRequest<DockerContainer>(
        "GET",
        `/containers/${encodeURIComponent(containerName)}/json`,
      );
      if (!container.State?.Running) return "stopped";
      const health = container.State.Health?.Status;
      return health === "healthy" ? "ready" : health === "starting" ? "provisioning" : "failed";
    } catch {
      return "failed";
    }
  }

  async updatePlan(containerName: string, plan: DatabasePlan) {
    await dockerRequest(
      "POST",
      `/containers/${encodeURIComponent(containerName)}/update`,
      resourceLimits(plan),
    );
  }

  async remove(containerName: string) {
    await this.removeIfPresent(containerName);
  }

  /** Remove partial resources left by a failed provisioning attempt. */
  async removeIfPresent(containerName: string) {
    for (const path of [
      `/containers/${encodeURIComponent(containerName)}?force=true`,
      `/volumes/${encodeURIComponent(`${containerName}-data`)}?force=true`,
    ]) {
      try {
        await dockerRequest("DELETE", path);
      } catch (error) {
        // A failed create can leave either resource absent. That is safe to
        // ignore; other Docker errors must still stop the operation.
        if (!(error instanceof Error) || !error.message.startsWith("Docker API 404:")) {
          throw error;
        }
      }
    }
  }

  async query(containerName: string, databaseName: string, username: string, sql: string) {
    const container = await dockerRequest<DockerContainer>(
      "GET",
      `/containers/${encodeURIComponent(containerName)}/json`,
    );
    const password = container.Config?.Env?.find((item) => item.startsWith("POSTGRES_PASSWORD="))?.slice(
      "POSTGRES_PASSWORD=".length,
    );
    if (!password) throw new Error("Managed database credentials are unavailable");

    const exec = await dockerRequest<{ Id: string }>(
      "POST",
      `/containers/${encodeURIComponent(containerName)}/exec`,
      {
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Env: [`PGPASSWORD=${password}`],
        Cmd: [
          "psql",
          "-X",
          "-qAt",
          "-v",
          "ON_ERROR_STOP=1",
          "-h",
          "127.0.0.1",
          "-U",
          username,
          "-d",
          databaseName,
          "-c",
          sql,
        ],
      },
    );
    return dockerRequest<string>("POST", `/exec/${encodeURIComponent(exec.Id)}/start`, {
      Detach: false,
      Tty: true,
    });
  }
}
