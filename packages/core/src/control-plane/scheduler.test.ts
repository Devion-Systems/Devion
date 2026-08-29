import { expect, test } from "bun:test";
import type { NodeSnapshot, WorkloadRequirements } from "./contracts.js";
import { scheduleWorkload } from "./scheduler.js";

const requirements: WorkloadRequirements = {
  cpuMilli: 500,
  memoryMib: 512,
  storageMib: 1_024,
  runtime: "container",
  region: "de-fra",
  requiredLabels: { storage: "nvme" },
};
const resources = {
  cpuMilli: { capacity: 4_000, allocatable: 4_000, reserved: 0, usage: 0 },
  memoryMib: { capacity: 8_192, allocatable: 8_192, reserved: 0, usage: 0 },
  storageMib: { capacity: 20_000, allocatable: 20_000, reserved: 0, usage: 0 },
};
function node(id: string, patch: Partial<NodeSnapshot> = {}): NodeSnapshot {
  return {
    id,
    status: "ready",
    schedulingEnabled: true,
    architecture: "amd64",
    region: "de-fra",
    labels: { storage: "nvme" },
    runtimes: ["container"],
    resources,
    ...patch,
  };
}

test("scheduler rejects ineligible nodes before scoring", () => {
  const decision = scheduleWorkload(
    [node("offline", { status: "offline" }), node("wrong-label", { labels: {} }), node("eligible")],
    requirements,
  );
  expect(decision).toEqual({ nodeId: "eligible", reasons: ["eligible", "balanced-load"] });
});

test("scheduler honours persistent-volume node affinity", () => {
  const decision = scheduleWorkload(
    [node("pinned"), node("other")],
    { ...requirements, requiredNodeId: "pinned" },
  );
  expect(decision.nodeId).toBe("pinned");
  expect(scheduleWorkload([node("other")], { ...requirements, requiredNodeId: "pinned" }).reasons).toContain("no-eligible-node");
});

test("scheduler provides a deterministic no-placement result", () => {
  expect(
    scheduleWorkload(
      [
        node("tiny", {
          resources: { ...resources, memoryMib: { ...resources.memoryMib, allocatable: 128 } },
        }),
      ],
      requirements,
    ),
  ).toEqual({ reasons: ["no-eligible-node"] });
});
