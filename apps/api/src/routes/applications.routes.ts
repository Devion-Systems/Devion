import { applicationDeployments, applications, auditLogs, db, member, organization, projects } from "@repo/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import { ApplicationRuntime } from "../lib/hosting/application-runtime.js";
import type { AppEnv } from "../types/env.js";

const routes = new Hono<AppEnv>();
routes.use("/*", requireAuthenticatedUser);

const slugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64);
const applicationFields = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
  description: z.string().trim().max(500).nullable().optional(),
  sourceType: z.enum(["git", "docker"]),
  gitUrl: z.string().url().max(2_000).nullable().optional(),
  imageName: z.string().trim().min(1).max(500).nullable().optional(),
  branch: z.string().trim().min(1).max(255).optional(),
  internalPort: z.number().int().min(1).max(65_535).optional(),
});
const applicationInput = applicationFields
  .superRefine((value, context) => {
    if (value.sourceType === "git" && !value.gitUrl) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["gitUrl"], message: "Git URL is required" });
    }
    if (value.sourceType === "docker" && !value.imageName) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["imageName"], message: "Docker image is required" });
    }
  });
const applicationPatch = applicationFields.partial();
const runtime = new ApplicationRuntime();

async function getScope(request: Request, orgSlug: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, orgSlug) });
  if (!org) return null;
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, org.id), eq(member.userId, session.user.id)),
  });
  return membership ? { org, membership, userId: session.user.id } : null;
}

function canManage(role: string) {
  return role === "owner" || role === "admin";
}

async function getProjectScope(request: Request, orgSlug: string, projectId: string) {
  const scope = await getScope(request, orgSlug);
  if (!scope) return null;
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.organizationId, scope.org.id)),
  });
  return project ? { ...scope, project } : null;
}

function recordAudit(action: string, targetId: string, userId: string, request: Request) {
  return db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorId: userId,
    action,
    targetType: "application",
    targetId,
    ipAddress: request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
}

routes.get("/:orgSlug/applications", async (c) => {
  const scope = await getScope(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Organization not found or access denied" }, 404);
  const items = await db
    .select({
      id: applications.id, name: applications.name, slug: applications.slug,
      description: applications.description, sourceType: applications.sourceType,
      gitUrl: applications.gitUrl, imageName: applications.imageName,
      status: applications.status, branch: applications.branch, internalPort: applications.internalPort, projectId: projects.id,
      projectName: projects.name, updatedAt: applications.updatedAt, createdAt: applications.createdAt,
    })
    .from(applications)
    .innerJoin(projects, eq(applications.projectId, projects.id))
    .where(eq(applications.organizationId, scope.org.id))
    .orderBy(asc(projects.name), asc(applications.name));
  return c.json(items);
});

routes.get("/:orgSlug/projects/:projectId/applications", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  return c.json(await db.select().from(applications).where(eq(applications.projectId, scope.project.id)).orderBy(asc(applications.name)));
});

routes.post("/:orgSlug/projects/:projectId/applications", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(scope.membership.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const parsed = applicationInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid application data", issues: parsed.error.flatten() }, 400);
  const id = crypto.randomUUID();
  try {
    await db.insert(applications).values({
      id, organizationId: scope.org.id, projectId: scope.project.id,
      name: parsed.data.name, slug: parsed.data.slug, description: parsed.data.description ?? null,
      sourceType: parsed.data.sourceType, gitUrl: parsed.data.sourceType === "git" ? parsed.data.gitUrl ?? null : null,
      imageName: parsed.data.sourceType === "docker" ? parsed.data.imageName ?? null : null,
      branch: parsed.data.branch ?? "main",
      internalPort: parsed.data.internalPort ?? 3000,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return c.json({ error: "An application with this slug already exists in the project" }, 409);
    throw error;
  }
  await recordAudit("application.created", id, scope.userId, c.req.raw);
  return c.json({ id, slug: parsed.data.slug }, 201);
});

routes.patch("/:orgSlug/projects/:projectId/applications/:applicationId", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(scope.membership.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const parsed = applicationPatch.safeParse(await c.req.json());
  if (!parsed.success || Object.keys(parsed.data).length === 0) return c.json({ error: "Invalid application data" }, 400);
  const current = await db.query.applications.findFirst({ where: and(eq(applications.id, c.req.param("applicationId")), eq(applications.projectId, scope.project.id)) });
  if (!current) return c.json({ error: "Application not found" }, 404);
  const nextSourceType = parsed.data.sourceType ?? current.sourceType;
  const nextGitUrl = parsed.data.gitUrl === undefined ? current.gitUrl : parsed.data.gitUrl;
  const nextImageName = parsed.data.imageName === undefined ? current.imageName : parsed.data.imageName;
  if (nextSourceType === "git" && !nextGitUrl) return c.json({ error: "A Git URL is required" }, 400);
  if (nextSourceType === "docker" && !nextImageName) return c.json({ error: "A Docker image is required" }, 400);
  try {
    const [updated] = await db.update(applications).set({
      ...parsed.data,
      sourceType: nextSourceType,
      gitUrl: nextSourceType === "git" ? nextGitUrl : null,
      imageName: nextSourceType === "docker" ? nextImageName : null,
    }).where(eq(applications.id, current.id)).returning();
    await recordAudit("application.updated", current.id, scope.userId, c.req.raw);
    return c.json(updated);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return c.json({ error: "An application with this slug already exists in the project" }, 409);
    throw error;
  }
});

routes.delete("/:orgSlug/projects/:projectId/applications/:applicationId", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(scope.membership.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const current = await db.query.applications.findFirst({ where: and(eq(applications.id, c.req.param("applicationId")), eq(applications.projectId, scope.project.id)) });
  if (!current) return c.json({ error: "Application not found" }, 404);
  if (current.containerName) {
    try { await runtime.remove(current.containerName); } catch (error) { c.get("logger").error({ error, applicationId: current.id }, "Application container removal failed"); return c.json({ error: "Application container could not be removed" }, 503); }
  }
  const [removed] = await db.delete(applications).where(eq(applications.id, current.id)).returning({ id: applications.id });
  if (!removed) return c.json({ error: "Application not found" }, 404);
  await recordAudit("application.deleted", removed.id, scope.userId, c.req.raw);
  return c.body(null, 204);
});

routes.get("/:orgSlug/projects/:projectId/applications/:applicationId/runtime", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  const application = await db.query.applications.findFirst({ where: and(eq(applications.id, c.req.param("applicationId")), eq(applications.projectId, scope.project.id)) });
  if (!application) return c.json({ error: "Application not found" }, 404);
  const status = application.containerName ? await runtime.status(application.containerName) : application.status;
  const events = await db.select().from(applicationDeployments).where(eq(applicationDeployments.applicationId, application.id)).orderBy(desc(applicationDeployments.createdAt)).limit(20);
  return c.json({ status, containerName: application.containerName, internalPort: application.internalPort, events });
});

routes.post("/:orgSlug/projects/:projectId/applications/:applicationId/deploy", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(scope.membership.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const application = await db.query.applications.findFirst({ where: and(eq(applications.id, c.req.param("applicationId")), eq(applications.projectId, scope.project.id)) });
  if (!application) return c.json({ error: "Application not found" }, 404);
  if (application.sourceType !== "docker" || !application.imageName) return c.json({ error: "Git applications require the build worker and cannot be deployed yet" }, 409);
  const containerName = application.containerName ?? `devion-app-${application.id.replaceAll("-", "")}`;
  try {
    const status = await runtime.deploy({ containerName, imageName: application.imageName, internalPort: application.internalPort, labels: { "devion.organization-id": scope.org.id, "devion.project-id": scope.project.id, "devion.application-id": application.id } });
    await db.update(applications).set({ containerName, status }).where(eq(applications.id, application.id));
    await db.insert(applicationDeployments).values({ id: crypto.randomUUID(), applicationId: application.id, actorId: scope.userId, action: "deploy", status: "succeeded", message: `Docker image ${application.imageName} started` });
    await recordAudit("application.deployed", application.id, scope.userId, c.req.raw);
    return c.json({ status, containerName, internalPort: application.internalPort });
  } catch (error) {
    await db.update(applications).set({ status: "failed" }).where(eq(applications.id, application.id));
    await db.insert(applicationDeployments).values({ id: crypto.randomUUID(), applicationId: application.id, actorId: scope.userId, action: "deploy", status: "failed", message: "Docker image could not be started" });
    c.get("logger").error({ error, applicationId: application.id }, "Application deployment failed");
    return c.json({ error: "Application deployment failed" }, 503);
  }
});

routes.post("/:orgSlug/projects/:projectId/applications/:applicationId/stop", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(scope.membership.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const application = await db.query.applications.findFirst({ where: and(eq(applications.id, c.req.param("applicationId")), eq(applications.projectId, scope.project.id)) });
  if (!application?.containerName) return c.json({ error: "Running application not found" }, 404);
  try { const status = await runtime.stop(application.containerName); await db.update(applications).set({ status }).where(eq(applications.id, application.id)); await db.insert(applicationDeployments).values({ id: crypto.randomUUID(), applicationId: application.id, actorId: scope.userId, action: "stop", status: "succeeded", message: "Container stopped" }); await recordAudit("application.stopped", application.id, scope.userId, c.req.raw); return c.json({ status }); } catch (error) { c.get("logger").error({ error, applicationId: application.id }, "Application stop failed"); return c.json({ error: "Application could not be stopped" }, 503); }
});

export { routes as applicationRoutes };
