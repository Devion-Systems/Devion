import type { NodeSnapshot, SchedulingDecision, WorkloadRequirements } from "./contracts.js";

/**
 * Stateless, deterministic V1 scheduler. Hard constraints are applied before
 * scoring so a selected node is always eligible and its decision is explainable.
 */
export function scheduleWorkload(
  nodes: readonly NodeSnapshot[],
  requirements: WorkloadRequirements,
): SchedulingDecision {
  const candidates = nodes.flatMap((node) => {
    const reasons: string[] = [];
    if (node.status !== "ready") reasons.push(`node-status:${node.status}`);
    if (!node.schedulingEnabled) reasons.push("scheduling-disabled");
    if (!node.runtimes.includes(requirements.runtime))
      reasons.push(`runtime-unavailable:${requirements.runtime}`);
    if (requirements.architecture && node.architecture !== requirements.architecture)
      reasons.push("architecture-mismatch");
    if (requirements.region && node.region !== requirements.region) reasons.push("region-mismatch");
    if (requirements.requiredNodeId && node.id !== requirements.requiredNodeId)
      reasons.push("node-affinity-mismatch");
    for (const port of requirements.requestedHostPorts ?? []) {
      if (node.reservedHostPorts?.has(`${port.hostPort}/${port.protocol}`))
        reasons.push(`host-port-unavailable:${port.hostPort}/${port.protocol}`);
    }
    for (const [key, value] of Object.entries(requirements.requiredLabels ?? {})) {
      if (node.labels[key] !== value) reasons.push(`label-mismatch:${key}`);
    }
    if (
      node.resources.cpuMilli.allocatable - node.resources.cpuMilli.reserved <
      requirements.cpuMilli
    )
      reasons.push("insufficient-cpu");
    if (
      node.resources.memoryMib.allocatable - node.resources.memoryMib.reserved <
      requirements.memoryMib
    )
      reasons.push("insufficient-memory");
    if (
      node.resources.storageMib.allocatable - node.resources.storageMib.reserved <
      requirements.storageMib
    )
      reasons.push("insufficient-storage");
    return reasons.length === 0
      ? [{ node, score: scoreNode(node), reasons: ["eligible", "balanced-load"] }]
      : [];
  });
  if (candidates.length === 0) return { reasons: ["no-eligible-node"] };
  candidates.sort(
    (left, right) => right.score - left.score || left.node.id.localeCompare(right.node.id),
  );
  const selected = candidates[0];
  if (!selected) return { reasons: ["no-eligible-node"] };
  return { nodeId: selected.node.id, reasons: selected.reasons };
}

function scoreNode(node: NodeSnapshot): number {
  const available = [
    node.resources.cpuMilli,
    node.resources.memoryMib,
    node.resources.storageMib,
  ].map((resource) =>
    resource.allocatable === 0
      ? 0
      : (resource.allocatable - resource.reserved) / resource.allocatable,
  );
  return available.reduce((sum, value) => sum + value, 0) / available.length;
}
