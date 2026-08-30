import { agentCommands, db, deploymentEvents, workloads } from "@repo/db";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import type { Logger } from "pino";
import { refreshDeploymentStatus } from "../deployments/service.js";

let timer: ReturnType<typeof setInterval> | undefined;

/** Fails lifecycle commands that an agent accepted but never completed. */
export function startCommandTimeoutController(logger: Logger, intervalMs = 15_000): void {
  if (timer) return;
  const tick = async () => {
    const now = new Date();
    try {
      const expired = await db
        .select()
        .from(agentCommands)
        .where(and(
          inArray(agentCommands.status, ["pending", "delivered"]),
          isNotNull(agentCommands.deadlineAt),
          lt(agentCommands.deadlineAt, now),
          inArray(agentCommands.type, ["workload.start", "workload.stop", "workload.delete"]),
        ));
      for (const command of expired) {
        const [failed] = await db
          .update(agentCommands)
          .set({
            status: "failed",
            completedAt: now,
            result: { status: "failed", error: { code: "COMMAND_TIMEOUT", message: "Agent command deadline elapsed" } },
          })
          .where(and(eq(agentCommands.id, command.id), inArray(agentCommands.status, ["pending", "delivered"])))
          .returning({ id: agentCommands.id });
        if (!failed) continue;
        const workload = await db.query.workloads.findFirst({ where: eq(workloads.id, command.resourceId) });
        if (!workload) continue;
        const actualState = command.type === "workload.start" ? "failed" : "unknown";
        await db.transaction(async (tx) => {
          await tx.update(workloads).set({ actualState, healthMessage: "Agent command timed out", lastReportedAt: now }).where(eq(workloads.id, workload.id));
          await tx.insert(deploymentEvents).values({
            id: crypto.randomUUID(), deploymentId: workload.deploymentId, workloadId: workload.id, nodeId: workload.nodeId,
            type: "workload.command_timed_out", message: `Agent command ${command.type} timed out`, reason: "COMMAND_TIMEOUT",
          });
        });
        await refreshDeploymentStatus(workload.deploymentId);
      }
    } catch (error) {
      logger.error({ error }, "Agent command timeout controller tick failed");
    }
  };
  timer = setInterval(() => void tick(), intervalMs);
  void tick();
}

export function stopCommandTimeoutController(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
