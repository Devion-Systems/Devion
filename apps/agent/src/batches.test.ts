import { expect, test } from "bun:test";
import { sendBatches } from "./batches.js";

test("1000 workload reports are delivered in two bounded batches without overlap", async () => {
  const received: number[] = [];
  let calls = 0;
  await sendBatches(Array.from({ length: 1000 }, (_, i) => i), async batch => {
    calls++;
    expect(batch.length).toBeLessThanOrEqual(500);
    received.push(...batch);
  });
  expect(calls).toBe(2);
  expect(new Set(received).size).toBe(1000);
});

test("does not send empty batches or continue after rejection", async () => {
  let calls = 0;
  await sendBatches([], async () => { calls++; });
  expect(calls).toBe(0);
  await expect(sendBatches(Array(1001).fill(0), async () => { calls++; throw new Error("unavailable"); })).rejects.toThrow();
  expect(calls).toBe(1);
});
