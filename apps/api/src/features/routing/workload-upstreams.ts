import { applicationPorts, db, deployments, nodes, workloadPorts, workloads } from "@repo/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { normalizeAdvertisedAddress, workloadUpstreamUrl } from "./safe-address.js";

export type WorkloadUpstream = { url: string; workloadId: string; nodeId: string };

export type WorkloadUpstreamTarget = {
  applicationId: string;
  deploymentId: string | null;
  targetPort: number;
  upstreamProtocol: "http" | "https";
  organizationId: string;
};

export { normalizeAdvertisedAddress, workloadUpstreamUrl } from "./safe-address.js";

/**
 * The only path from a public domain to an upstream. It joins trusted state
 * recorded by the control plane and deliberately has no user supplied URL.
 */
export async function resolveWorkloadUpstreams(target: WorkloadUpstreamTarget): Promise<WorkloadUpstream[]> {
  const port = await db.query.applicationPorts.findFirst({
    where: and(
      eq(applicationPorts.applicationId, target.applicationId),
      eq(applicationPorts.internalPort, target.targetPort),
      eq(applicationPorts.protocol, "tcp"),
      eq(applicationPorts.exposure, "public"),
    ),
  });
  if (!port) throw new Error("Target port is not a public TCP application port");

  const deployment = target.deploymentId
    ? await db.query.deployments.findFirst({
        where: and(eq(deployments.id, target.deploymentId), eq(deployments.applicationId, target.applicationId), eq(deployments.desiredState, "running")),
      })
    : await db.query.deployments.findFirst({
        where: and(eq(deployments.applicationId, target.applicationId), eq(deployments.desiredState, "running")),
        orderBy: [desc(deployments.version)],
      });
  if (!deployment) throw new Error("No running deployment is available for this domain target");

  const candidates = await db
    .select({
      workloadId: workloads.id,
      nodeId: nodes.id,
      advertisedAddress: nodes.advertisedAddress,
      hostPort: workloadPorts.hostPort,
      actualState: workloads.actualState,
      healthStatus: workloads.healthStatus,
      nodeStatus: nodes.status,
      organizationId: nodes.organizationId,
    })
    .from(workloads)
    .innerJoin(nodes, eq(workloads.nodeId, nodes.id))
    .innerJoin(workloadPorts, and(eq(workloadPorts.workloadId, workloads.id), eq(workloadPorts.containerPort, target.targetPort), eq(workloadPorts.protocol, "tcp"), eq(workloadPorts.exposure, "public")))
    .where(eq(workloads.deploymentId, deployment.id))
    .orderBy(asc(workloads.id));

  return candidates.flatMap((candidate) => {
    if (candidate.organizationId !== null && candidate.organizationId !== target.organizationId) return [];
    if (candidate.nodeStatus !== "ready" || candidate.actualState !== "running") return [];
    if (candidate.healthStatus === "starting" || candidate.healthStatus === "unhealthy") return [];
    if (!candidate.advertisedAddress) return [];
    try {
      return [{ workloadId: candidate.workloadId, nodeId: candidate.nodeId, url: workloadUpstreamUrl(target.upstreamProtocol, candidate.advertisedAddress, candidate.hostPort) }];
    } catch {
      return [];
    }
  });
}
