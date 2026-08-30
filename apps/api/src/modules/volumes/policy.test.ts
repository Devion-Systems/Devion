import { expect, test } from "bun:test";
import { isManagedRuntimeName, isSafeMountPath } from "./policy.js";

test("accepts only Devion-generated Docker runtime volume names", () => {
  expect(isManagedRuntimeName("devion-v-0123456789abcdef0123456789abcdef")).toBe(true);
  expect(isManagedRuntimeName("customer-data")).toBe(false);
  expect(isManagedRuntimeName("devion-v-../../etc")).toBe(false);
});

test("mount target validation rejects ambiguous and unsafe paths", () => {
  expect(isSafeMountPath("/data")).toBe(true);
  expect(isSafeMountPath("/app/uploads")).toBe(true);
  expect(isSafeMountPath("data")).toBe(false);
  expect(isSafeMountPath("/data/../etc")).toBe(false);
  expect(isSafeMountPath("/data//cache")).toBe(false);
  expect(isSafeMountPath("/data\0secret")).toBe(false);
});
