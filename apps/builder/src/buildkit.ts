import { mkdir, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { WorkflowStep } from "./domain.ts";
import { runProcess } from "./process.ts";
import { interpolate } from "./workflow.ts";

type BuildStep = Extract<WorkflowStep, { build: unknown }>;

export async function executeBuildKit(
  step: BuildStep,
  options: { workspace: string; address: string; context: Record<string, string>; secrets: Record<string, string>; signal: AbortSignal; log: (stream: "stdout" | "stderr", line: string) => void },
): Promise<void> {
  const contextPath = safePath(options.workspace, step.build.context);
  const dockerfilePath = safePath(options.workspace, step.build.dockerfile);
  const args = [
    "buildctl", "--addr", options.address, "build", "--progress", "plain", "--frontend", "dockerfile.v0",
    "--local", `context=${contextPath}`, "--local", `dockerfile=${resolve(dockerfilePath, "..")}`,
    "--opt", `filename=${dockerfilePath.split(/[\\/]/).at(-1) ?? "Dockerfile"}`,
    "--opt", `platform=${step.build.platforms.join(",")}`,
  ];
  if (step.build.target) args.push("--opt", `target=${step.build.target}`);
  for (const [key, value] of Object.entries(step.build.args)) args.push("--opt", `build-arg:${key}=${interpolate(value, options.context)}`);
  for (const cache of step.build.cacheFrom) args.push("--import-cache", interpolate(cache, options.context));
  if (step.build.cacheTo) args.push("--export-cache", interpolate(step.build.cacheTo, options.context));

  const secretDirectory = resolve(options.workspace, ".devion-secrets");
  await mkdir(secretDirectory, { recursive: true, mode: 0o700 });
  for (const [id, secretName] of Object.entries(step.build.secrets)) {
    const value = options.secrets[secretName];
    if (value === undefined) throw new Error(`Missing secret: ${secretName}`);
    const file = resolve(secretDirectory, id);
    await Bun.write(file, value, { mode: 0o600 });
    args.push("--secret", `id=${id},src=${file}`);
  }
  const tags = step.build.tags.map((tag) => interpolate(tag, options.context));
  args.push("--output", step.build.push ? `type=image,name=${tags.join(",")},push=true` : "type=oci,dest=image.tar");
  try {
    const result = await runProcess(args, { cwd: options.workspace, signal: options.signal, onStdout: (line) => options.log("stdout", line), onStderr: (line) => options.log("stderr", line) });
    if (result.exitCode !== 0) throw new Error(`BuildKit exited with code ${result.exitCode}`);
  } finally {
    await rm(secretDirectory, { recursive: true, force: true });
  }
}

export function safePath(workspace: string, value: string): string {
  const target = resolve(workspace, value);
  const rel = relative(resolve(workspace), target);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(`Path escapes workspace: ${value}`);
  return target;
}
