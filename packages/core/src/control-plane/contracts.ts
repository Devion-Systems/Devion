/** Public, runtime-neutral contracts shared by the control plane and node agents. */
export type NodeStatus =
  | "provisioning"
  | "ready"
  | "draining"
  | "offline"
  | "unhealthy"
  | "decommissioned";
export type RuntimeKind = "container" | "microvm";
export type WorkloadDesiredState = "running" | "stopped" | "deleted";
export type WorkloadActualState =
  | "pending"
  | "starting"
  | "running"
  | "stopped"
  | "failed"
  | "lost"
  | "unknown";

export interface ResourceQuantity {
  capacity: number;
  allocatable: number;
  reserved: number;
  usage: number;
}

export interface NodeResources {
  cpuMilli: ResourceQuantity;
  memoryMib: ResourceQuantity;
  storageMib: ResourceQuantity;
}

export interface NodeSnapshot {
  id: string;
  status: NodeStatus;
  schedulingEnabled: boolean;
  architecture: string;
  region?: string;
  labels: Record<string, string>;
  runtimes: RuntimeKind[];
  resources: NodeResources;
  reservedHostPorts?: ReadonlySet<string>;
}

export interface WorkloadRequirements {
  cpuMilli: number;
  memoryMib: number;
  storageMib: number;
  runtime: RuntimeKind;
  architecture?: string;
  region?: string;
  requiredLabels?: Record<string, string>;
  /** Persistent local volumes are tied to the node that first created them. */
  requiredNodeId?: string;
  requestedHostPorts?: Array<{ hostPort: number; protocol: "tcp" | "udp" }>;
}

export interface SchedulingDecision {
  nodeId?: string;
  reasons: string[];
}

export type AgentCommandType =
  | "workload.start"
  | "workload.stop"
  | "workload.restart"
  | "workload.delete"
  | "image.pull"
  | "volume.create"
  | "volume.delete"
  | "volume.attach"
  | "volume.detach"
  | "runtime.inspect"
  | "workload.logs"
  | "minecraft.command"
  | "minecraft.logs"
  | "minecraft.files.list"
  | "minecraft.files.read"
  | "minecraft.files.write";

export interface AgentCommand<TPayload = unknown> {
  commandId: string;
  type: AgentCommandType;
  timestamp: string;
  resourceId: string;
  payload: TPayload;
  deadline?: string;
}

export interface AgentCommandResult<TData = unknown> {
  commandId: string;
  status: "succeeded" | "failed";
  data?: TData;
  error?: { code: string; message: string };
}
