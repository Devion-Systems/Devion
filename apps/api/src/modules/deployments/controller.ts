import { chooseDynamicHostPort, type NodeSnapshot, scheduleWorkload, type WorkloadRequirements } from "@repo/core";
import { agentCommands, db, deploymentEvents, deployments, nodePortReservations, nodes, volumes, workloads } from "@repo/db";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
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
const HEALTH_FAILURE_THRESHOLD = 3;
const MAX_RECOVERY_ATTEMPTS = 5;
const RECOVERY_BACKOFF_BASE_MS = 30_000;
const RECOVERY_BACKOFF_MAX_MS = 10 * 60_000;
const COMMAND_DEADLINE_MS = 2 * 60_000;
const runtimeVolumesSchema = z.object({
  volumes: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().min(1) }).passthrough()).optional(),
});
const runtimePortsSchema = z.object({ ports: z.array(z.object({ containerPort: z.number().int().min(1).max(65_535), protocol: z.enum(["tcp", "udp"]).optional(), exposure: z.enum(["private", "public"]).optional(), externalPort: z.number().int().min(1).max(65_535).optional() })).optional() });

/** Reconciles desired deployment state into durable agent commands; it never invokes a runtime itself. */
export async function reconcileDeployment(deploymentId: string): Promise<void> {
  const leaseId = crypto.randomUUID();
  const now = new Date();
  const [lease] = await db
    .update(deployments)
    .set({ reconcileLeaseId: leaseId, reconcileLeaseUntil: new Date(now.getTime() + 60_000) })
    .where(and(
      eq(deployments.id, deploymentId),
      or(isNull(deployments.reconcileLeaseUntil), lt(deployments.reconcileLeaseUntil, now)),
    ))
    .returning({ id: deployments.id });
  if (!lease) return;
  try {
    await reconcileDeploymentClaimed(deploymentId);
  } finally {
    await db
      .update(deployments)
      .set({ reconcileLeaseId: null, reconcileLeaseUntil: null })
      .where(and(eq(deployments.id, deploymentId), eq(deployments.reconcileLeaseId, leaseId)));
  }
}

async function reconcileDeploymentClaimed(deploymentId: string): Promise<void> {
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

  const runtimeVolumes = runtimeVolumesSchema.safeParse(deployment.runtimeConfig).data?.volumes ?? [];
  const configuredRuntimePorts = runtimePortsSchema.safeParse(deployment.runtimeConfig).data?.ports ?? [];
  const requestedHostPorts = configuredRuntimePorts.flatMap((port) => port.exposure === "public" && port.externalPort ? [{ hostPort: port.externalPort, protocol: port.protocol ?? "tcp", containerPort: port.containerPort }] : []);
  if (requestedHostPorts.length > 0 && deployment.replicas > 1) {
    await db.update(deployments).set({ status: "failed", failureReason: "Fixed public host ports require a single replica" }).where(eq(deployments.id, deployment.id));
    return;
  }
  if (requestedHostPorts.length > 0) requirements = { ...requirements, requestedHostPorts: requestedHostPorts.map(({ hostPort, protocol }) => ({ hostPort, protocol })) };
  const persistentVolumes = runtimeVolumes.length > 0;
  const managedVolumeIds = runtimeVolumes.flatMap((volume) => volume.id ? [volume.id] : []);
  if (managedVolumeIds.length > 0) {
    const managed = await db.select().from(volumes).where(inArray(volumes.id, managedVolumeIds));
    if (managed.length !== managedVolumeIds.length || managed.some((volume) => !["available", "in_use"].includes(volume.status))) {
      await db.update(deployments).set({ status: "failed", failureReason: "Managed volume is unavailable" }).where(eq(deployments.id, deployment.id));
      return;
    }
    const nodeIds = [...new Set(managed.flatMap((volume) => volume.nodeId ? [volume.nodeId] : []))];
    if (nodeIds.length > 1) {
      await db.update(deployments).set({ status: "failed", failureReason: "Local volumes are bound to different nodes" }).where(eq(deployments.id, deployment.id));
      return;
    }
    if (nodeIds[0]) {
      requirements = { ...requirements, requiredNodeId: nodeIds[0] };
      await db.update(deployments).set({ requirements }).where(eq(deployments.id, deployment.id));
    }
  }
  const unhealthy = currentWorkloads.filter((workload) =>
    workload.desiredState === "running" &&
    (workload.actualState === "failed" || workload.healthFailureCount >= HEALTH_FAILURE_THRESHOLD),
  );
  if (!persistentVolumes && unhealthy.length > 0) {
    await Promise.all(unhealthy.map((workload) => requestStateChange(workload, "workload.stop")));
    await db.insert(deploymentEvents).values(unhealthy.map((workload) => ({
      id: crypto.randomUUID(), deploymentId: deployment.id, workloadId: workload.id, nodeId: workload.nodeId,
      type: "workload.recovery_requested", message: "Workload retired for automatic recovery",
      reason: workload.actualState === "failed" ? "RUNTIME_EXITED" : "HEALTH_CHECK_FAILED",
    })));
    await refreshDeploymentStatus(deployment.id);
    return;
  }
  // A lost stateless workload is intentionally not counted: it must be
  // replaced. Stateful workloads remain counted until their pinned node can
  // report again; moving them without fencing can duplicate writable data.
  const active = currentWorkloads.filter((workload) =>
    workload.desiredState === "running" && (persistentVolumes || workload.actualState !== "lost"),
  );
  const missingReplicas = Math.max(0, deployment.replicas - active.length);
  if (missingReplicas === 0) {
    if (deployment.recoveryState !== "idle" && active.every((workload) => workload.actualState === "running" && (workload.healthStatus === "healthy" || workload.healthStatus === "none")))
      await db.update(deployments).set({ recoveryAttempts: 0, recoveryNextAttemptAt: null, recoveryState: "idle" }).where(eq(deployments.id, deployment.id));
    await refreshDeploymentStatus(deployment.id);
    return;
  }

  const candidates = await loadCandidates();
  for (let index = 0; index < missingReplicas; index += 1) {
    if (deployment.recoveryState === "manual_intervention") {
      await db.update(deployments).set({ status: "failed", failureReason: "Automatic recovery attempts exhausted" }).where(eq(deployments.id, deployment.id));
      return;
    }
    if (deployment.recoveryNextAttemptAt && deployment.recoveryNextAttemptAt > new Date()) return;
    const decision = scheduleWorkload(candidates, requirements);
    const nodeId = decision.nodeId;
    if (!nodeId) {
      await refreshDeploymentStatus(deployment.id);
      return;
    }
    if (managedVolumeIds.length > 0) {
      // Claim unbound local volumes atomically. If another reconcile won the
      // claim, retry scheduling with that durable node affinity instead of
      // creating a second same-named Docker volume on this node.
      await db.update(volumes)
        .set({ nodeId, status: "in_use" })
        .where(and(inArray(volumes.id, managedVolumeIds), isNull(volumes.nodeId)));
      const claimed = await db.select({ nodeId: volumes.nodeId }).from(volumes).where(inArray(volumes.id, managedVolumeIds));
      const claimedNodeIds = [...new Set(claimed.flatMap((volume) => volume.nodeId ? [volume.nodeId] : []))];
      if (claimedNodeIds.length !== 1) {
        await db.update(deployments).set({ status: "failed", failureReason: "Local volume affinity conflict" }).where(eq(deployments.id, deployment.id));
        return;
      }
      if (claimedNodeIds[0] !== nodeId) {
        requirements = { ...requirements, requiredNodeId: claimedNodeIds[0] };
        await db.update(deployments).set({ requirements }).where(eq(deployments.id, deployment.id));
        index -= 1;
        continue;
      }
      requirements = { ...requirements, requiredNodeId: nodeId };
      await db.update(deployments).set({ requirements }).where(eq(deployments.id, deployment.id));
    }
    const workloadId = crypto.randomUUID();
    const commandId = crypto.randomUUID();
    const activeNodePorts = await db.select({ hostPort: nodePortReservations.hostPort, protocol: nodePortReservations.protocol }).from(nodePortReservations).where(and(eq(nodePortReservations.nodeId, nodeId), inArray(nodePortReservations.status, ["reserved", "bound"])));
    const occupiedByProtocol = new Map<"tcp" | "udp", Set<number>>([["tcp", new Set<number>()], ["udp", new Set<number>]]);
    activeNodePorts.forEach((port) => occupiedByProtocol.get(port.protocol)?.add(port.hostPort));
    const assignedHostPorts = configuredRuntimePorts.flatMap((port) => {
      if (port.exposure !== "public") return [];
      const protocol = port.protocol ?? "tcp";
      const hostPort = port.externalPort ?? chooseDynamicHostPort(occupiedByProtocol.get(protocol)!, `${workloadId}:${port.containerPort}/${protocol}`);
      if (!hostPort) return [];
      occupiedByProtocol.get(protocol)!.add(hostPort);
      return [{ containerPort: port.containerPort, protocol, hostPort }];
    });
    if (assignedHostPorts.length !== configuredRuntimePorts.filter((port) => port.exposure === "public").length) {
      await db.update(deployments).set({ status: "failed", failureReason: "No dynamic host port is available on the selected node" }).where(eq(deployments.id, deployment.id));
      return;
    }
    const commandRuntimeConfig = structuredClone(deployment.runtimeConfig) as { ports?: Array<{ containerPort: number; protocol?: "tcp" | "udp"; exposure?: "private" | "public"; externalPort?: number }> };
    if (commandRuntimeConfig.ports) commandRuntimeConfig.ports = commandRuntimeConfig.ports.map((port) => {
      const assigned = assignedHostPorts.find((item) => item.containerPort === port.containerPort && item.protocol === (port.protocol ?? "tcp"));
      return assigned ? { ...port, externalPort: assigned.hostPort } : port;
    });
    const replacement = currentWorkloads.find((workload) => workload.actualState === "lost" || workload.actualState === "failed" || workload.healthFailureCount >= HEALTH_FAILURE_THRESHOLD);
    const replacementReason = replacement?.actualState === "lost"
      ? "NODE_OFFLINE"
      : replacement?.actualState === "failed"
        ? "RUNTIME_EXITED"
        : replacement ? "HEALTH_CHECK_FAILED" : undefined;
    const recoveryAttempt = replacement ? deployment.recoveryAttempts + 1 : deployment.recoveryAttempts;
    if (recoveryAttempt > MAX_RECOVERY_ATTEMPTS) {
      await db.transaction(async (tx) => {
        await tx.update(deployments).set({ recoveryState: "manual_intervention", status: "failed", failureReason: "Automatic recovery attempts exhausted" }).where(eq(deployments.id, deployment.id));
        await tx.insert(deploymentEvents).values({ id: crypto.randomUUID(), deploymentId: deployment.id, workloadId: replacement?.id ?? null, type: "deployment.manual_intervention_required", message: "Automatic recovery attempts exhausted", reason: "RECOVERY_ATTEMPTS_EXHAUSTED" });
      });
      return;
    }
    const pinnedRequirements = persistentVolumes && !requirements.requiredNodeId
      ? { ...requirements, requiredNodeId: nodeId }
      : requirements;
    await db.transaction(async (tx) => {
      if (pinnedRequirements !== requirements) {
        await tx.update(deployments).set({ requirements: pinnedRequirements }).where(eq(deployments.id, deployment.id));
      }
      if (replacement) {
        const backoffMs = Math.min(RECOVERY_BACKOFF_BASE_MS * 2 ** Math.max(0, recoveryAttempt - 1), RECOVERY_BACKOFF_MAX_MS);
        await tx.update(deployments).set({ recoveryAttempts: recoveryAttempt, recoveryState: "backoff", recoveryNextAttemptAt: new Date(Date.now() + backoffMs) }).where(eq(deployments.id, deployment.id));
      }
      await tx.insert(workloads).values({
        id: workloadId,
        deploymentId: deployment.id,
        nodeId,
        desiredState: "running",
        schedulingReasons: decision.reasons,
        ...(replacement ? { replacementOfWorkloadId: replacement.id, replacementReason } : {}),
      });
      if (assignedHostPorts.length) await tx.insert(nodePortReservations).values(assignedHostPorts.map((port) => ({
        id: crypto.randomUUID(), nodeId, workloadId, containerPort: port.containerPort, hostPort: port.hostPort, protocol: port.protocol, status: "reserved" as const,
      })));
      if (replacement) await tx.insert(deploymentEvents).values({ id: crypto.randomUUID(), deploymentId: deployment.id, workloadId, nodeId, type: "workload.replacement_requested", message: "Replacement workload scheduled", reason: replacementReason! });
      await tx.insert(agentCommands).values({
        id: commandId,
        nodeId,
        type: "workload.start",
        resourceId: workloadId,
        deadlineAt: new Date(Date.now() + COMMAND_DEADLINE_MS),
        payload: {
          workloadId,
          deploymentId: deployment.id,
          image: deployment.image,
          runtime: deployment.runtime,
          requirements,
          runtimeConfig: commandRuntimeConfig,
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
      deadlineAt: new Date(Date.now() + COMMAND_DEADLINE_MS),
      payload: { workloadId: workload.id, ...(gracefulShutdownSeconds ? { gracefulShutdownSeconds } : {}) },
    });
  });
}

async function loadCandidates(): Promise<NodeSnapshot[]> {
  const [nodeRecords, activeWorkloads, deploymentRecords, portReservations] = await Promise.all([
    db.select().from(nodes),
    db.select().from(workloads),
    db.select({ id: deployments.id, requirements: deployments.requirements }).from(deployments),
    db.select().from(nodePortReservations).where(inArray(nodePortReservations.status, ["reserved", "bound"])),
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
            reservedHostPorts: new Set(portReservations.filter((reservation) => reservation.nodeId === node.id).map((reservation) => `${reservation.hostPort}/${reservation.protocol}`)),
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
