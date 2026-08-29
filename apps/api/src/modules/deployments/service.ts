import { deploymentEvents, deployments, db, workloads } from "@repo/db";
import { and, desc, eq } from "drizzle-orm";
import { deriveDeploymentStatus, type DeploymentStatus } from "./lifecycle.js";

export { deriveDeploymentStatus, type DeploymentStatus } from "./lifecycle.js";

export type DeploymentCreateInput = {
  applicationId: string;
  environmentId?: string | null;
  image: string;
  replicas: number;
  desiredState: "running" | "stopped" | "deleted";
  runtime: "container" | "microvm";
  requirements: unknown;
  runtimeConfig: unknown;
  configurationSnapshot: Record<string, unknown>;
  buildId?: string | null;
  commitSha?: string | null;
  createdBy?: string | null;
  rollbackFromDeploymentId?: string | null;
};

/**
 * Creates one immutable revision. The database unique index is the final
 * concurrency guard; a conflicting version is retried inside a new
 * transaction instead of reusing or mutating an older deployment.
 */
export async function createDeployment(input: DeploymentCreateInput): Promise<typeof deployments.$inferSelect> {
  if (input.buildId) {
    const existing = await db.query.deployments.findFirst({ where: eq(deployments.buildId, input.buildId) });
    if (existing) return existing;
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        if (input.buildId) {
          const existing = await tx.query.deployments.findFirst({ where: eq(deployments.buildId, input.buildId) });
          if (existing) return existing;
        }
        const [previous] = await tx
          .select({ version: deployments.version })
          .from(deployments)
          .where(eq(deployments.applicationId, input.applicationId))
          .orderBy(desc(deployments.version))
          .limit(1);
        const id = crypto.randomUUID();
        const [created] = await tx.insert(deployments).values({
          id,
          applicationId: input.applicationId,
          environmentId: input.environmentId ?? null,
          version: (previous?.version ?? 0) + 1,
          image: input.image,
          replicas: input.replicas,
          desiredState: input.desiredState,
          runtime: input.runtime,
          requirements: input.requirements,
          runtimeConfig: input.runtimeConfig,
          configurationSnapshot: structuredClone(input.configurationSnapshot),
          buildId: input.buildId ?? null,
          commitSha: input.commitSha ?? null,
          createdBy: input.createdBy ?? null,
          rollbackFromDeploymentId: input.rollbackFromDeploymentId ?? null,
          status: input.desiredState === "running" ? "queued" : "stopped",
        }).returning();
        if (!created) throw new Error("Deployment could not be persisted");
        await tx.insert(deploymentEvents).values({
          id: crypto.randomUUID(), deploymentId: id,
          type: input.rollbackFromDeploymentId ? "deployment.rollback_created" : "deployment.created",
          message: input.rollbackFromDeploymentId ? `Rollback revision v${created.version} created` : `Deployment revision v${created.version} created`,
        });
        return created;
      });
    } catch (error) {
      if ((error as { code?: string }).code !== "23505" || attempt === 3) throw error;
    }
  }
  throw new Error("Deployment revision could not be reserved");
}

export async function createRollbackDeployment(sourceDeploymentId: string, actorId: string): Promise<typeof deployments.$inferSelect> {
  const source = await db.query.deployments.findFirst({ where: eq(deployments.id, sourceDeploymentId) });
  if (!source) throw new Error("Rollback source deployment not found");
  if (!source.configurationSnapshot || typeof source.configurationSnapshot !== "object")
    throw new Error("Rollback source has no immutable configuration snapshot");
  return createDeployment({
    applicationId: source.applicationId,
    environmentId: source.environmentId,
    image: source.image,
    replicas: source.replicas,
    desiredState: "running",
    runtime: source.runtime,
    requirements: source.requirements,
    runtimeConfig: source.runtimeConfig,
    configurationSnapshot: source.configurationSnapshot as Record<string, unknown>,
    buildId: source.buildId,
    commitSha: source.commitSha,
    createdBy: actorId,
    rollbackFromDeploymentId: source.id,
  });
}

/** Redeploys a stored immutable snapshot as a fresh revision. */
export async function createRedeployment(sourceDeploymentId: string, actorId: string): Promise<typeof deployments.$inferSelect> {
  const source = await db.query.deployments.findFirst({ where: eq(deployments.id, sourceDeploymentId) });
  if (!source) throw new Error("Deployment source not found");
  if (!source.configurationSnapshot || typeof source.configurationSnapshot !== "object")
    throw new Error("Deployment source has no immutable configuration snapshot");
  return createDeployment({
    applicationId: source.applicationId,
    environmentId: source.environmentId,
    image: source.image,
    replicas: source.replicas,
    desiredState: "running",
    runtime: source.runtime,
    requirements: source.requirements,
    runtimeConfig: source.runtimeConfig,
    configurationSnapshot: source.configurationSnapshot as Record<string, unknown>,
    commitSha: source.commitSha,
    createdBy: actorId,
  });
}

/** Stores a lifecycle transition and its event atomically. */
export async function refreshDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null> {
  const deployment = await db.query.deployments.findFirst({ where: eq(deployments.id, deploymentId) });
  if (!deployment) return null;
  if (deployment.status === "superseded" && deployment.desiredState !== "running") return deployment.status;
  const workloadItems = await db.select().from(workloads).where(eq(workloads.deploymentId, deploymentId));
  const next = deriveDeploymentStatus(deployment.desiredState, deployment.replicas, workloadItems);
  if (deployment.status === next.status && deployment.failureReason === next.failureReason) return next.status;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(deployments).set({
      status: next.status,
      failureReason: next.failureReason,
      ...(next.status === "running" && !deployment.startedAt ? { startedAt: now, completedAt: now } : {}),
      ...(next.status === "failed" ? { failedAt: now } : {}),
    }).where(and(eq(deployments.id, deploymentId), eq(deployments.status, deployment.status)));
    await tx.insert(deploymentEvents).values({
      id: crypto.randomUUID(), deploymentId, type: "deployment.status_changed",
      message: `Deployment is ${next.status}`,
      reason: next.failureReason,
    });
  });
  return next.status;
}
