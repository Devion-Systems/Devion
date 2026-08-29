import { applications, db, deployments, projectDomains, workloads } from "@repo/db";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import { reconcileProjectDomainRoutes } from "../../routes/projects.routes.js";

let timer: ReturnType<typeof setInterval> | undefined;
export function startDomainRouteController(logger: Logger, intervalMs = 15_000): void {
  if (timer || process.env.TRAEFIK_ENABLED !== "true") return;
  const tick = async () => {
    try {
      const domains = await db.select({ projectId: projectDomains.projectId }).from(projectDomains);
      for (const projectId of new Set(domains.map((domain) => domain.projectId))) {
        try { await reconcileProjectDomainRoutes(projectId); }
        catch (error) { logger.error({ error, projectId }, "Domain route reconciliation failed"); }
      }
    } catch (error) { logger.error({ error }, "Domain route controller tick failed"); }
  };
  timer = setInterval(() => void tick(), intervalMs); void tick();
}
export function stopDomainRouteController(): void { if (timer) clearInterval(timer); timer = undefined; }

/** Reconciles only projects that currently have a workload on this node. */
export async function reconcileDomainRoutesForNode(nodeId: string): Promise<void> {
  const affected = await db
    .select({ projectId: applications.projectId })
    .from(workloads)
    .innerJoin(deployments, eq(workloads.deploymentId, deployments.id))
    .innerJoin(applications, eq(deployments.applicationId, applications.id))
    .where(eq(workloads.nodeId, nodeId));
  for (const projectId of new Set(affected.map((item) => item.projectId)))
    await reconcileProjectDomainRoutes(projectId);
}
