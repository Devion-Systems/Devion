import { expect, test } from "bun:test";
import { deriveDeploymentStatus } from "./lifecycle.js";
import { managedVolumeMounts } from "../volumes/snapshot.js";

test("derives running only when every desired replica is running and healthy", () => {
  expect(deriveDeploymentStatus("running", 2, [
    { desiredState: "running", actualState: "running", healthStatus: "healthy", healthMessage: null },
    { desiredState: "running", actualState: "running", healthStatus: "none", healthMessage: null },
  ])).toEqual({ status: "running", failureReason: null });
});

test("preserves failed and degraded distinction from workload facts", () => {
  expect(deriveDeploymentStatus("running", 1, [{ desiredState: "running", actualState: "failed", healthStatus: "unhealthy", healthMessage: "image pull denied" }]))
    .toEqual({ status: "failed", failureReason: "image pull denied" });
  expect(deriveDeploymentStatus("running", 2, [
    { desiredState: "running", actualState: "running", healthStatus: "healthy", healthMessage: null },
    { desiredState: "running", actualState: "failed", healthStatus: "none", healthMessage: null },
  ])).toEqual({ status: "degraded", failureReason: "A workload failed" });
});

test("marks a deployment degraded when a workload is lost with its node", () => {
  expect(deriveDeploymentStatus("running", 1, [
    { desiredState: "running", actualState: "lost", healthStatus: "unknown", healthMessage: "Node heartbeat timed out" },
  ])).toEqual({ status: "degraded", failureReason: "Node heartbeat timed out" });
});

test("reports stop progress separately from a settled stopped deployment", () => {
  expect(deriveDeploymentStatus("stopped", 1, [{ desiredState: "stopped", actualState: "running", healthStatus: "none", healthMessage: null }]).status).toBe("stopping");
  expect(deriveDeploymentStatus("stopped", 1, [{ desiredState: "stopped", actualState: "stopped", healthStatus: "none", healthMessage: null }]).status).toBe("stopped");
});

test("captures only valid managed volume references in a deployment snapshot", () => {
  expect(managedVolumeMounts({ volumes: [
    { id: "46ac6dc2-6c87-4f79-bbd2-7ca7053ece4d", name: "devion-v-0123456789abcdef0123456789abcdef", target: "/data", readOnly: false },
    { id: "not-a-volume-id", name: "other", target: "/ignored" },
    { name: "legacy-volume", target: "/legacy" },
  ] })).toEqual([{ volumeId: "46ac6dc2-6c87-4f79-bbd2-7ca7053ece4d", mountPath: "/data", readOnly: false }]);
});
