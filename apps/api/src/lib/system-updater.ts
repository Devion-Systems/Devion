import { readFile } from "node:fs/promises";
import http from "node:http";

const socketPath = process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
const updaterContainer = process.env.SYSTEM_UPDATER_CONTAINER ?? "devion-updater";
const stateFile = process.env.SYSTEM_UPDATE_STATE_FILE ?? "/data/system-updates/latest.json";

type DockerExec = { Id: string };
type UpdateState = { status: "idle" | "running" | "succeeded" | "failed"; ref?: string; updatedAt?: string; logFile?: string };
type UpdateRef = { name: string; kind: "branch" | "version" };

function dockerRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = http.request({ socketPath, method, path: `/v1.45${path}`, headers: payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : undefined }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (responseBody += chunk));
      response.on("end", () => {
        if ((response.statusCode ?? 500) >= 300) return reject(new Error(`Docker API ${response.statusCode}: ${responseBody}`));
        try { resolve(responseBody ? (JSON.parse(responseBody) as T) : (undefined as T)); }
        catch { resolve(responseBody as T); }
      });
    });
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function exec(command: string[], detach = false) {
  const created = await dockerRequest<DockerExec>("POST", `/containers/${encodeURIComponent(updaterContainer)}/exec`, {
    AttachStdout: !detach,
    AttachStderr: !detach,
    Cmd: command,
  });
  // TTY keeps Docker's exec response as plain text. Without it Docker prefixes
  // stdout with multiplexing frames, which breaks parsing of `git ls-remote`.
  return dockerRequest<string>("POST", `/exec/${encodeURIComponent(created.Id)}/start`, { Detach: detach, Tty: true });
}

export class SystemUpdater {
  async refs() {
    const output = await exec(["git", "-C", "/workspace", "ls-remote", "--heads", "--tags", "origin"]);
    const refs: UpdateRef[] = output.split("\n").flatMap<UpdateRef>((line): UpdateRef[] => {
      const [, name] = line.trim().split("\t");
      if (!name || name.endsWith("^{}")) return [];
      if (name.startsWith("refs/heads/")) return [{ name: name.slice(11), kind: "branch" as const }];
      if (name.startsWith("refs/tags/")) return [{ name: name.slice(10), kind: "version" as const }];
      return [];
    });
    return refs.sort((left, right) => left.name.localeCompare(right.name));
  }

  async status(): Promise<UpdateState> {
    try { return JSON.parse(await readFile(stateFile, "utf8")) as UpdateState; }
    catch { return { status: "idle" }; }
  }

  async start(ref: string) {
    const refs = await this.refs();
    if (!refs.some((item) => item.name === ref)) throw new Error("The selected branch or version is not available from origin");
    await exec(["/usr/local/bin/devion-update", ref], true);
    return { status: "running" as const, ref };
  }
}
