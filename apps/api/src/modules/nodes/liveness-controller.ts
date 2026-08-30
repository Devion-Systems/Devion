import { agentCommands, db, deploymentEvents, deployments, nodes, workloads } from "@repo/db";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import type { Logger } from "pino";
import { z } from "zod";
import { reconcileDomainRoutesForNode } from "../../features/routing/controller.js";
import { refreshDeploymentStatus } from "../deployments/service.js";

let timer: ReturnType<typeof setInterval> | undefined;
const NODE_UNHEALTHY_AFTER_MS = 45_000;
const NODE_OFFLINE_AFTER_MS = 90_000;

/** Marks silent agents offline without trusting a stale last reported status. */
export function startNodeLivenessController(
  logger: Logger,
  intervalMs = 15_000,
  unhealthyAfterMs = NODE_UNHEALTHY_AFTER_MS,
  offlineAfterMs = NODE_OFFLINE_AFTER_MS,
): void {
  if (timer) return;
  const tick = async () => {
    const now = new Date();
    const unhealthyBefore = new Date(now.getTime() - unhealthyAfterMs);
    const offlineBefore = new Date(now.getTime() - offlineAfterMs);
    try {
      // A missed heartbeat is not immediately an outage. Mark the node
      // unhealthy first; this prevents short network jitter from evicting
      // workloads and makes the transition observable to operators.
      await db
        .update(nodes)
        .set({ status: "unhealthy", unhealthyAt: now, updatedAt: now })
        .where(and(
          inArray(nodes.status, ["ready", "draining"]),
          isNotNull(nodes.lastHeartbeatAt),
          lt(nodes.lastHeartbeatAt, unhealthyBefore),
        ));
      // The timestamp predicate is repeated in the UPDATE so a late heartbeat
      // cannot be overwritten by a controller tick that observed an old row.
      const stale = await db
        .update(nodes)
        .set({ status: "offline", offlineAt: now, updatedAt: now })
        .where(
          and(
            eq(nodes.status, "unhealthy"),
            isNotNull(nodes.lastHeartbeatAt),
            lt(nodes.lastHeartbeatAt, offlineBefore),
          ),
        )
        .returning({ id: nodes.id });
      for (const node of stale) {
        const assigned = await db
          .select()
          .from(workloads)
          .where(and(eq(workloads.nodeId, node.id), eq(workloads.desiredState, "running")));
        const affectedDeployments = new Set<string>();
        await db.transaction(async (tx) => {
          for (const workload of assigned) {
            affectedDeployments.add(workload.deploymentId);
            const deployment = await tx.query.deployments.findFirst({
              where: eq(deployments.id, workload.deploymentId),
              columns: { runtimeConfig: true },
            });
            const hasPersistentVolumes = Boolean(
              z.object({ volumes: z.array(z.unknown()).optional() })
                .safeParse(deployment?.runtimeConfig)
                .data?.volumes?.length,
            );
            await tx
              .update(workloads)
              .set({
                actualState: "lost",
                healthStatus: "unknown",
                healthMessage: "Node heartbeat timed out",
                lostAt: now,
                lastReportedAt: now,
                // Do not move a volume-backed workload. Stateless workloads
                // are retired so a returning node cannot revive a duplicate.
                ...(!hasPersistentVolumes ? { desiredState: "stopped" as const } : {}),
              })
              .where(and(eq(workloads.id, workload.id), eq(workloads.nodeId, node.id)));
            if (!hasPersistentVolumes) {
              await tx.insert(agentCommands).values({
                id: crypto.randomUUID(),
                nodeId: node.id,
                type: "workload.stop",
                resourceId: workload.id,
                deadlineAt: new Date(now.getTime() + 2 * 60_000),
                payload: { workloadId: workload.id, reason: "NODE_OFFLINE_REPLACEMENT" },
              });
            }
            await tx.insert(deploymentEvents).values({
              id: crypto.randomUUID(),
              deploymentId: workload.deploymentId,
              workloadId: workload.id,
              nodeId: node.id,
              type: "workload.lost",
              message: "Workload lost because its node heartbeat timed out",
              reason: "NODE_OFFLINE",
            });
          }
        });
        await Promise.all([...affectedDeployments].map((deploymentId) => refreshDeploymentStatus(deploymentId)));
        try {
          await reconcileDomainRoutesForNode(node.id);
        } catch (error) {
          logger.error({ error, nodeId: node.id }, "Unable to withdraw stale node routes");
        }
      }
    } catch (error) {
      logger.error({ error }, "Node liveness controller tick failed");
    }
  };
  timer = setInterval(() => void tick(), intervalMs);
  void tick();
}

export function stopNodeLivenessController(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
