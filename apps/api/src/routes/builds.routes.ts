import { applications, auditLogs, builds, db, deployments, member, organization, projects } from "@repo/db";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { isIP } from "node:net";
import { z } from "zod";
import { createBuilderRun, cancelBuilderRun, getBuilderLogs } from "../features/builds/builder-client.js";
import { auth } from "../features/auth/config.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

const routes = new Hono<AppEnv>();
routes.use("/*", requireAuthenticatedUser);
const triggerInput = z.object({
  deploy: z.boolean().default(true),
  replicas: z.number().int().min(1).max(100).default(1),
  cpuMilli: z.number().int().min(1).max(256_000).default(250),
  memoryMib: z.number().int().min(16).max(1_048_576).default(256),
  storageMib: z.number().int().min(0).max(1_048_576).default(0),
});

async function scope(request: Request, orgSlug: string, projectId: string) {
  const session = await auth.api.getSession({ headers: request.headers }); if (!session) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, orgSlug) }); if (!org) return null;
  const membership = await db.query.member.findFirst({ where: and(eq(member.organizationId, org.id), eq(member.userId, session.user.id)) }); if (!membership) return null;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.organizationId, org.id)) });
  return project ? { org, membership, project, userId: session.user.id } : null;
}
function canManage(role: string) { return role === "owner" || role === "admin"; }

function validateRepository(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Git repositories must use credential-free HTTPS URLs");
  const allowed = new Set((process.env.GIT_ALLOWED_HOSTS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
  const hostname = url.hostname.toLowerCase();
  const privateIp = isIP(hostname) && (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname));
  if ((hostname === "localhost" || hostname.endsWith(".local") || privateIp) && !allowed.has(hostname)) throw new Error("Internal Git hosts must be explicitly allowed with GIT_ALLOWED_HOSTS");
  return url.toString();
}

async function createBuild(input: { app: typeof applications.$inferSelect; organizationId: string; projectId: string; userId: string; trigger: "build" | "deploy" | "retry"; retryOfBuildId?: string; deployment: z.infer<typeof triggerInput> }) {
  if (!input.app.gitUrl) throw new Error("Application has no Git repository");
  const repositoryUrl = validateRepository(input.app.gitUrl);
  const prefix = process.env.DEVION_BUILD_IMAGE_PREFIX?.replace(/\/$/, "");
  if (!prefix) throw new Error("DEVION_BUILD_IMAGE_PREFIX is not configured");
  const builderPrefix = process.env.DEVION_BUILDER_IMAGE_PREFIX?.replace(/\/$/, "") ?? prefix;
  const buildId = crypto.randomUUID();
  const imageRepository = `${prefix}/${input.organizationId}/${input.projectId}/${input.app.id}`.toLowerCase();
  const imageTag = buildId;
  const configured = input.app.buildConfiguration as { dockerfile?: string; context?: string; target?: string; args?: Record<string, string> };
  const buildConfiguration = {
    strategy: "dockerfile",
    dockerfile: configured.dockerfile ?? `${input.app.rootDirectory === "." ? "" : `${input.app.rootDirectory}/`}Dockerfile`,
    context: configured.context ?? input.app.rootDirectory,
    ...(configured.target ? { target: configured.target } : {}),
    args: configured.args ?? {},
    deployment: { enabled: input.trigger !== "build", replicas: input.deployment.replicas },
    requirements: { cpuMilli: input.deployment.cpuMilli, memoryMib: input.deployment.memoryMib, storageMib: input.deployment.storageMib, runtime: "container" },
  };
  await db.insert(builds).values({ id: buildId, organizationId: input.organizationId, projectId: input.projectId, applicationId: input.app.id, triggeredBy: input.userId, trigger: input.trigger, retryOfBuildId: input.retryOfBuildId, repositoryUrl, repositoryProvider: input.app.repositoryProvider, branch: input.app.branch, buildConfiguration, imageRepository, imageTag });
  try {
    const builderRepository = `${builderPrefix}/${input.organizationId}/${input.projectId}/${input.app.id}`.toLowerCase();
    const run = await createBuilderRun({ buildId, repository: repositoryUrl, ref: input.app.branch, rootDirectory: buildConfiguration.context, dockerfile: buildConfiguration.dockerfile, target: buildConfiguration.target, buildArgs: buildConfiguration.args, image: `${builderRepository}:${imageTag}`, insecureRegistry: process.env.DEVION_BUILDER_REGISTRY_INSECURE === "true" });
    await db.update(builds).set({ status: "queued", builderJobId: run.id, queuedAt: new Date(run.createdAt) }).where(eq(builds.id, buildId));
  } catch (error) {
    await db.update(builds).set({ status: "failed", errorCode: "BUILDER_UNAVAILABLE", errorMessage: error instanceof Error ? error.message : "Builder unavailable", completedAt: new Date() }).where(eq(builds.id, buildId));
    throw error;
  }
  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: input.userId, action: input.trigger === "retry" ? "build.retried" : "build.created", targetType: "build", targetId: buildId, metadata: JSON.stringify({ applicationId: input.app.id, deploy: input.trigger !== "build" }) });
  return buildId;
}

routes.post("/:orgSlug/projects/:projectId/applications/:applicationId/builds", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(access.membership.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const app = await db.query.applications.findFirst({ where: and(eq(applications.id, c.req.param("applicationId")), eq(applications.projectId, access.project.id)) });
  if (!app) return c.json({ error: "Application not found" }, 404);
  if (app.sourceType !== "git") return c.json({ error: "Builds are available only for Git applications" }, 409);
  const parsed = triggerInput.safeParse(await c.req.json().catch(() => ({}))); if (!parsed.success) return c.json({ error: "Invalid build settings" }, 400);
  try { const buildId = await createBuild({ app, organizationId: access.org.id, projectId: access.project.id, userId: access.userId, trigger: parsed.data.deploy ? "deploy" : "build", deployment: parsed.data }); return c.json({ buildId, status: "queued" }, 202); }
  catch (error) { return c.json({ error: error instanceof Error ? error.message : "Build could not be queued" }, 503); }
});

routes.get("/:orgSlug/projects/:projectId/applications/:applicationId/builds", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  return c.json(await db.select().from(builds).where(and(eq(builds.projectId, access.project.id), eq(builds.applicationId, c.req.param("applicationId")))).orderBy(desc(builds.createdAt)));
});

routes.get("/:orgSlug/projects/:projectId/builds/:buildId", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const build = await db.query.builds.findFirst({ where: and(eq(builds.id, c.req.param("buildId")), eq(builds.projectId, access.project.id)) });
  if (!build) return c.json({ error: "Build not found" }, 404);
  const deployment = await db.query.deployments.findFirst({ where: eq(deployments.buildId, build.id) });
  return c.json({ ...build, deployment });
});

routes.get("/:orgSlug/projects/:projectId/builds/:buildId/logs", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const build = await db.query.builds.findFirst({ where: and(eq(builds.id, c.req.param("buildId")), eq(builds.projectId, access.project.id)) });
  if (!build?.builderJobId) return c.json({ error: "Build logs unavailable" }, 404);
  try { return c.json(await getBuilderLogs(build.builderJobId, Number(c.req.query("after") ?? 0))); } catch { return c.json({ error: "Builder logs unavailable" }, 503); }
});

routes.post("/:orgSlug/projects/:projectId/builds/:buildId/cancel", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(access.membership.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const build = await db.query.builds.findFirst({ where: and(eq(builds.id, c.req.param("buildId")), eq(builds.projectId, access.project.id)) });
  if (!build?.builderJobId || !["queued", "running", "pushing"].includes(build.status)) return c.json({ error: "Build cannot be cancelled" }, 409);
  await cancelBuilderRun(build.builderJobId); await db.update(builds).set({ status: "cancelled", completedAt: new Date() }).where(eq(builds.id, build.id));
  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "build.cancelled", targetType: "build", targetId: build.id });
  return c.json({ status: "cancelled" });
});

routes.post("/:orgSlug/projects/:projectId/builds/:buildId/retry", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(access.membership.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const previous = await db.query.builds.findFirst({ where: and(eq(builds.id, c.req.param("buildId")), eq(builds.projectId, access.project.id)) }); if (!previous || !["failed", "cancelled"].includes(previous.status)) return c.json({ error: "Only failed or cancelled builds can be retried" }, 409);
  const app = await db.query.applications.findFirst({ where: eq(applications.id, previous.applicationId) }); if (!app) return c.json({ error: "Application not found" }, 404);
  const config = previous.buildConfiguration as { deployment?: { enabled?: boolean; replicas?: number }; requirements?: { cpuMilli?: number; memoryMib?: number; storageMib?: number } };
  const deployment = triggerInput.parse({ deploy: config.deployment?.enabled ?? (previous.trigger !== "build"), replicas: config.deployment?.replicas, ...config.requirements });
  try { const buildId = await createBuild({ app, organizationId: access.org.id, projectId: access.project.id, userId: access.userId, trigger: "retry", retryOfBuildId: previous.id, deployment }); return c.json({ buildId, status: "queued" }, 202); } catch (error) { return c.json({ error: error instanceof Error ? error.message : "Retry could not be queued" }, 503); }
});

export { routes as buildRoutes };
