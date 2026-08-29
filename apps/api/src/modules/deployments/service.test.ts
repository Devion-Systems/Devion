import { expect, test } from "bun:test";
import { deriveDeploymentStatus } from "./lifecycle.js";

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

test("reports stop progress separately from a settled stopped deployment", () => {
  expect(deriveDeploymentStatus("stopped", 1, [{ desiredState: "stopped", actualState: "running", healthStatus: "none", healthMessage: null }]).status).toBe("stopping");
  expect(deriveDeploymentStatus("stopped", 1, [{ desiredState: "stopped", actualState: "stopped", healthStatus: "none", healthMessage: null }]).status).toBe("stopped");
});
