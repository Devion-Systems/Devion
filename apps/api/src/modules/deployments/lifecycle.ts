export type DeploymentStatus = "queued" | "scheduling" | "starting" | "running" | "degraded" | "failed" | "stopping" | "stopped" | "superseded";
type WorkloadFact = { desiredState: string; actualState: string; healthStatus: string; healthMessage: string | null };

export function deriveDeploymentStatus(desiredState: string, replicas: number, workloadItems: WorkloadFact[]): { status: DeploymentStatus; failureReason: string | null } {
  if (desiredState !== "running") {
    const settled = workloadItems.every((workload) => workload.actualState === "stopped" || workload.desiredState === "deleted");
    return { status: settled ? "stopped" : "stopping", failureReason: null };
  }
  const active = workloadItems.filter((workload) => workload.desiredState === "running");
  const lost = active.find((workload) => workload.actualState === "lost");
  if (lost) return { status: "degraded", failureReason: lost.healthMessage ?? "A workload was lost with its node" };
  const failure = active.find((workload) => workload.actualState === "failed");
  if (failure) return { status: active.some((workload) => workload.actualState === "running") ? "degraded" : "failed", failureReason: failure.healthMessage ?? "A workload failed" };
  if (active.some((workload) => workload.healthStatus === "unhealthy")) return { status: "degraded", failureReason: "A workload is unhealthy" };
  if (active.length < replicas) return { status: active.length === 0 ? "scheduling" : "starting", failureReason: null };
  if (active.every((workload) => workload.actualState === "running") && active.every((workload) => workload.healthStatus === "healthy" || workload.healthStatus === "none")) return { status: "running", failureReason: null };
  return { status: "starting", failureReason: null };
}
