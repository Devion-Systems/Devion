import { expect, test } from "bun:test";
import { PostgresStore } from "./rate-limit.js";

test("PostgresStore atomically creates and increments shared counters", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const store = new PostgresStore({
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ count: 2, reset_at: "2026-08-27T12:00:00.000Z" }] };
    },
  });

  await expect(store.increment("auth:203.0.113.10", 60_000)).resolves.toEqual({
    count: 2,
    resetAt: Date.parse("2026-08-27T12:00:00.000Z"),
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]?.sql).toContain("ON CONFLICT (key) DO UPDATE");
  expect(calls[0]?.params).toEqual(["auth:203.0.113.10", 60_000]);
});
