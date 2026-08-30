import { expect, test } from "bun:test";
import { chooseDynamicHostPort, DYNAMIC_HOST_PORT_MAX, DYNAMIC_HOST_PORT_MIN, hostPortPolicyError } from "./ports.js";

test("validates host ports through one central policy", () => {
  expect(hostPortPolicyError(0)).toBe("INVALID_PORT");
  expect(hostPortPolicyError(1)).toBe("PRIVILEGED_PORT_FORBIDDEN");
  expect(hostPortPolicyError(80)).toBe("PRIVILEGED_PORT_FORBIDDEN");
  expect(hostPortPolicyError(65_536)).toBe("INVALID_PORT");
  expect(hostPortPolicyError(25_565)).toBeNull();
});

test("allocates dynamic ports inside the configured range", () => {
  const port = chooseDynamicHostPort(new Set([30_000, 30_001]), "workload-a");
  expect(port).not.toBeNull();
  expect(port!).toBeGreaterThanOrEqual(DYNAMIC_HOST_PORT_MIN);
  expect(port!).toBeLessThanOrEqual(DYNAMIC_HOST_PORT_MAX);
});
