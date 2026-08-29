import { db, nodes } from "@repo/db";
import { and, inArray, isNotNull, lt } from "drizzle-orm";
import type { Logger } from "pino";
import { reconcileDomainRoutesForNode } from "../../features/routing/controller.js";

let timer: ReturnType<typeof setInterval> | undefined;

/** Marks silent agents offline without trusting a stale last reported status. */
export function startNodeLivenessController(
  logger: Logger,
  intervalMs = 15_000,
  heartbeatTimeoutMs = 45_000,
): void {
  if (timer) return;
  const tick = async () => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - heartbeatTimeoutMs);
    try {
      // The timestamp predicate is repeated in the UPDATE so a late heartbeat
      // cannot be overwritten by a controller tick that observed an old row.
      const stale = await db
        .update(nodes)
        .set({ status: "offline", updatedAt: now })
        .where(
          and(
            inArray(nodes.status, ["ready", "draining", "unhealthy"]),
            isNotNull(nodes.lastHeartbeatAt),
            lt(nodes.lastHeartbeatAt, staleBefore),
          ),
        )
        .returning({ id: nodes.id });
      for (const node of stale) {
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
