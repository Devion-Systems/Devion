import { expect, test } from "bun:test";
import { PostgresStore, MemoryStore, createRateLimiter } from "./rate-limit.js";
import { Hono } from "hono";

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

test("untrusted forwarding headers cannot bypass the socket-IP rate limit", async () => {
  const previous = process.env.DEVION_TRUST_PROXY;
  process.env.DEVION_TRUST_PROXY = "false";
  const store = new MemoryStore();
  try {
    const app = new Hono();
    app.use("*", createRateLimiter({ store, max: 1, windowMs: 60_000 }));
    app.get("/", c => c.text("ok"));
    const request = (ip: string) => app.request("/", { headers: { "x-real-ip": ip, "x-forwarded-for": ip } }, { clientIp: "192.0.2.1" });
    expect((await request("198.51.100.1")).status).toBe(200);
    expect((await request("198.51.100.2")).status).toBe(429);
  } finally {
    store.destroy();
    if (previous === undefined) delete process.env.DEVION_TRUST_PROXY;
    else process.env.DEVION_TRUST_PROXY = previous;
  }
});
