import { expect, test } from "bun:test";
import { volumeMountsPayload } from "./volume-policy.js";

test("agent accepts a valid managed named-volume mount", () => {
  expect(volumeMountsPayload.safeParse([{ id: "46ac6dc2-6c87-4f79-bbd2-7ca7053ece4d", name: "devion-v-0123456789abcdef0123456789abcdef", target: "/data", readOnly: true }]).success).toBe(true);
});

test("agent rejects traversal, host-like paths, and duplicate targets", () => {
  expect(volumeMountsPayload.safeParse([{ name: "data", target: "/data/../etc" }]).success).toBe(false);
  expect(volumeMountsPayload.safeParse([{ name: "data", target: "/data//cache" }]).success).toBe(false);
  expect(volumeMountsPayload.safeParse([{ name: "data", target: "data" }]).success).toBe(false);
  expect(volumeMountsPayload.safeParse([{ name: "one", target: "/data" }, { name: "two", target: "/data" }]).success).toBe(false);
});
