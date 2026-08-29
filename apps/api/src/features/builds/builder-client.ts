type BuilderRun = {
  id: string;
  status: "queued" | "running" | "pushing" | "succeeded" | "failed" | "cancelled";
  error: string | null;
  metadata: {
    resolvedCommit?: string;
    artifacts?: Array<{ image: string; digest: string }>;
  };
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

function configuration() {
  const baseUrl = process.env.BUILDER_API_URL?.replace(/\/$/, "");
  const token = process.env.BUILDER_API_TOKEN;
  if (!baseUrl || !token) throw new Error("Builder integration is not configured");
  return { baseUrl, token };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, token } = configuration();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Builder request failed with HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function createBuilderRun(input: {
  buildId: string;
  repository: string;
  ref: string;
  rootDirectory: string;
  dockerfile: string;
  target?: string;
  buildArgs: Record<string, string>;
  image: string;
  insecureRegistry?: boolean;
  secrets?: Record<string, string>;
}) {
  const body = await request<{ data: BuilderRun }>("/v1/runs", {
    method: "POST",
    headers: { "idempotency-key": `devion-build:${input.buildId}` },
    body: JSON.stringify({
      source: { repository: input.repository, ref: input.ref },
      inputs: {},
      secrets: input.secrets ?? {},
      workflow: {
        version: 1,
        name: `Devion build ${input.buildId}`,
        env: {},
        steps: [{
          id: "build",
          timeoutMinutes: 60,
          retries: 0,
          needs: [],
          continueOnError: false,
          env: {},
          build: {
            context: input.rootDirectory,
            dockerfile: input.dockerfile,
            ...(input.target ? { target: input.target } : {}),
            platforms: ["linux/amd64"],
            tags: [input.image],
            push: true,
            insecureRegistry: input.insecureRegistry ?? false,
            args: input.buildArgs,
            secrets: {},
            cacheFrom: [],
          },
        }],
      },
    }),
  });
  return body.data;
}

export async function getBuilderRun(id: string) {
  return (await request<{ data: BuilderRun }>(`/v1/runs/${encodeURIComponent(id)}`)).data;
}

export async function cancelBuilderRun(id: string) {
  return request(`/v1/runs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

export async function getBuilderLogs(id: string, after: number) {
  return (await request<{ data: unknown[] }>(`/v1/runs/${encodeURIComponent(id)}/logs?after=${after}`)).data;
}
