import {
  applicationDeployments,
  applications,
  auditLogs,
  db,
  deployments,
  member,
  organization,
  projects,
  workloads,
} from "@repo/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import {
  reconcileDeployment,
  stopApplicationWorkloads,
} from "../modules/deployments/controller.js";
import type { AppEnv } from "../types/env.js";

const routes = new Hono<AppEnv>();
routes.use("/*", requireAuthenticatedUser);

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(64);
const applicationFields = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
  description: z.string().trim().max(500).nullable().optional(),
  sourceType: z.enum(["git", "docker"]),
  gitUrl: z.string().url().max(2_000).nullable().optional(),
  imageName: z.string().trim().min(1).max(500).nullable().optional(),
  branch: z.string().trim().min(1).max(255).optional(),
  internalPort: z.number().int().min(1).max(65_535).optional(),
  repositoryProvider: z.string().trim().min(1).max(64).optional(),
  rootDirectory: z.string().trim().min(1).max(512).refine((value) => !value.startsWith("/") && !value.split(/[\\/]+/).includes(".."), "Root directory must stay inside the repository").optional(),
  buildConfiguration: z.object({ dockerfile: z.string().min(1).max(512).optional(), context: z.string().min(1).max(512).optional(), target: z.string().min(1).max(128).optional(), args: z.record(z.string()).optional() }).optional(),
  autoDeployEnabled: z.boolean().optional(),
});
const applicationInput = applicationFields.superRefine((value, context) => {
  if (value.sourceType === "git" && !value.gitUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["gitUrl"],
      message: "Git URL is required",
    });
  }
  if (value.sourceType === "docker" && !value.imageName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["imageName"],
      message: "Docker image is required",
    });
  }
});
const applicationPatch = applicationFields.partial();
const deploymentRequest = z.object({
  replicas: z.number().int().min(1).max(100).default(1),
  cpuMilli: z.number().int().min(1).max(256_000).default(250),
  memoryMib: z.number().int().min(16).max(1_048_576).default(256),
  storageMib: z.number().int().min(0).max(1_048_576).default(0),
  region: z.string().trim().min(1).max(64).optional(),
  requiredLabels: z.record(z.string().min(1).max(64)).optional(),
});

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
    ipAddress:
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null,
  });
}

routes.get("/:orgSlug/applications", async (c) => {
  const scope = await getScope(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Organization not found or access denied" }, 404);
  const items = await db
    .select({
      id: applications.id,
      name: applications.name,
      slug: applications.slug,
      description: applications.description,
      sourceType: applications.sourceType,
      gitUrl: applications.gitUrl,
      imageName: applications.imageName,
      status: applications.status,
      branch: applications.branch,
      repositoryProvider: applications.repositoryProvider,
      rootDirectory: applications.rootDirectory,
      buildConfiguration: applications.buildConfiguration,
      autoDeployEnabled: applications.autoDeployEnabled,
      lastKnownCommit: applications.lastKnownCommit,
      internalPort: applications.internalPort,
      projectId: projects.id,
      projectName: projects.name,
      updatedAt: applications.updatedAt,
      createdAt: applications.createdAt,
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
  return c.json(
    await db
      .select()
      .from(applications)
      .where(eq(applications.projectId, scope.project.id))
      .orderBy(asc(applications.name)),
  );
});

routes.post("/:orgSlug/projects/:projectId/applications", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(scope.membership.role))
    return c.json({ error: "Owner or admin role required" }, 403);
  const parsed = applicationInput.safeParse(await c.req.json());
  if (!parsed.success)
    return c.json({ error: "Invalid application data", issues: parsed.error.flatten() }, 400);
  const id = crypto.randomUUID();
  try {
    await db.insert(applications).values({
      id,
      organizationId: scope.org.id,
      projectId: scope.project.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      sourceType: parsed.data.sourceType,
      gitUrl: parsed.data.sourceType === "git" ? (parsed.data.gitUrl ?? null) : null,
      imageName: parsed.data.sourceType === "docker" ? (parsed.data.imageName ?? null) : null,
      branch: parsed.data.branch ?? "main",
      internalPort: parsed.data.internalPort ?? 3000,
      repositoryProvider: parsed.data.repositoryProvider ?? "generic",
      rootDirectory: parsed.data.rootDirectory ?? ".",
      buildConfiguration: parsed.data.buildConfiguration ?? {},
      autoDeployEnabled: parsed.data.autoDeployEnabled ?? false,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      return c.json({ error: "An application with this slug already exists in the project" }, 409);
    throw error;
  }
  await recordAudit("application.created", id, scope.userId, c.req.raw);
  return c.json({ id, slug: parsed.data.slug }, 201);
});

routes.patch("/:orgSlug/projects/:projectId/applications/:applicationId", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(scope.membership.role))
    return c.json({ error: "Owner or admin role required" }, 403);
  const parsed = applicationPatch.safeParse(await c.req.json());
  if (!parsed.success || Object.keys(parsed.data).length === 0)
    return c.json({ error: "Invalid application data" }, 400);
  const current = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, c.req.param("applicationId")),
      eq(applications.projectId, scope.project.id),
    ),
  });
  if (!current) return c.json({ error: "Application not found" }, 404);
  const nextSourceType = parsed.data.sourceType ?? current.sourceType;
  const nextGitUrl = parsed.data.gitUrl === undefined ? current.gitUrl : parsed.data.gitUrl;
  const nextImageName =
    parsed.data.imageName === undefined ? current.imageName : parsed.data.imageName;
  if (nextSourceType === "git" && !nextGitUrl)
    return c.json({ error: "A Git URL is required" }, 400);
  if (nextSourceType === "docker" && !nextImageName)
    return c.json({ error: "A Docker image is required" }, 400);
  try {
    const [updated] = await db
      .update(applications)
      .set({
        ...parsed.data,
        sourceType: nextSourceType,
        gitUrl: nextSourceType === "git" ? nextGitUrl : null,
        imageName: nextSourceType === "docker" ? nextImageName : null,
      })
      .where(eq(applications.id, current.id))
      .returning();
    await recordAudit("application.updated", current.id, scope.userId, c.req.raw);
    return c.json(updated);
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      return c.json({ error: "An application with this slug already exists in the project" }, 409);
    throw error;
  }
});

routes.delete("/:orgSlug/projects/:projectId/applications/:applicationId", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(scope.membership.role))
    return c.json({ error: "Owner or admin role required" }, 403);
  const current = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, c.req.param("applicationId")),
      eq(applications.projectId, scope.project.id),
    ),
  });
  if (!current) return c.json({ error: "Application not found" }, 404);
  if (current.containerName)
    return c.json(
      {
        error:
          "This legacy application has a locally managed container. Stop and migrate it to an agent-managed deployment before deletion.",
      },
      409,
    );
  const activeWorkload = await db
    .select({ id: workloads.id })
    .from(workloads)
    .innerJoin(deployments, eq(workloads.deploymentId, deployments.id))
    .where(and(eq(deployments.applicationId, current.id), eq(workloads.desiredState, "running")))
    .limit(1);
  if (activeWorkload.length > 0)
    return c.json(
      { error: "Stop the application and wait for all agent workloads to stop before deletion." },
      409,
    );
  const [removed] = await db
    .delete(applications)
    .where(eq(applications.id, current.id))
    .returning({ id: applications.id });
  if (!removed) return c.json({ error: "Application not found" }, 404);
  await recordAudit("application.deleted", removed.id, scope.userId, c.req.raw);
  return c.body(null, 204);
});

routes.get("/:orgSlug/projects/:projectId/applications/:applicationId/runtime", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  const application = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, c.req.param("applicationId")),
      eq(applications.projectId, scope.project.id),
    ),
  });
  if (!application) return c.json({ error: "Application not found" }, 404);
  const deploymentItems = await db
    .select()
    .from(deployments)
    .where(eq(deployments.applicationId, application.id))
    .orderBy(desc(deployments.createdAt));
  const workloadItems =
    deploymentItems.length === 0
      ? []
      : await Promise.all(
          deploymentItems.map((deployment) =>
            db.select().from(workloads).where(eq(workloads.deploymentId, deployment.id)),
          ),
        );
  const events = await db
    .select()
    .from(applicationDeployments)
    .where(eq(applicationDeployments.applicationId, application.id))
    .orderBy(desc(applicationDeployments.createdAt))
    .limit(20);
  const flatWorkloads = workloadItems.flat();
  const status = flatWorkloads.some((workload) => workload.actualState === "failed")
    ? "failed"
    : flatWorkloads.some((workload) => workload.actualState === "running")
      ? "healthy"
      : flatWorkloads.some((workload) => workload.desiredState === "running")
        ? "deploying"
        : application.status;
  return c.json({
    status,
    internalPort: application.internalPort,
    deployments: deploymentItems,
    workloads: flatWorkloads,
    events,
  });
});

routes.post("/:orgSlug/projects/:projectId/applications/:applicationId/deploy", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(scope.membership.role))
    return c.json({ error: "Owner or admin role required" }, 403);
  const application = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, c.req.param("applicationId")),
      eq(applications.projectId, scope.project.id),
    ),
  });
  if (!application) return c.json({ error: "Application not found" }, 404);
  if (application.sourceType !== "docker" || !application.imageName)
    return c.json(
      { error: "Git applications require the build worker and cannot be deployed yet" },
      409,
    );
  const parsed = deploymentRequest.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return c.json(
      { error: "Invalid deployment requirements", issues: parsed.error.flatten() },
      400,
    );
  const previous = await db
    .select({ version: deployments.version })
    .from(deployments)
    .where(eq(deployments.applicationId, application.id))
    .orderBy(desc(deployments.version))
    .limit(1);
  const deploymentId = crypto.randomUUID();
  await db.insert(deployments).values({
    id: deploymentId,
    applicationId: application.id,
    version: (previous[0]?.version ?? 0) + 1,
    image: application.imageName,
    replicas: parsed.data.replicas,
    desiredState: "running",
    runtime: "container",
    requirements: {
      cpuMilli: parsed.data.cpuMilli,
      memoryMib: parsed.data.memoryMib,
      storageMib: parsed.data.storageMib,
      runtime: "container",
      ...(parsed.data.region ? { region: parsed.data.region } : {}),
      ...(parsed.data.requiredLabels ? { requiredLabels: parsed.data.requiredLabels } : {}),
    },
  });
  await db
    .update(applications)
    .set({ status: "deploying" })
    .where(eq(applications.id, application.id));
  await db.insert(applicationDeployments).values({
    id: crypto.randomUUID(),
    applicationId: application.id,
    actorId: scope.userId,
    action: "deploy",
    status: "succeeded",
    message: `Deployment ${deploymentId} queued for agent reconciliation`,
  });
  await reconcileDeployment(deploymentId);
  await recordAudit("application.deployed", application.id, scope.userId, c.req.raw);
  return c.json({ deploymentId, status: "deploying", internalPort: application.internalPort }, 202);
});

routes.post("/:orgSlug/projects/:projectId/applications/:applicationId/stop", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!canManage(scope.membership.role))
    return c.json({ error: "Owner or admin role required" }, 403);
  const application = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, c.req.param("applicationId")),
      eq(applications.projectId, scope.project.id),
    ),
  });
  if (!application) return c.json({ error: "Application not found" }, 404);
  if (application.containerName)
    return c.json(
      {
        error:
          "This legacy application has a locally managed container and must be migrated before agent control is available.",
      },
      409,
    );
  await stopApplicationWorkloads(application.id);
  await db
    .update(applications)
    .set({ status: "stopped" })
    .where(eq(applications.id, application.id));
  await db.insert(applicationDeployments).values({
    id: crypto.randomUUID(),
    applicationId: application.id,
    actorId: scope.userId,
    action: "stop",
    status: "succeeded",
    message: "Stop commands queued for agent workloads",
  });
  await recordAudit("application.stopped", application.id, scope.userId, c.req.raw);
  return c.json({ status: "stopping" }, 202);
});

export { routes as applicationRoutes };
