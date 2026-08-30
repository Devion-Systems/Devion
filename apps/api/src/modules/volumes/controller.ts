import { agentCommands, db, volumes } from "@repo/db";
import { and, eq } from "drizzle-orm";
import type { Logger } from "pino";
import { isManagedRuntimeName } from "./policy.js";

let timer: ReturnType<typeof setInterval> | undefined;

/** Reconciles the deliberately two-phase, destructive volume delete operation. */
export function startVolumeController(logger: Logger, intervalMs = 15_000): void {
  if (timer) return;
  const tick = async () => {
    try {
      const deleting = await db.select().from(volumes).where(eq(volumes.status, "deleting"));
      for (const volume of deleting) {
        if (!isManagedRuntimeName(volume.runtimeName)) {
          await db.update(volumes).set({ status: "error" }).where(eq(volumes.id, volume.id));
          continue;
        }
        if (!volume.nodeId) {
          await db.delete(volumes).where(and(eq(volumes.id, volume.id), eq(volumes.status, "deleting")));
          continue;
        }
        const command = await db.query.agentCommands.findFirst({
          where: and(eq(agentCommands.resourceId, volume.id), eq(agentCommands.type, "volume.delete")),
          orderBy: (commands, { desc }) => [desc(commands.createdAt)],
        });
        if (command?.status === "succeeded") {
          await db.delete(volumes).where(and(eq(volumes.id, volume.id), eq(volumes.status, "deleting")));
          continue;
        }
        if (command?.status === "failed") {
          await db.update(volumes).set({ status: "error" }).where(eq(volumes.id, volume.id));
          continue;
        }
        if (command && ["pending", "delivered"].includes(command.status)) continue;
        await db.insert(agentCommands).values({
          id: crypto.randomUUID(), nodeId: volume.nodeId, type: "volume.delete", resourceId: volume.id,
          deadlineAt: new Date(Date.now() + 2 * 60_000), payload: { runtimeName: volume.runtimeName },
        });
      }
    } catch (error) {
      logger.error({ error }, "Volume reconciliation failed");
    }
  };
  timer = setInterval(() => void tick(), intervalMs);
  void tick();
}

export function stopVolumeController(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
