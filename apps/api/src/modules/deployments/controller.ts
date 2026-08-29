import { type NodeSnapshot, scheduleWorkload, type WorkloadRequirements } from "@repo/core";
import { agentCommands, db, deploymentEvents, deployments, nodes, workloads } from "@repo/db";
import { and, eq, or } from "drizzle-orm";
import type { Logger } from "pino";
import { z } from "zod";
import { refreshDeploymentStatus } from "./service.js";

const requirementsSchema = z.object({
  cpuMilli: z.number().int().positive(),
  memoryMib: z.number().int().positive(),
  storageMib: z.number().int().nonnegative(),
  runtime: z.enum(["container", "microvm"]),
  architecture: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  requiredLabels: z.record(z.string()).optional(),
  requiredNodeId: z.string().uuid().optional(),
});

/** Reconciles desired deployment state into durable agent commands; it never invokes a runtime itself. */
export async function reconcileDeployment(deploymentId: string): Promise<void> {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
  });
  if (!deployment) return;
  let requirements = requirementsSchema.parse(deployment.requirements) as WorkloadRequirements;
  const currentWorkloads = await db
    .select()
    .from(workloads)
    .where(eq(workloads.deploymentId, deployment.id));

  if (deployment.desiredState !== "running") {
    const commandType = deployment.desiredState === "deleted" ? "workload.delete" : "workload.stop";
    await Promise.all(
      currentWorkloads.map((workload) => requestStateChange(workload, commandType)),
    );
    await refreshDeploymentStatus(deployment.id);
    return;
  }

  const active = currentWorkloads.filter((workload) => workload.desiredState === "running");
  const missingReplicas = Math.max(0, deployment.replicas - active.length);
  if (missingReplicas === 0) {
    await refreshDeploymentStatus(deployment.id);
    return;
  }

  const candidates = await loadCandidates();
  const persistentVolumes = Boolean(z.object({ volumes: z.array(z.unknown()).optional() }).safeParse(deployment.runtimeConfig).data?.volumes?.length);
  for (let index = 0; index < missingReplicas; index += 1) {
    const decision = scheduleWorkload(candidates, requirements);
    const nodeId = decision.nodeId;
    if (!nodeId) {
      await refreshDeploymentStatus(deployment.id);
      return;
    }
    const workloadId = crypto.randomUUID();
    const commandId = crypto.randomUUID();
    const pinnedRequirements = persistentVolumes && !requirements.requiredNodeId
      ? { ...requirements, requiredNodeId: nodeId }
      : requirements;
    await db.transaction(async (tx) => {
      if (pinnedRequirements !== requirements) {
        await tx.update(deployments).set({ requirements: pinnedRequirements }).where(eq(deployments.id, deployment.id));
      }
      await tx.insert(workloads).values({
        id: workloadId,
        deploymentId: deployment.id,
        nodeId,
        desiredState: "running",
        schedulingReasons: decision.reasons,
      });
      await tx.insert(agentCommands).values({
        id: commandId,
        nodeId,
        type: "workload.start",
        resourceId: workloadId,
        payload: {
          workloadId,
          deploymentId: deployment.id,
          image: deployment.image,
          runtime: deployment.runtime,
          requirements,
          runtimeConfig: deployment.runtimeConfig,
        },
      });
    });
    requirements = pinnedRequirements;
    reserve(candidates, nodeId, requirements);
  }
  await refreshDeploymentStatus(deployment.id);
}

/** Recreates the current workload instances while preserving the deployment snapshot. */
export async function restartDeploymentWorkloads(deploymentId: string): Promise<void> {
  const currentWorkloads = await db.select().from(workloads).where(eq(workloads.deploymentId, deploymentId));
  await Promise.all(currentWorkloads.map((workload) => requestStateChange(workload, "workload.stop")));
  await reconcileDeployment(deploymentId);
}

/** A new revision becomes the sole desired running revision for an application. */
export async function supersedePreviousDeployments(applicationId: string, currentDeploymentId: string): Promise<void> {
  const previous = await db.select().from(deployments).where(and(eq(deployments.applicationId, applicationId), eq(deployments.desiredState, "running")));
  for (const deployment of previous) {
    if (deployment.id === currentDeploymentId) continue;
    await db.transaction(async (tx) => {
      await tx.update(deployments).set({ desiredState: "stopped", status: "superseded", failureReason: null }).where(eq(deployments.id, deployment.id));
      await tx.insert(deploymentEvents).values({ id: crypto.randomUUID(), deploymentId: deployment.id, type: "deployment.superseded", message: `Superseded by deployment ${currentDeploymentId}` });
    });
    const workloadItems = await db.select().from(workloads).where(eq(workloads.deploymentId, deployment.id));
    await Promise.all(workloadItems.map((workload) => requestStateChange(workload, "workload.stop")));
  }
}

export async function stopApplicationWorkloads(applicationId: string): Promise<void> {
  const applicationDeployments = await db
    .select({ id: deployments.id })
    .from(deployments)
    .where(eq(deployments.applicationId, applicationId));
  for (const deployment of applicationDeployments) {
    await db
      .update(deployments)
      .set({ desiredState: "stopped" })
      .where(eq(deployments.id, deployment.id));
    const currentWorkloads = await db
      .select()
      .from(workloads)
      .where(eq(workloads.deploymentId, deployment.id));
    await Promise.all(
      currentWorkloads.map((workload) => requestStateChange(workload, "workload.stop")),
    );
  }
}

async function requestStateChange(
  workload: typeof workloads.$inferSelect,
  type: "workload.stop" | "workload.delete",
): Promise<void> {
  const nodeId = workload.nodeId;
  if (!nodeId || workload.desiredState === (type === "workload.delete" ? "deleted" : "stopped"))
    return;
  const pending = await db.query.agentCommands.findFirst({
    where: and(
      eq(agentCommands.resourceId, workload.id),
      eq(agentCommands.type, type),
      or(eq(agentCommands.status, "pending"), eq(agentCommands.status, "delivered")),
    ),
  });
  if (pending) return;
  const desiredState = type === "workload.delete" ? "deleted" : "stopped";
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, workload.deploymentId),
    columns: { runtimeConfig: true },
  });
  const gracefulShutdownSeconds = z
    .object({ gracefulShutdownSeconds: z.number().int().min(1).max(600).optional() })
    .safeParse(deployment?.runtimeConfig)
    .data?.gracefulShutdownSeconds;
  await db.transaction(async (tx) => {
    await tx.update(workloads).set({ desiredState }).where(eq(workloads.id, workload.id));
    await tx.insert(agentCommands).values({
      id: crypto.randomUUID(),
      nodeId,
      type,
      resourceId: workload.id,
      payload: { workloadId: workload.id, ...(gracefulShutdownSeconds ? { gracefulShutdownSeconds } : {}) },
    });
  });
}

async function loadCandidates(): Promise<NodeSnapshot[]> {
  const [nodeRecords, activeWorkloads, deploymentRecords] = await Promise.all([
    db.select().from(nodes),
    db.select().from(workloads),
    db.select({ id: deployments.id, requirements: deployments.requirements }).from(deployments),
  ]);
  const requirementsByDeployment = new Map(
    deploymentRecords.map((deployment) => [
      deployment.id,
      requirementsSchema.safeParse(deployment.requirements),
    ]),
  );
  const reservationsByNode = new Map<
    string,
    { cpuMilli: number; memoryMib: number; storageMib: number }
  >();
  for (const workload of activeWorkloads) {
    if (!workload.nodeId || workload.actualState === "stopped") continue;
    const parsed = requirementsByDeployment.get(workload.deploymentId);
    if (!parsed?.success) continue;
    const reserved = reservationsByNode.get(workload.nodeId) ?? {
      cpuMilli: 0,
      memoryMib: 0,
      storageMib: 0,
    };
    reserved.cpuMilli += parsed.data.cpuMilli;
    reserved.memoryMib += parsed.data.memoryMib;
    reserved.storageMib += parsed.data.storageMib;
    reservationsByNode.set(workload.nodeId, reserved);
  }
  return nodeRecords.flatMap((node) =>
    node.resources
      ? [
          {
            id: node.id,
            status: node.status,
            schedulingEnabled: node.schedulingEnabled === 1,
            architecture: node.architecture,
            region: node.region ?? undefined,
            labels: node.labels,
            runtimes: node.runtimes,
            resources: withScheduledReservations(node.resources, reservationsByNode.get(node.id)),
          } satisfies NodeSnapshot,
        ]
      : [],
  );
}

function withScheduledReservations(
  resources: NonNullable<(typeof nodes.$inferSelect)["resources"]>,
  scheduled: { cpuMilli: number; memoryMib: number; storageMib: number } | undefined,
): NonNullable<(typeof nodes.$inferSelect)["resources"]> {
  if (!scheduled) return structuredClone(resources);
  return {
    cpuMilli: {
      ...resources.cpuMilli,
      reserved: Math.max(resources.cpuMilli.reserved, scheduled.cpuMilli),
    },
    memoryMib: {
      ...resources.memoryMib,
      reserved: Math.max(resources.memoryMib.reserved, scheduled.memoryMib),
    },
    storageMib: {
      ...resources.storageMib,
      reserved: Math.max(resources.storageMib.reserved, scheduled.storageMib),
    },
  };
}

function reserve(
  candidates: NodeSnapshot[],
  nodeId: string,
  requirements: WorkloadRequirements,
): void {
  const node = candidates.find((candidate) => candidate.id === nodeId);
  if (!node) return;
  node.resources.cpuMilli.reserved += requirements.cpuMilli;
  node.resources.memoryMib.reserved += requirements.memoryMib;
  node.resources.storageMib.reserved += requirements.storageMib;
}

let controllerTimer: ReturnType<typeof setInterval> | undefined;

export function startDeploymentController(logger: Logger, intervalMs = 15_000): void {
  if (controllerTimer) return;
  const tick = async () => {
    try {
      const activeDeployments = await db.select({ id: deployments.id }).from(deployments);
      for (const deployment of activeDeployments) {
        try {
          await reconcileDeployment(deployment.id);
        } catch (error) {
          logger.error({ error, deploymentId: deployment.id }, "Deployment reconciliation failed");
        }
      }
    } catch (error) {
      logger.error({ error }, "Deployment controller tick failed");
    }
  };
  controllerTimer = setInterval(() => void tick(), intervalMs);
  void tick();
}

export function stopDeploymentController(): void {
  if (controllerTimer) clearInterval(controllerTimer);
  controllerTimer = undefined;
}
