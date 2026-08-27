import { applicationDeployments, applications, auditLogs, builds, db, deployments } from "@repo/db";
import { asc, eq, inArray } from "drizzle-orm";
import type { Logger } from "pino";
import { getBuilderRun } from "../../features/builds/builder-client.js";
import { reconcileDeployment } from "../deployments/controller.js";

export async function reconcileBuild(buildId: string): Promise<void> {
  const build = await db.query.builds.findFirst({ where: eq(builds.id, buildId) });
  if (!build?.builderJobId || ["succeeded", "failed", "cancelled"].includes(build.status)) return;
  const run = await getBuilderRun(build.builderJobId);
  if (run.status === "queued") return;
  if (run.status === "running") {
    await db.update(builds).set({ status: "running", startedAt: run.startedAt ? new Date(run.startedAt) : new Date() }).where(eq(builds.id, build.id));
    return;
  }
  if (run.status === "pushing") {
    await db.update(builds).set({ status: "pushing", startedAt: run.startedAt ? new Date(run.startedAt) : new Date() }).where(eq(builds.id, build.id));
    return;
  }
  if (run.status === "failed" || run.status === "cancelled") {
    await db.update(builds).set({ status: run.status, errorCode: run.status === "cancelled" ? "BUILD_CANCELLED" : "BUILD_FAILED", errorMessage: run.error?.slice(0, 2000) ?? null, completedAt: run.finishedAt ? new Date(run.finishedAt) : new Date() }).where(eq(builds.id, build.id));
    return;
  }
  const artifact = run.metadata.artifacts?.[0];
  const commitSha = run.metadata.resolvedCommit;
  if (!artifact?.digest || !commitSha) {
    await db.update(builds).set({ status: "failed", errorCode: "INVALID_BUILD_RESULT", errorMessage: "Builder did not return an immutable image digest and commit", completedAt: new Date() }).where(eq(builds.id, build.id));
    return;
  }
  if (!(build.buildConfiguration as { deployment?: { enabled?: boolean } }).deployment?.enabled) {
    await db.update(builds).set({ status: "succeeded", commitSha, imageDigest: artifact.digest, completedAt: run.finishedAt ? new Date(run.finishedAt) : new Date() }).where(eq(builds.id, build.id));
    await db.update(applications).set({ lastKnownCommit: commitSha }).where(eq(applications.id, build.applicationId));
    return;
  }
  let deploymentId: string | undefined;
  await db.transaction(async (tx) => {
    const current = await tx.query.builds.findFirst({ where: eq(builds.id, build.id) });
    if (!current || current.status === "succeeded") return;
    const existing = await tx.query.deployments.findFirst({ where: eq(deployments.buildId, build.id) });
    if (existing) { deploymentId = existing.id; return; }
    const previous = await tx.select({ version: deployments.version }).from(deployments).where(eq(deployments.applicationId, build.applicationId)).orderBy(asc(deployments.version));
    deploymentId = crypto.randomUUID();
    await tx.update(builds).set({ status: "succeeded", commitSha, imageDigest: artifact.digest, completedAt: run.finishedAt ? new Date(run.finishedAt) : new Date() }).where(eq(builds.id, build.id));
    await tx.update(applications).set({ status: "deploying", lastKnownCommit: commitSha }).where(eq(applications.id, build.applicationId));
    await tx.insert(deployments).values({
      id: deploymentId,
      applicationId: build.applicationId,
      version: (previous.at(-1)?.version ?? 0) + 1,
      image: `${build.imageRepository}@${artifact.digest}`,
      replicas: Number((build.buildConfiguration as { deployment?: { replicas?: number } }).deployment?.replicas ?? 1),
      desiredState: "running",
      runtime: "container",
      requirements: (build.buildConfiguration as { requirements?: unknown }).requirements ?? { cpuMilli: 250, memoryMib: 256, storageMib: 0, runtime: "container" },
      runtimeConfig: { buildId: build.id, commitSha },
      buildId: build.id,
      commitSha,
      createdBy: build.triggeredBy,
    });
    await tx.insert(applicationDeployments).values({ id: crypto.randomUUID(), applicationId: build.applicationId, actorId: build.triggeredBy, action: "deploy", status: "succeeded", message: `Deployment ${deploymentId} created from build ${build.id}` });
    await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: build.triggeredBy, action: "deployment.created_from_build", targetType: "deployment", targetId: deploymentId, metadata: JSON.stringify({ projectId: build.projectId, buildId: build.id, commitSha }) });
  });
  if (deploymentId) await reconcileDeployment(deploymentId);
}

let timer: ReturnType<typeof setInterval> | undefined;
export function startBuildController(logger: Logger, intervalMs = 5_000) {
  if (timer) return;
  const tick = async () => {
    try {
      const active = await db.select({ id: builds.id }).from(builds).where(inArray(builds.status, ["queued", "running", "pushing"]));
      for (const build of active) await reconcileBuild(build.id).catch((error) => logger.error({ error, buildId: build.id }, "Build reconciliation failed"));
    } catch (error) { logger.error({ error }, "Build controller tick failed"); }
  };
  timer = setInterval(() => void tick(), intervalMs);
  void tick();
}
export function stopBuildController() { if (timer) clearInterval(timer); timer = undefined; }
