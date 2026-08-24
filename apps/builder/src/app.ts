import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import type { RunRepository } from "./repository.ts";
import { validateWorkflow } from "./workflow.ts";

const createRunSchema = z.object({
  workflow: z.unknown(),
  source: z.object({ repository: z.string().url().max(2048).refine((value) => { if (!URL.canParse(value)) return false; const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }, "Repository must be a credential-free HTTPS URL"), ref: z.string().min(1).max(255).default("main") }),
  inputs: z.record(z.string(), z.string()).default({}),
  secrets: z.record(z.string(), z.string()).default({}),
});

export function createApp(repository: RunRepository, apiToken: string, corsOrigins: string[] = []) {
  const app = new Hono();
  app.use(logger());
  if (corsOrigins.length) app.use("/v1/*", cors({ origin: corsOrigins }));
  app.get("/health/live", (c) => c.json({ status: "ok" }));
  app.get("/health/ready", async (c) => {
    try { await repository.health(); return c.json({ status: "ok" }); }
    catch { return c.json({ status: "unavailable" }, 503); }
  });
  app.use("/v1/*", async (c, next) => {
    const provided = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const valid = provided.length === apiToken.length && timingSafeEqual(Buffer.from(provided), Buffer.from(apiToken));
    if (!valid) return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid bearer token" } }, 401);
    await next();
  });
  app.post("/v1/workflows/validate", async (c) => c.json(validateWorkflow((await c.req.json<{ workflow: unknown }>()).workflow)));
  app.post("/v1/runs", async (c) => {
    const parsed = createRunSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: { code: "INVALID_REQUEST", issues: parsed.error.issues } }, 422);
    const validation = validateWorkflow(parsed.data.workflow);
    if (!validation.valid || !validation.workflow) return c.json({ error: { code: "INVALID_WORKFLOW", issues: validation.errors } }, 422);
    const idempotencyKey = c.req.header("idempotency-key")?.trim() || crypto.randomUUID();
    if (idempotencyKey.length > 255) return c.json({ error: { code: "INVALID_IDEMPOTENCY_KEY" } }, 422);
    const result = await repository.create({ ...parsed.data, workflow: validation.workflow, idempotencyKey });
    return c.json({ data: publicRun(result.run) }, result.created ? 202 : 200);
  });
  app.get("/v1/runs", async (c) => c.json({ data: (await repository.list(Math.min(Number(c.req.query("limit") ?? 50), 100))).map(publicRun) }));
  app.get("/v1/runs/:id", async (c) => {
    const run = await repository.get(c.req.param("id"));
    return run ? c.json({ data: publicRun(run) }) : c.json({ error: { code: "NOT_FOUND" } }, 404);
  });
  app.post("/v1/runs/:id/cancel", async (c) => (await repository.requestCancel(c.req.param("id"))) ? c.json({ status: "accepted" }, 202) : c.json({ error: { code: "NOT_CANCELLABLE" } }, 409));
  app.get("/v1/runs/:id/logs", async (c) => c.json({ data: await repository.logs(c.req.param("id"), Number(c.req.query("after") ?? 0)) }));
  app.onError((error, c) => { console.error(error); return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal builder error" } }, 500); });
  return app;
}

function publicRun<T extends { secrets: Record<string, string> }>(run: T): Omit<T, "secrets"> {
  const { secrets: _, ...safe } = run; return safe;
}
