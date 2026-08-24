import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { BuildRun, WorkflowStep } from "./domain.ts";
import type { RunRepository } from "./repository.ts";
import { executeBuildKit, safePath } from "./buildkit.ts";
import { inspectDockerfile } from "./dockerfile.ts";
import { deployToFirecracker } from "./firecracker-client.ts";
import { runProcess } from "./process.ts";
import { inspectRegistryImage } from "./registry.ts";
import { interpolate } from "./workflow.ts";

type Outcome = "succeeded" | "failed" | "skipped";

export class WorkflowExecutor {
  constructor(private readonly options: { repository: RunRepository; workdir: string; buildkitAddress: string; firecrackerAgentUrl?: string }) {}

  async execute(run: BuildRun, signal: AbortSignal): Promise<void> {
    const workspace = resolve(this.options.workdir, run.id);
    await mkdir(workspace, { recursive: true });
    const log = (stepId: string | null, stream: "system" | "stdout" | "stderr", message: string) => this.options.repository.appendLog(run.id, stepId, stream, redact(message, run.secrets));
    try {
      await log(null, "system", `Checking out ${run.source.repository} at ${run.source.ref}`);
      const cloneUrl = authenticatedUrl(run.source.repository, run.secrets.GIT_TOKEN);
      const clone = await runProcess(["git", "-c", "protocol.file.allow=never", "-c", "protocol.ext.allow=never", "-c", "http.followRedirects=false", "clone", "--depth", "1", "--branch", run.source.ref, cloneUrl, workspace], { cwd: this.options.workdir, signal, onStdout: (line) => void log(null, "stdout", line), onStderr: (line) => void log(null, "stderr", line) });
      if (clone.exitCode !== 0) throw new Error(`Git checkout failed with code ${clone.exitCode}`);
      const revision = await runProcess(["git", "rev-parse", "HEAD"], { cwd: workspace, signal });
      if (revision.exitCode !== 0) throw new Error("Unable to resolve Git commit");
      const resolvedCommit = revision.stdout.trim();
      const metadata = { ...run.metadata, resolvedCommit };
      await this.options.repository.updateMetadata(run.id, metadata);
      const context = { ...Object.fromEntries(Object.entries(run.inputs).map(([key, value]) => [`inputs.${key}`, value])), "git.sha": resolvedCommit, "git.ref": run.source.ref, "run.id": run.id };
      await this.runGraph(run, workspace, context, metadata, signal, log);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  private async runGraph(run: BuildRun, workspace: string, context: Record<string, string>, metadata: BuildRun["metadata"], signal: AbortSignal, log: (stepId: string | null, stream: "system" | "stdout" | "stderr", message: string) => Promise<void>): Promise<void> {
    const pending = new Map(run.workflow.steps.map((step) => [step.id, step]));
    const outcomes = new Map<string, Outcome>();
    while (pending.size) {
      if (signal.aborted) throw new Error("Build cancelled");
      const ready = [...pending.values()].filter((step) => step.needs.every((id) => outcomes.has(id)));
      if (!ready.length) throw new Error("Workflow dependency deadlock");
      const settled = await Promise.allSettled(ready.map(async (step) => {
        pending.delete(step.id);
        if (step.needs.some((id) => outcomes.get(id) !== "succeeded") || !conditionMatches(step.if, outcomes)) {
          outcomes.set(step.id, "skipped"); await log(step.id, "system", "Skipped"); return;
        }
        let error: unknown;
        for (let attempt = 1; attempt <= step.retries + 1; attempt++) {
          try {
            await log(step.id, "system", `Starting attempt ${attempt}`);
            await this.runStep(run, step, workspace, context, metadata, AbortSignal.any([signal, AbortSignal.timeout(step.timeoutMinutes * 60_000)]), log);
            outcomes.set(step.id, "succeeded"); await log(step.id, "system", "Succeeded"); return;
          } catch (caught) { error = caught; await log(step.id, "stderr", String(caught)); }
        }
        if (step.continueOnError) {
          outcomes.set(step.id, "succeeded");
          await log(step.id, "system", "Failure tolerated by continueOnError");
          return;
        }
        outcomes.set(step.id, "failed");
        throw error;
      }));
      const rejection = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (rejection) throw rejection.reason;
    }
  }

  private async runStep(run: BuildRun, step: WorkflowStep, workspace: string, context: Record<string, string>, metadata: BuildRun["metadata"], signal: AbortSignal, log: (stepId: string | null, stream: "system" | "stdout" | "stderr", message: string) => Promise<void>): Promise<void> {
    if ("build" in step) {
      if (!run.workerId || !(await this.options.repository.markPushing(run.id, run.workerId))) throw new Error("Build lease was lost before image export");
      const result = await executeBuildKit(step, { workspace, address: this.options.buildkitAddress, context, secrets: run.secrets, signal, log: (stream, line) => void log(step.id, stream, line) });
      const dockerfilePath = safePath(workspace, step.build.dockerfile);
      const exposedPorts = await inspectDockerfile(dockerfilePath);
      metadata.exposedPorts = [...new Set([...metadata.exposedPorts, ...exposedPorts])];
      metadata.detectedDockerfiles[step.id] = { path: step.build.dockerfile, exposedPorts };
      if (result.digest) {
        metadata.artifacts = result.tags.map((image) => ({ image, digest: result.digest! }));
      }
      await this.options.repository.updateMetadata(run.id, metadata);
      await log(step.id, "system", exposedPorts.length ? `Detected exposed ports: ${exposedPorts.join(", ")}` : "No numeric EXPOSE port detected");
      return;
    }
    if ("deploy" in step) {
      if (!this.options.firecrackerAgentUrl) throw new Error("FIRECRACKER_AGENT_URL is required for deploy steps");
      const deployment = step.deploy;
      const image = interpolate(deployment.image, context);
      const username = deployment.registryUsernameSecret ? run.secrets[deployment.registryUsernameSecret] : undefined;
      const password = deployment.registryPasswordSecret ? run.secrets[deployment.registryPasswordSecret] : undefined;
      if ((username && !password) || (!username && password)) throw new Error("Registry username and password secrets must be configured together");
      await log(step.id, "system", `Resolving immutable registry manifest for ${image}`);
      const registryCredentials = {
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
      };
      const registryImage = await inspectRegistryImage(image, registryCredentials);
      await log(step.id, "system", `Deploying ${image}@${registryImage.digest}`);
      const agentToken = run.secrets.FIRECRACKER_AGENT_TOKEN;
      if (!agentToken) throw new Error("Missing FIRECRACKER_AGENT_TOKEN secret");
      const deploymentResult = await deployToFirecracker(this.options.firecrackerAgentUrl, agentToken, {
        image,
        digest: registryImage.digest,
        instanceName: interpolate(deployment.instanceName, context),
        mode: deployment.mode,
        ...(deployment.resourceTemplate ? { resourceTemplate: deployment.resourceTemplate } : {}),
        ...(deployment.domain ? { domain: interpolate(deployment.domain, context) } : {}),
        ...(deployment.vcpuCount ? { vcpuCount: deployment.vcpuCount } : {}),
        ...(deployment.memoryMiB ? { memoryMiB: deployment.memoryMiB } : {}),
        ...(deployment.rootfsSizeMiB ? { rootfsSizeMiB: deployment.rootfsSizeMiB } : {}),
        ...(deployment.servicePort ? { servicePort: deployment.servicePort } : deployment.mode === "automatic" && metadata.exposedPorts.length === 1 ? { servicePort: metadata.exposedPorts[0] } : {}),
        environment: Object.fromEntries(Object.entries(deployment.environment).map(([key, value]) => [key, interpolate(value, context)])),
        registryCredentials,
      });
      await log(step.id, "system", `Firecracker instance started: ${deploymentResult.instanceId} (${deploymentResult.url})`);
      return;
    }
    const env = Object.fromEntries(Object.entries({ ...run.workflow.env, ...step.env }).map(([key, value]) => [key, interpolate(value, context)]));
    const result = await runProcess([step.shell, "-euc", interpolate(step.run, context)], { cwd: safePath(workspace, step.workingDirectory), env, signal, onStdout: (line) => void log(step.id, "stdout", line), onStderr: (line) => void log(step.id, "stderr", line) });
    if (result.exitCode !== 0) throw new Error(`Command exited with code ${result.exitCode}`);
  }
}

function conditionMatches(value: string | undefined, outcomes: Map<string, Outcome>): boolean {
  if (!value || value === "success()") return ![...outcomes.values()].includes("failed");
  if (value === "always()") return true;
  if (value === "failure()") return [...outcomes.values()].includes("failed");
  if (value === "false") return false;
  if (value === "true") return true;
  throw new Error(`Unsupported condition: ${value}`);
}

function authenticatedUrl(repository: string, token?: string): string {
  if (!token || !repository.startsWith("https://")) return repository;
  const url = new URL(repository); url.username = "oauth2"; url.password = token; return url.toString();
}

function redact(value: string, secrets: Record<string, string>): string {
  let result = value;
  for (const secret of Object.values(secrets)) if (secret.length >= 4) result = result.replaceAll(secret, "***");
  return result;
}
