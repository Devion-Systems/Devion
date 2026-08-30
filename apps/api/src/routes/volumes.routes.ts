import { applicationVolumeMounts, auditLogs, db, deploymentVolumeMounts, volumes } from "@repo/db";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import { resolveProjectAccess } from "../features/projects/access.js";
import type { AppEnv } from "../types/env.js";

const routes = new Hono<AppEnv>();
routes.use("/*", requireAuthenticatedUser);

const volumeName = z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/);
const createInput = z.object({ name: volumeName, capacityMib: z.number().int().positive().max(1_048_576).nullable().optional() });

function runtimeName(): string {
  return `devion-v-${crypto.randomUUID().replaceAll("-", "")}`;
}

async function scope(request: Request, orgSlug: string, projectId: string) {
  return resolveProjectAccess(request, orgSlug, projectId, "volumes.manage");
}

function audit(action: string, volumeId: string, actorId: string, projectId: string) {
  return db.insert(auditLogs).values({
    id: crypto.randomUUID(), actorId, action, targetType: "volume", targetId: volumeId,
    metadata: JSON.stringify({ projectId }),
  });
}

routes.get("/:orgSlug/projects/:projectId/volumes", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const items = await db
    .select({ volume: volumes, attachmentCount: count(applicationVolumeMounts.id) })
    .from(volumes)
    .leftJoin(applicationVolumeMounts, eq(applicationVolumeMounts.volumeId, volumes.id))
    .where(eq(volumes.projectId, access.project.id))
    .groupBy(volumes.id);
  return c.json(items.map(({ volume, attachmentCount }) => ({ ...volume, attachmentCount })));
});

routes.post("/:orgSlug/projects/:projectId/volumes", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const parsed = createInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid volume", issues: parsed.error.flatten() }, 400);
  try {
    const [created] = await db.insert(volumes).values({
      id: crypto.randomUUID(), projectId: access.project.id, name: parsed.data.name,
      runtimeName: runtimeName(), capacityMib: parsed.data.capacityMib ?? null, createdBy: access.userId,
    }).returning();
    if (!created) throw new Error("Volume could not be created");
    await audit("volume.created", created.id, access.userId, access.project.id);
    return c.json(created, 201);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return c.json({ error: "A volume with this name already exists in the project" }, 409);
    throw error;
  }
});

routes.delete("/:orgSlug/projects/:projectId/volumes/:volumeId", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const volume = await db.query.volumes.findFirst({ where: and(eq(volumes.id, c.req.param("volumeId")), eq(volumes.projectId, access.project.id)) });
  if (!volume) return c.json({ error: "Volume not found" }, 404);
  const attachment = await db.query.applicationVolumeMounts.findFirst({ where: eq(applicationVolumeMounts.volumeId, volume.id) });
  if (attachment) return c.json({ error: "Detach this volume from every application before deletion" }, 409);
  const deploymentReference = await db.query.deploymentVolumeMounts.findFirst({ where: eq(deploymentVolumeMounts.volumeId, volume.id) });
  if (deploymentReference) return c.json({ error: "Volume is retained by a deployment snapshot and cannot be deleted" }, 409);
  // Docker data is intentionally not removed by this API yet. A runtime-aware
  // delete/reconciliation command is required before destructive deletion.
  await db.update(volumes).set({ status: "deleting" }).where(eq(volumes.id, volume.id));
  await audit("volume.delete_requested", volume.id, access.userId, access.project.id);
  return c.json({ status: "deleting", message: "Runtime deletion requires node reconciliation" }, 202);
});

export { routes as volumeRoutes };
