import { z } from "zod";

const relativePath = z.string().min(1).max(512).refine(
  (value) => !value.startsWith("/") && !value.split(/[\\/]+/).includes(".."),
  "Path must stay inside the checkout",
);

const commonStep = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]{0,62}$/),
  name: z.string().min(1).max(128).optional(),
  needs: z.array(z.string()).default([]),
  if: z.string().max(512).optional(),
  timeoutMinutes: z.number().int().min(1).max(720).default(60),
  retries: z.number().int().min(0).max(5).default(0),
  continueOnError: z.boolean().default(false),
  env: z.record(z.string(), z.string()).default({}),
});

const runStep = commonStep.extend({
  run: z.string().min(1).max(100_000),
  shell: z.enum(["sh", "bash"]).default("sh"),
  workingDirectory: relativePath.default("."),
});

const buildStep = commonStep.extend({
  build: z.object({
    context: relativePath.default("."),
    dockerfile: relativePath.default("Dockerfile"),
    target: z.string().min(1).max(128).optional(),
    platforms: z.array(z.string().regex(/^linux\/(amd64|arm64)(\/v\d+)?$/)).min(1).max(8),
    tags: z.array(z.string().min(1).max(255)).min(1).max(32),
    push: z.boolean().default(true),
    insecureRegistry: z.boolean().default(false),
    args: z.record(z.string(), z.string()).default({}),
    secrets: z.record(z.string(), z.string()).default({}),
    cacheFrom: z.array(z.string()).max(8).default([]),
    cacheTo: z.string().optional(),
  }),
});

const deployStep = commonStep.extend({
  deploy: z.object({
    /** Fully qualified OCI image reference, e.g. registry.example.com/team/api:main. */
    image: z.string().min(3).max(512).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/@-]*$/, "Invalid OCI image reference"),
    registryUsernameSecret: z.string().min(1).max(128).optional(),
    registryPasswordSecret: z.string().min(1).max(128).optional(),
    instanceName: z.string().regex(/^[a-z][a-z0-9-]{0,62}$/),
    mode: z.enum(["automatic", "manual"]).default("automatic"),
    resourceTemplate: z.string().regex(/^[a-z][a-z0-9-]{0,62}$/).optional(),
    domain: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/).optional(),
    vcpuCount: z.number().int().min(1).max(32).optional(),
    memoryMiB: z.number().int().min(128).max(65_536).optional(),
    rootfsSizeMiB: z.number().int().min(256).max(262_144).optional(),
    servicePort: z.number().int().min(1).max(65_535).optional(),
    environment: z.record(z.string(), z.string()).default({}),
  }).superRefine((value, ctx) => {
    if (value.mode !== "manual") return;
    for (const key of ["domain", "vcpuCount", "memoryMiB", "rootfsSizeMiB", "servicePort"] as const) {
      if (value[key] === undefined) ctx.addIssue({ code: "custom", path: [key], message: `Manual deployment requires ${key}` });
    }
  }),
});

export const workflowSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(128),
  env: z.record(z.string(), z.string()).default({}),
  steps: z.array(z.union([runStep, buildStep, deployStep])).min(1).max(128),
});

export type Workflow = z.infer<typeof workflowSchema>;
export type WorkflowStep = Workflow["steps"][number];
export type RunStatus = "queued" | "running" | "pushing" | "succeeded" | "failed" | "cancelled";

export interface SourceSpec {
  repository: string;
  ref: string;
}

export interface BuildRun {
  id: string;
  workflow: Workflow;
  source: SourceSpec;
  inputs: Record<string, string>;
  secrets: Record<string, string>;
  metadata: BuildMetadata;
  status: RunStatus;
  attempt: number;
  idempotencyKey: string;
  leaseExpiresAt: string | null;
  workerId: string | null;
  cancelRequested: boolean;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface BuildMetadata {
  exposedPorts: number[];
  detectedDockerfiles: Record<string, { path: string; exposedPorts: number[] }>;
  resolvedCommit?: string;
  artifacts?: Array<{ image: string; digest: string }>;
}

export interface LogEntry {
  id: number;
  runId: string;
  stepId: string | null;
  stream: "system" | "stdout" | "stderr";
  message: string;
  createdAt: string;
}
