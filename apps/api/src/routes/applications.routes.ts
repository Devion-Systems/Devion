import {
  applicationDeployments,
  agentCommands,
  applicationBuildConfigurations,
  applicationEnvironmentVariables,
  applicationPorts,
  applicationResourceConfigurations,
  applicationRuntimeConfigurations,
  applicationSecretAttachments,
  applicationVolumeMounts,
  applications,
  auditLogs,
  builds,
  db,
  deploymentEvents,
  deployments,
  environmentVariables,
  projectEnvironments,
  projects,
  user,
  workloads,
} from "@repo/db";
import { and, asc, count, desc, eq, ilike, inArray, isNull, like, or, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import {
  reconcileDeployment,
  restartDeploymentWorkloads,
  stopApplicationWorkloads,
  supersedePreviousDeployments,
} from "../modules/deployments/controller.js";
import { createDeployment, createRedeployment, createRollbackDeployment, refreshDeploymentStatus } from "../modules/deployments/service.js";
import type { AppEnv } from "../types/env.js";
import { listAccessibleProjects, resolveProjectAccess } from "../features/projects/access.js";
import { decryptEnvironmentValue, encryptEnvironmentValue } from "../features/environments/crypto.js";
import { PostgresWorkloadMetricsProvider } from "../features/metrics/postgres-provider.js";
import { aggregateWorkloadMetrics, metricBucketMs } from "../features/metrics/service.js";

const routes = new Hono<AppEnv>();
routes.use("/*", requireAuthenticatedUser);

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(64);
// OCI repositories are deliberately kept lowercase; tags may use the Docker
// tag character set and immutable SHA-256 digests are accepted directly.
const imageReferenceSchema = z.string().trim().min(1).max(500).refine(
  (value) => /^(?:[a-z0-9][a-z0-9._-]*(?::[0-9]+)?\/)*[a-z0-9][a-z0-9._/-]*(?:(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})|(?:@sha256:[a-f0-9]{64}))?$/.test(value),
  "Image must be a valid OCI/Docker reference",
);
const applicationFields = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
  description: z.string().trim().max(500).nullable().optional(),
  applicationType: z.enum(["web", "api", "worker", "game_server", "custom"]).optional(),
  defaultEnvironmentId: z.string().uuid().nullable().optional(),
  sourceType: z.enum(["git", "docker"]),
  gitUrl: z.string().url().max(2_000).nullable().optional(),
  imageName: imageReferenceSchema.nullable().optional(),
  branch: z.string().trim().min(1).max(255).optional(),
  internalPort: z.number().int().min(1).max(65_535).optional(),
  repositoryProvider: z.string().trim().min(1).max(64).optional(),
  rootDirectory: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .refine(
      (value) => !value.startsWith("/") && !value.split(/[\\/]+/).includes(".."),
      "Root directory must stay inside the repository",
    )
    .optional(),
  buildConfiguration: z
    .object({
      dockerfile: z.string().min(1).max(512).optional(),
      context: z.string().min(1).max(512).optional(),
      target: z.string().min(1).max(128).optional(),
      args: z.record(z.string()).optional(),
    })
    .optional(),
  autoDeployEnabled: z.boolean().optional(),
  gitCredentialReference: z.string().uuid().nullable().optional(),
  registryCredentialReference: z.string().uuid().nullable().optional(),
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
  environmentId: z.string().uuid().optional(),
  replicas: z.number().int().min(1).max(100).optional(),
  cpuMilli: z.number().int().min(1).max(256_000).optional(),
  memoryMib: z.number().int().min(16).max(1_048_576).optional(),
  storageMib: z.number().int().min(0).max(1_048_576).optional(),
  region: z.string().trim().min(1).max(64).optional(),
  requiredLabels: z.record(z.string().min(1).max(64)).optional(),
});
function isCredentialFreeHttpsGitUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
async function secretReferenceInProject(projectId: string, reference: string | null | undefined) {
  if (!reference) return true;
  const credential = await db
    .select({ id: environmentVariables.id })
    .from(environmentVariables)
    .innerJoin(projectEnvironments, eq(environmentVariables.environmentId, projectEnvironments.id))
    .where(and(eq(environmentVariables.id, reference), eq(environmentVariables.isSecret, true), eq(projectEnvironments.projectId, projectId)))
    .limit(1);
  return credential.length > 0;
}
const buildConfigurationInput = z.object({
  buildMode: z.literal("dockerfile").default("dockerfile"), runtime: z.string().trim().min(1).max(64).default("container"), runtimeVersion: z.string().trim().max(64).nullable().optional(), rootDirectory: z.string().trim().min(1).max(512).refine((value) => !value.startsWith("/") && !value.split(/[\\/]+/).includes("..")), installCommand: z.string().max(2_000).nullable().optional(), buildCommand: z.string().max(2_000).nullable().optional(), startCommand: z.string().max(2_000).nullable().optional(), dockerfilePath: z.string().trim().max(512).nullable().optional(), buildContext: z.string().trim().max(512).nullable().optional(),
});
const runtimeConfigurationInput = z.object({ runtime: z.literal("container").default("container"), command: z.string().trim().min(1).max(2_000).nullable().optional(), workingDirectory: z.string().trim().min(1).max(512).refine((value) => value.startsWith("/")).nullable().optional(), restartPolicy: z.enum(["no", "on-failure", "always", "unless-stopped"]).default("unless-stopped"), gracefulShutdownSeconds: z.number().int().min(1).max(600).default(15), healthcheckCommand: z.string().trim().min(1).max(2_000).nullable().optional(), healthcheckIntervalSeconds: z.number().int().min(1).max(3_600).default(30), healthcheckTimeoutSeconds: z.number().int().min(1).max(600).default(5), healthcheckRetries: z.number().int().min(1).max(20).default(3), healthcheckStartPeriodSeconds: z.number().int().min(0).max(3_600).default(0), replicas: z.number().int().min(1).max(100).default(1) });
const resourceConfigurationInput = z.object({ cpuMilli: z.number().int().min(1).max(256_000).default(250), memoryMib: z.number().int().min(16).max(1_048_576).default(256), storageMib: z.number().int().min(0).max(1_048_576).default(0) });
const portsInput = z.array(z.object({ name: z.string().trim().min(1).max(64).nullable().optional(), internalPort: z.number().int().min(1).max(65_535), protocol: z.enum(["tcp", "udp"]).default("tcp"), exposure: z.enum(["private", "public"]).default("private"), externalPort: z.number().int().min(1).max(65_535).nullable().optional(), description: z.string().trim().max(500).nullable().optional() })).max(32).superRefine((ports, ctx) => { const seen = new Set<string>(); ports.forEach((port, index) => { const key = `${port.internalPort}/${port.protocol}`; if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "internalPort"], message: "Duplicate internal port and protocol" }); if (port.externalPort && port.exposure !== "public") ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "externalPort"], message: "An external port requires public exposure" }); seen.add(key); }); });
const volumeMountInput = z.object({ volumeName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/), mountPath: z.string().startsWith("/").max(512), readOnly: z.boolean().default(false) });
const secretAttachmentInput = z.object({ environmentId: z.string().uuid(), secretEnvironmentVariableId: z.string().uuid(), targetKey: z.string().regex(/^[A-Z_][A-Z0-9_]{0,127}$/) });
const applicationVariableInput = z.object({ environmentId: z.string().uuid().nullable().optional(), value: z.string().max(16_384) });

async function getProjectScope(request: Request, orgSlug: string, projectId: string) {
  const access = await resolveProjectAccess(request, orgSlug, projectId, "applications.read");
  return access ? { org: access.organization, project: access.project, userId: access.userId, permissions: access.permissions } : null;
}

function recordAudit(action: string, targetId: string, userId: string, request: Request, projectId: string) {
  return db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorId: userId,
    action,
    targetType: "application",
    targetId,
    metadata: JSON.stringify({ projectId }),
    ipAddress:
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null,
  });
}

routes.get("/:orgSlug/applications", async (c) => {
  const scope = await listAccessibleProjects(c.req.raw, c.req.param("orgSlug"), "applications.read");
  if (!scope) return c.json({ error: "Organization not found or access denied" }, 404);
  const projectIds = scope.projects.map((project) => project.id);
  const query = c.req.query();
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit ?? "25", 10) || 25));
  const paginated = query.page !== undefined || query.limit !== undefined;
  if (!projectIds.length) return c.json(paginated ? { items: [], page, limit, total: 0, totalPages: 0 } : []);
  const search = query.search?.trim();
  const sourceType = query.sourceType === "git" || query.sourceType === "docker" ? query.sourceType : undefined;
  const lifecycleStatus = query.status === "active" || query.status === "archived" ? query.status : undefined;
  const applicationType = ["web", "api", "worker", "game_server", "custom"].includes(query.type ?? "") ? query.type as "web" | "api" | "worker" | "game_server" | "custom" : undefined;
  const conditions: SQL[] = [eq(applications.organizationId, scope.organization.id), inArray(applications.projectId, projectIds)];
  if (query.projectId) conditions.push(eq(applications.projectId, query.projectId));
  if (sourceType) conditions.push(eq(applications.sourceType, sourceType));
  if (lifecycleStatus) conditions.push(eq(applications.lifecycleStatus, lifecycleStatus));
  if (applicationType) conditions.push(eq(applications.applicationType, applicationType));
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(ilike(applications.name, pattern), ilike(applications.slug, pattern), ilike(applications.description, pattern), ilike(applications.gitUrl, pattern), ilike(applications.imageName, pattern))!);
  }
  const where = and(...conditions);
  const orderBy = query.sort === "name" ? asc(applications.name) : query.sort === "created" ? desc(applications.createdAt) : desc(applications.updatedAt);
  const listing = db
    .select({
      id: applications.id,
      name: applications.name,
      slug: applications.slug,
      description: applications.description,
      sourceType: applications.sourceType,
      gitUrl: applications.gitUrl,
      imageName: applications.imageName,
      status: applications.status,
      lifecycleStatus: applications.lifecycleStatus,
      applicationType: applications.applicationType,
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
    .where(where)
    .orderBy(orderBy);
  const [items, totalRows] = await Promise.all([
    paginated ? listing.limit(limit).offset((page - 1) * limit) : listing,
    paginated ? db.select({ total: count() }).from(applications).where(where) : Promise.resolve([]),
  ]);
  if (!paginated) return c.json(items);
  const total = totalRows[0]?.total ?? 0;
  return c.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
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
  if (!scope.permissions.includes("applications.create")) return c.json({ error: "Permission required: applications.create" }, 403);
  if (scope.project.status === "archived") return c.json({ error: "Archived projects cannot receive new applications" }, 409);
  const parsed = applicationInput.safeParse(await c.req.json());
  if (!parsed.success)
    return c.json({ error: "Invalid application data", issues: parsed.error.flatten() }, 400);
  if (parsed.data.defaultEnvironmentId) {
    const environment = await db.query.projectEnvironments.findFirst({ where: and(eq(projectEnvironments.id, parsed.data.defaultEnvironmentId), eq(projectEnvironments.projectId, scope.project.id)) });
    if (!environment) return c.json({ error: "Default environment must belong to this project" }, 400);
  }
  if (parsed.data.sourceType === "git" && parsed.data.gitUrl && !isCredentialFreeHttpsGitUrl(parsed.data.gitUrl))
    return c.json({ error: "Git repositories must use credential-free HTTPS URLs" }, 400);
  if (!(await secretReferenceInProject(scope.project.id, parsed.data.gitCredentialReference)) || !(await secretReferenceInProject(scope.project.id, parsed.data.registryCredentialReference)))
    return c.json({ error: "Git credential must be a secret variable in this project" }, 400);
  const id = crypto.randomUUID();
  try {
    await db.insert(applications).values({
      id,
      organizationId: scope.org.id,
      projectId: scope.project.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
       description: parsed.data.description ?? null,
       applicationType: parsed.data.applicationType ?? "custom",
       defaultEnvironmentId: parsed.data.defaultEnvironmentId ?? null,
      sourceType: parsed.data.sourceType,
      gitUrl: parsed.data.sourceType === "git" ? (parsed.data.gitUrl ?? null) : null,
      imageName: parsed.data.sourceType === "docker" ? (parsed.data.imageName ?? null) : null,
      branch: parsed.data.branch ?? "main",
      internalPort: parsed.data.internalPort ?? 3000,
      repositoryProvider: parsed.data.repositoryProvider ?? "generic",
      rootDirectory: parsed.data.rootDirectory ?? ".",
      buildConfiguration: parsed.data.buildConfiguration ?? {},
      autoDeployEnabled: parsed.data.autoDeployEnabled ?? false,
      gitCredentialReference: parsed.data.gitCredentialReference ?? null,
      registryCredentialReference: parsed.data.registryCredentialReference ?? null,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      return c.json({ error: "An application with this slug already exists in the project" }, 409);
    throw error;
  }
  await recordAudit("application.created", id, scope.userId, c.req.raw, scope.project.id);
  return c.json({ id, slug: parsed.data.slug }, 201);
});

routes.patch("/:orgSlug/projects/:projectId/applications/:applicationId", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("applications.update")) return c.json({ error: "Permission required: applications.update" }, 403);
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
  if (parsed.data.defaultEnvironmentId) {
    const environment = await db.query.projectEnvironments.findFirst({ where: and(eq(projectEnvironments.id, parsed.data.defaultEnvironmentId), eq(projectEnvironments.projectId, scope.project.id)) });
    if (!environment) return c.json({ error: "Default environment must belong to this project" }, 400);
  }
  if (parsed.data.sourceType && parsed.data.sourceType !== current.sourceType)
    return c.json({ error: "Application source type cannot be changed; create a new application instead" }, 409);
  const nextSourceType = parsed.data.sourceType ?? current.sourceType;
  const nextGitUrl = parsed.data.gitUrl === undefined ? current.gitUrl : parsed.data.gitUrl;
  const nextImageName =
    parsed.data.imageName === undefined ? current.imageName : parsed.data.imageName;
  if (nextSourceType === "git" && !nextGitUrl)
    return c.json({ error: "A Git URL is required" }, 400);
  if (nextSourceType === "git" && nextGitUrl && !isCredentialFreeHttpsGitUrl(nextGitUrl))
    return c.json({ error: "Git repositories must use credential-free HTTPS URLs" }, 400);
  const nextGitCredentialReference = parsed.data.gitCredentialReference === undefined ? current.gitCredentialReference : parsed.data.gitCredentialReference;
  const nextRegistryCredentialReference = parsed.data.registryCredentialReference === undefined ? current.registryCredentialReference : parsed.data.registryCredentialReference;
  if (!(await secretReferenceInProject(scope.project.id, nextGitCredentialReference)) || !(await secretReferenceInProject(scope.project.id, nextRegistryCredentialReference)))
    return c.json({ error: "Git credential must be a secret variable in this project" }, 400);
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
    await recordAudit("application.updated", current.id, scope.userId, c.req.raw, scope.project.id);
    return c.json(updated);
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      return c.json({ error: "An application with this slug already exists in the project" }, 409);
    throw error;
  }
});

routes.post("/:orgSlug/projects/:projectId/applications/:applicationId/archive", async (c) => {
  const scope = await resolveProjectAccess(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"), "applications.archive");
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  const application = await db.query.applications.findFirst({
    where: and(eq(applications.id, c.req.param("applicationId")), eq(applications.projectId, scope.project.id)),
  });
  if (!application) return c.json({ error: "Application not found" }, 404);
  if (application.lifecycleStatus === "archived") return c.json(application);
  const [updated] = await db.update(applications).set({ lifecycleStatus: "archived", archivedAt: new Date() }).where(eq(applications.id, application.id)).returning();
  await recordAudit("application.archived", application.id, scope.userId, c.req.raw, scope.project.id);
  return c.json(updated);
});

routes.post("/:orgSlug/projects/:projectId/applications/:applicationId/restore", async (c) => {
  const scope = await resolveProjectAccess(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"), "applications.archive");
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  const application = await db.query.applications.findFirst({
    where: and(eq(applications.id, c.req.param("applicationId")), eq(applications.projectId, scope.project.id)),
  });
  if (!application) return c.json({ error: "Application not found" }, 404);
  if (application.lifecycleStatus !== "archived") return c.json(application);
  const [updated] = await db.update(applications).set({ lifecycleStatus: "active", archivedAt: null }).where(eq(applications.id, application.id)).returning();
  await recordAudit("application.restored", application.id, scope.userId, c.req.raw, scope.project.id);
  return c.json(updated);
});

routes.delete("/:orgSlug/projects/:projectId/applications/:applicationId", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("applications.delete")) return c.json({ error: "Permission required: applications.delete" }, 403);
  const confirmation = z.object({ name: z.string().trim().min(1) }).safeParse(await c.req.json().catch(() => ({})));
  const current = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, c.req.param("applicationId")),
      eq(applications.projectId, scope.project.id),
    ),
  });
  if (!current) return c.json({ error: "Application not found" }, 404);
  if (!confirmation.success || confirmation.data.name !== current.name)
    return c.json({ error: "Type the exact application name to confirm deletion" }, 400);
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
  const [deploymentTotal, buildTotal, workloadTotal] = await Promise.all([
    db.select({ total: count() }).from(deployments).where(eq(deployments.applicationId, current.id)),
    db.select({ total: count() }).from(builds).where(eq(builds.applicationId, current.id)),
    db.select({ total: count() }).from(workloads).innerJoin(deployments, eq(workloads.deploymentId, deployments.id)).where(eq(deployments.applicationId, current.id)),
  ]);
  const dependencies = {
    deployments: deploymentTotal[0]?.total ?? 0,
    builds: buildTotal[0]?.total ?? 0,
    workloads: workloadTotal[0]?.total ?? 0,
  };
  if (dependencies.deployments || dependencies.builds || dependencies.workloads)
    return c.json({ error: "Application has dependent resources", dependencies }, 409);
  const [removed] = await db
    .delete(applications)
    .where(eq(applications.id, current.id))
    .returning({ id: applications.id });
  if (!removed) return c.json({ error: "Application not found" }, 404);
  await recordAudit("application.deleted", removed.id, scope.userId, c.req.raw, scope.project.id);
  return c.body(null, 204);
});

async function applicationInScope(scope: NonNullable<Awaited<ReturnType<typeof getProjectScope>>>, applicationId: string) {
  return db.query.applications.findFirst({ where: and(eq(applications.id, applicationId), eq(applications.projectId, scope.project.id)) });
}

async function deploymentInScope(scope: NonNullable<Awaited<ReturnType<typeof getProjectScope>>>, deploymentId: string) {
  const [item] = await db.select({ deployment: deployments, application: applications })
    .from(deployments)
    .innerJoin(applications, eq(deployments.applicationId, applications.id))
    .where(and(eq(deployments.id, deploymentId), eq(applications.projectId, scope.project.id)))
    .limit(1);
  return item ?? null;
}

const deploymentListQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30) });
type DeploymentMarkerItem = { deployment: { id: string; applicationId: string; version: number; desiredState: string; status: string } };
function markDeploymentRevisions<T extends DeploymentMarkerItem>(items: T[], universe: DeploymentMarkerItem[] = items) {
  const byApplication = new Map<string, T[]>();
  for (const item of universe) byApplication.set(item.deployment.applicationId, [...(byApplication.get(item.deployment.applicationId) ?? []), item as T]);
  return items.map((item) => {
    const revisions = byApplication.get(item.deployment.applicationId) ?? [];
    const latest = revisions.reduce((best, candidate) => candidate.deployment.version > best.deployment.version ? candidate : best, item);
    const current = revisions.filter((candidate) => candidate.deployment.desiredState === "running").reduce<T | undefined>((best, candidate) => !best || candidate.deployment.version > best.deployment.version ? candidate : best, undefined);
    const successful = revisions.filter((candidate) => candidate.deployment.status === "running").reduce<T | undefined>((best, candidate) => !best || candidate.deployment.version > best.deployment.version ? candidate : best, undefined);
    return { ...item, revisionState: { isLatest: item.deployment.id === latest.deployment.id, isCurrent: item.deployment.id === current?.deployment.id, isLastSuccessful: item.deployment.id === successful?.deployment.id } };
  });
}

routes.get("/:orgSlug/deployments", async (c) => {
  const accessible = await listAccessibleProjects(c.req.raw, c.req.param("orgSlug"), "deployments.read");
  if (!accessible) return c.json({ error: "Organization not found or access denied" }, 404);
  const query = deploymentListQuery.safeParse(c.req.query());
  if (!query.success) return c.json({ error: "Invalid pagination" }, 400);
  const projectIds = accessible.projects.map((project) => project.id);
  if (!projectIds.length) return c.json({ items: [], page: query.data.page, limit: query.data.limit, total: 0 });
  const offset = (query.data.page - 1) * query.data.limit;
  const items = await db.select({ deployment: deployments, application: { id: applications.id, name: applications.name, slug: applications.slug }, project: { id: projects.id, name: projects.name } })
    .from(deployments).innerJoin(applications, eq(deployments.applicationId, applications.id)).innerJoin(projects, eq(applications.projectId, projects.id))
    .where(inArray(applications.projectId, projectIds)).orderBy(desc(deployments.createdAt)).limit(query.data.limit).offset(offset);
  const [total] = await db.select({ total: count() }).from(deployments).innerJoin(applications, eq(deployments.applicationId, applications.id)).where(inArray(applications.projectId, projectIds));
  const universe = items.length ? await db.select({ deployment: deployments }).from(deployments).where(inArray(deployments.applicationId, [...new Set(items.map((item) => item.deployment.applicationId))])) : [];
  return c.json({ items: markDeploymentRevisions(items, universe), page: query.data.page, limit: query.data.limit, total: total?.total ?? 0 });
});

routes.get("/:orgSlug/projects/:projectId/deployments", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("deployments.read")) return c.json({ error: "Permission required: deployments.read" }, 403);
  const query = deploymentListQuery.safeParse(c.req.query());
  if (!query.success) return c.json({ error: "Invalid pagination" }, 400);
  const offset = (query.data.page - 1) * query.data.limit;
  const items = await db.select({ deployment: deployments, application: { id: applications.id, name: applications.name, slug: applications.slug } })
    .from(deployments).innerJoin(applications, eq(deployments.applicationId, applications.id))
    .where(eq(applications.projectId, scope.project.id)).orderBy(desc(deployments.createdAt)).limit(query.data.limit).offset(offset);
  const [total] = await db.select({ total: count() }).from(deployments).innerJoin(applications, eq(deployments.applicationId, applications.id)).where(eq(applications.projectId, scope.project.id));
  const universe = items.length ? await db.select({ deployment: deployments }).from(deployments).where(inArray(deployments.applicationId, [...new Set(items.map((item) => item.deployment.applicationId))])) : [];
  return c.json({ items: markDeploymentRevisions(items, universe), page: query.data.page, limit: query.data.limit, total: total?.total ?? 0 });
});

routes.get("/:orgSlug/projects/:projectId/deployments/:deploymentId", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("deployments.read")) return c.json({ error: "Permission required: deployments.read" }, 403);
  const item = await deploymentInScope(scope, c.req.param("deploymentId"));
  if (!item) return c.json({ error: "Deployment not found" }, 404);
  const [workloadItems, eventItems] = await Promise.all([
    db.select().from(workloads).where(eq(workloads.deploymentId, item.deployment.id)).orderBy(asc(workloads.createdAt)),
    db.select().from(deploymentEvents).where(eq(deploymentEvents.deploymentId, item.deployment.id)).orderBy(desc(deploymentEvents.createdAt)).limit(100),
  ]);
  const revisions = await db.select({ deployment: deployments }).from(deployments).where(eq(deployments.applicationId, item.deployment.applicationId));
  const revisionState = markDeploymentRevisions(revisions).find((revision) => revision.deployment.id === item.deployment.id)?.revisionState;
  return c.json({ deployment: item.deployment, application: item.application, revisionState, workloads: workloadItems, events: eventItems, secretPolicy: "Secret references are immutable; secret values are resolved by the agent at runtime and are never stored in a deployment snapshot." });
});

routes.get("/:orgSlug/projects/:projectId/deployments/:deploymentId/events", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("deployments.read")) return c.json({ error: "Permission required: deployments.read" }, 403);
  const item = await deploymentInScope(scope, c.req.param("deploymentId"));
  if (!item) return c.json({ error: "Deployment not found" }, 404);
  return c.json(await db.select().from(deploymentEvents).where(eq(deploymentEvents.deploymentId, item.deployment.id)).orderBy(desc(deploymentEvents.createdAt)).limit(500));
});

routes.get("/:orgSlug/projects/:projectId/deployments/:deploymentId/metrics", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("deployments.read")) return c.json({ error: "Permission required: deployments.read" }, 403);
  const item = await deploymentInScope(scope, c.req.param("deploymentId"));
  if (!item) return c.json({ error: "Deployment not found" }, 404);
  const range = z.enum(["15m", "1h", "6h", "24h", "7d"]).safeParse(c.req.query("range") ?? "1h");
  if (!range.success) return c.json({ error: "Invalid metrics range" }, 400);
  const durationMs = ({ "15m": 15 * 60_000, "1h": 60 * 60_000, "6h": 6 * 60 * 60_000, "24h": 24 * 60 * 60_000, "7d": 7 * 24 * 60 * 60_000 } as const)[range.data];
  const to = new Date(); const from = new Date(to.getTime() - durationMs); const bucketMs = metricBucketMs(range.data);
  const workloadIds = (await db.select({ id: workloads.id }).from(workloads).where(eq(workloads.deploymentId, item.deployment.id))).map((workload) => workload.id);
  const samples = await new PostgresWorkloadMetricsProvider().query(workloadIds, from, to, bucketMs);
  return c.json({ range: range.data, from: from.toISOString(), to: to.toISOString(), workloads: workloadIds, samples: aggregateWorkloadMetrics(samples, bucketMs) });
});

routes.get("/:orgSlug/projects/:projectId/deployments/:deploymentId/logs", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("deployments.read")) return c.json({ error: "Permission required: deployments.read" }, 403);
  const item = await deploymentInScope(scope, c.req.param("deploymentId"));
  if (!item) return c.json({ error: "Deployment not found" }, 404);
  const query = applicationLogsQuery.safeParse(c.req.query());
  if (!query.success) return c.json({ error: "Invalid log request" }, 400);
  const active = await db.select({ id: workloads.id, nodeId: workloads.nodeId, actualState: workloads.actualState }).from(workloads).where(eq(workloads.deploymentId, item.deployment.id));
  const entries = await Promise.all(active.map(async (workload) => {
    const [latest, pending] = await Promise.all([
      db.select({ result: agentCommands.result, completedAt: agentCommands.completedAt }).from(agentCommands).where(and(eq(agentCommands.resourceId, workload.id), eq(agentCommands.type, "workload.logs"), eq(agentCommands.status, "succeeded"))).orderBy(desc(agentCommands.completedAt)).limit(1),
      db.query.agentCommands.findFirst({ where: and(eq(agentCommands.resourceId, workload.id), eq(agentCommands.type, "workload.logs"), or(eq(agentCommands.status, "pending"), eq(agentCommands.status, "delivered"))) }),
    ]);
    if (workload.nodeId && workload.actualState === "running" && !pending) await db.insert(agentCommands).values({ id: crypto.randomUUID(), nodeId: workload.nodeId, type: "workload.logs", resourceId: workload.id, payload: { tail: query.data.tail } });
    const result = latest[0]?.result as { data?: { logs?: unknown } } | null;
    return { workloadId: workload.id, status: workload.actualState, logs: typeof result?.data?.logs === "string" ? result.data.logs : "", updatedAt: latest[0]?.completedAt?.toISOString() ?? null };
  }));
  return c.json({ workloads: entries });
});

async function runDeploymentAction(c: any, action: "start" | "stop" | "restart" | "rollback" | "redeploy") {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  const permissionByAction = {
    start: "deployments.start",
    stop: "deployments.stop",
    restart: "deployments.restart",
    rollback: "deployments.rollback",
    redeploy: "deployments.redeploy",
  } as const;
  const permission = permissionByAction[action];
  if (!scope.permissions.includes(permission)) return c.json({ error: `Permission required: ${permission}` }, 403);
  const item = await deploymentInScope(scope, c.req.param("deploymentId"));
  if (!item) return c.json({ error: "Deployment not found" }, 404);
  if (action === "start" && item.deployment.status === "superseded")
    return c.json({ error: "Superseded revisions cannot be started directly; use redeploy to create a new current revision" }, 409);
  if (action === "rollback" || action === "redeploy") {
    const created = action === "rollback" ? await createRollbackDeployment(item.deployment.id, scope.userId) : await createRedeployment(item.deployment.id, scope.userId);
    await supersedePreviousDeployments(created.applicationId, created.id);
    await reconcileDeployment(created.id);
    await recordAudit(`deployment.${action}`, created.id, scope.userId, c.req.raw, scope.project.id);
    return c.json({ deploymentId: created.id, revision: created.version, status: created.status, sourceDeploymentId: item.deployment.id }, 202);
  }
  const desiredState = action === "stop" ? "stopped" : "running";
  await db.update(deployments).set({ desiredState, status: action === "stop" ? "stopping" : "queued", failureReason: null }).where(eq(deployments.id, item.deployment.id));
  await db.insert(deploymentEvents).values({ id: crypto.randomUUID(), deploymentId: item.deployment.id, type: `deployment.${action}_requested`, message: `${action[0]!.toUpperCase()}${action.slice(1)} requested` });
  if (action === "restart") await restartDeploymentWorkloads(item.deployment.id); else await reconcileDeployment(item.deployment.id);
  await refreshDeploymentStatus(item.deployment.id);
  await recordAudit(`deployment.${action}`, item.deployment.id, scope.userId, c.req.raw, scope.project.id);
  return c.json({ deploymentId: item.deployment.id, status: action === "stop" ? "stopping" : "queued" }, 202);
}

for (const action of ["start", "stop", "restart", "rollback", "redeploy"] as const) {
  routes.post(`/:orgSlug/projects/:projectId/deployments/:deploymentId/${action}`, (c) => runDeploymentAction(c, action));
}

routes.get("/:orgSlug/projects/:projectId/applications/:applicationId/configuration", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  const application = await applicationInScope(scope, c.req.param("applicationId"));
  if (!application) return c.json({ error: "Application not found" }, 404);
  const [build, runtime, resources, ports, volumes, secrets, environments, variables] = await Promise.all([
    db.query.applicationBuildConfigurations.findFirst({ where: eq(applicationBuildConfigurations.applicationId, application.id) }),
    db.query.applicationRuntimeConfigurations.findFirst({ where: eq(applicationRuntimeConfigurations.applicationId, application.id) }),
    db.query.applicationResourceConfigurations.findFirst({ where: eq(applicationResourceConfigurations.applicationId, application.id) }),
    db.select().from(applicationPorts).where(eq(applicationPorts.applicationId, application.id)),
    db.select().from(applicationVolumeMounts).where(eq(applicationVolumeMounts.applicationId, application.id)),
    scope.permissions.includes("secrets.read_metadata") ? db.select({ id: applicationSecretAttachments.id, environmentId: applicationSecretAttachments.environmentId, targetKey: applicationSecretAttachments.targetKey, key: environmentVariables.key }).from(applicationSecretAttachments).innerJoin(environmentVariables, eq(applicationSecretAttachments.secretEnvironmentVariableId, environmentVariables.id)).where(eq(applicationSecretAttachments.applicationId, application.id)) : Promise.resolve([]),
    db.select({ id: projectEnvironments.id, name: projectEnvironments.name, displayName: projectEnvironments.displayName }).from(projectEnvironments).where(eq(projectEnvironments.projectId, scope.project.id)),
    db.select().from(applicationEnvironmentVariables).where(eq(applicationEnvironmentVariables.applicationId, application.id)).orderBy(asc(applicationEnvironmentVariables.key)),
  ]);
  const applicationVariables = await Promise.all(variables.map(async (variable) => ({ id: variable.id, environmentId: variable.environmentId, key: variable.key, value: await decryptEnvironmentValue(variable.valueEncrypted), updatedAt: variable.updatedAt })));
  return c.json({ application, build: build ?? null, runtime: runtime ?? null, resources: resources ?? null, ports, volumes, secrets, environments, applicationVariables });
});

routes.get("/:orgSlug/projects/:projectId/applications/:applicationId/activity", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  const application = await applicationInScope(scope, c.req.param("applicationId"));
  if (!application) return c.json({ error: "Application not found" }, 404);
  const items = await db.select({ id: auditLogs.id, action: auditLogs.action, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt, actorName: user.name, actorEmail: user.email }).from(auditLogs).leftJoin(user, eq(auditLogs.actorId, user.id)).where(or(eq(auditLogs.targetId, application.id), like(auditLogs.metadata, `%"applicationId":"${application.id}"%`))).orderBy(desc(auditLogs.createdAt)).limit(50);
  return c.json(items);
});

routes.put("/:orgSlug/projects/:projectId/applications/:applicationId/build-configuration", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("applications.update")) return c.json({ error: "Permission required: applications.update" }, 403);
  const application = await applicationInScope(scope, c.req.param("applicationId"));
  if (!application) return c.json({ error: "Application not found" }, 404);
  if (application.sourceType !== "git") return c.json({ error: "Build configuration is available only for Git applications" }, 409);
  const parsed = buildConfigurationInput.safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Invalid build configuration", issues: parsed.error.flatten() }, 400);
  const value = parsed.data;
  const [updated] = await db.insert(applicationBuildConfigurations).values({ applicationId: application.id, ...value }).onConflictDoUpdate({ target: applicationBuildConfigurations.applicationId, set: value }).returning();
  // The legacy JSON is kept synchronized until old Builder clients are removed.
  await db.update(applications).set({ rootDirectory: value.rootDirectory, buildConfiguration: { dockerfile: value.dockerfilePath ?? undefined, context: value.buildContext ?? undefined } }).where(eq(applications.id, application.id));
  await recordAudit("application.build_updated", application.id, scope.userId, c.req.raw, scope.project.id);
  return c.json(updated);
});

routes.put("/:orgSlug/projects/:projectId/applications/:applicationId/runtime-configuration", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("applications.update")) return c.json({ error: "Permission required: applications.update" }, 403);
  const application = await applicationInScope(scope, c.req.param("applicationId")); if (!application) return c.json({ error: "Application not found" }, 404);
  const parsed = runtimeConfigurationInput.safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Invalid runtime configuration", issues: parsed.error.flatten() }, 400);
  const [updated] = await db.insert(applicationRuntimeConfigurations).values({ applicationId: application.id, ...parsed.data }).onConflictDoUpdate({ target: applicationRuntimeConfigurations.applicationId, set: parsed.data }).returning();
  await recordAudit("application.runtime_updated", application.id, scope.userId, c.req.raw, scope.project.id); return c.json(updated);
});

routes.put("/:orgSlug/projects/:projectId/applications/:applicationId/resources", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("applications.update")) return c.json({ error: "Permission required: applications.update" }, 403);
  const application = await applicationInScope(scope, c.req.param("applicationId")); if (!application) return c.json({ error: "Application not found" }, 404);
  const parsed = resourceConfigurationInput.safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Invalid resource requirements", issues: parsed.error.flatten() }, 400);
  const [updated] = await db.insert(applicationResourceConfigurations).values({ applicationId: application.id, ...parsed.data }).onConflictDoUpdate({ target: applicationResourceConfigurations.applicationId, set: parsed.data }).returning();
  await recordAudit("application.resources_updated", application.id, scope.userId, c.req.raw, scope.project.id); return c.json(updated);
});

routes.put("/:orgSlug/projects/:projectId/applications/:applicationId/ports", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("applications.update")) return c.json({ error: "Permission required: applications.update" }, 403);
  const application = await applicationInScope(scope, c.req.param("applicationId")); if (!application) return c.json({ error: "Application not found" }, 404);
  const parsed = portsInput.safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Invalid port configuration", issues: parsed.error.flatten() }, 400);
  await db.transaction(async (tx) => { await tx.delete(applicationPorts).where(eq(applicationPorts.applicationId, application.id)); if (parsed.data.length) await tx.insert(applicationPorts).values(parsed.data.map((port) => ({ id: crypto.randomUUID(), applicationId: application.id, ...port }))); });
  await recordAudit("application.ports_updated", application.id, scope.userId, c.req.raw, scope.project.id); return c.json(await db.select().from(applicationPorts).where(eq(applicationPorts.applicationId, application.id)));
});

routes.post("/:orgSlug/projects/:projectId/applications/:applicationId/volumes", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("volumes.manage")) return c.json({ error: "Permission required: volumes.manage" }, 403);
  const application = await applicationInScope(scope, c.req.param("applicationId")); if (!application) return c.json({ error: "Application not found" }, 404);
  const parsed = volumeMountInput.safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Invalid volume mount", issues: parsed.error.flatten() }, 400);
  try { const [mount] = await db.insert(applicationVolumeMounts).values({ id: crypto.randomUUID(), applicationId: application.id, ...parsed.data }).returning(); await recordAudit("application.volume_attached", application.id, scope.userId, c.req.raw, scope.project.id); return c.json(mount, 201); }
  catch (error) { if ((error as { code?: string }).code === "23505") return c.json({ error: "A volume is already mounted at this path" }, 409); throw error; }
});

routes.delete("/:orgSlug/projects/:projectId/applications/:applicationId/volumes/:mountId", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("volumes.manage")) return c.json({ error: "Permission required: volumes.manage" }, 403);
  const application = await applicationInScope(scope, c.req.param("applicationId")); if (!application) return c.json({ error: "Application not found" }, 404);
  const [removed] = await db.delete(applicationVolumeMounts).where(and(eq(applicationVolumeMounts.id, c.req.param("mountId")), eq(applicationVolumeMounts.applicationId, application.id))).returning({ id: applicationVolumeMounts.id });
  if (!removed) return c.json({ error: "Volume mount not found" }, 404); await recordAudit("application.volume_detached", application.id, scope.userId, c.req.raw, scope.project.id); return c.body(null, 204);
});

routes.post("/:orgSlug/projects/:projectId/applications/:applicationId/secrets", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("secrets.attach")) return c.json({ error: "Permission required: secrets.attach" }, 403);
  const application = await applicationInScope(scope, c.req.param("applicationId")); if (!application) return c.json({ error: "Application not found" }, 404);
  const parsed = secretAttachmentInput.safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Invalid secret attachment", issues: parsed.error.flatten() }, 400);
  const secret = await db.query.environmentVariables.findFirst({ where: eq(environmentVariables.id, parsed.data.secretEnvironmentVariableId) });
  const environment = await db.query.projectEnvironments.findFirst({ where: and(eq(projectEnvironments.id, parsed.data.environmentId), eq(projectEnvironments.projectId, scope.project.id)) });
  if (!environment || !secret || secret.environmentId !== environment.id || !secret.isSecret) return c.json({ error: "Secret must be an encrypted secret variable in the selected project environment" }, 400);
  try { const [attachment] = await db.insert(applicationSecretAttachments).values({ id: crypto.randomUUID(), applicationId: application.id, ...parsed.data }).returning({ id: applicationSecretAttachments.id, environmentId: applicationSecretAttachments.environmentId, targetKey: applicationSecretAttachments.targetKey }); await recordAudit("application.secret_attached", application.id, scope.userId, c.req.raw, scope.project.id); return c.json(attachment, 201); }
  catch (error) { if ((error as { code?: string }).code === "23505") return c.json({ error: "A secret is already attached to this target key in the environment" }, 409); throw error; }
});

routes.delete("/:orgSlug/projects/:projectId/applications/:applicationId/secrets/:attachmentId", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("secrets.attach")) return c.json({ error: "Permission required: secrets.attach" }, 403);
  const application = await applicationInScope(scope, c.req.param("applicationId")); if (!application) return c.json({ error: "Application not found" }, 404);
  const [removed] = await db.delete(applicationSecretAttachments).where(and(eq(applicationSecretAttachments.id, c.req.param("attachmentId")), eq(applicationSecretAttachments.applicationId, application.id))).returning({ id: applicationSecretAttachments.id });
  if (!removed) return c.json({ error: "Secret attachment not found" }, 404); await recordAudit("application.secret_detached", application.id, scope.userId, c.req.raw, scope.project.id); return c.body(null, 204);
});

routes.put("/:orgSlug/projects/:projectId/applications/:applicationId/variables/:key", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("applications.update")) return c.json({ error: "Permission required: applications.update" }, 403);
  const application = await applicationInScope(scope, c.req.param("applicationId")); if (!application) return c.json({ error: "Application not found" }, 404);
  const parsed = applicationVariableInput.safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Invalid application variable", issues: parsed.error.flatten() }, 400);
  const key = c.req.param("key").trim(); if (!/^[A-Z_][A-Z0-9_]{0,127}$/.test(key)) return c.json({ error: "Invalid application variable key" }, 400);
  if (parsed.data.environmentId) { const environment = await db.query.projectEnvironments.findFirst({ where: and(eq(projectEnvironments.id, parsed.data.environmentId), eq(projectEnvironments.projectId, scope.project.id)) }); if (!environment) return c.json({ error: "Environment must belong to this project" }, 400); }
  const environmentCondition = parsed.data.environmentId ? eq(applicationEnvironmentVariables.environmentId, parsed.data.environmentId) : isNull(applicationEnvironmentVariables.environmentId);
  const existing = await db.query.applicationEnvironmentVariables.findFirst({ where: and(eq(applicationEnvironmentVariables.applicationId, application.id), eq(applicationEnvironmentVariables.key, key), environmentCondition) });
  const valueEncrypted = await encryptEnvironmentValue(parsed.data.value);
  if (existing) await db.update(applicationEnvironmentVariables).set({ valueEncrypted }).where(eq(applicationEnvironmentVariables.id, existing.id));
  else await db.insert(applicationEnvironmentVariables).values({ id: crypto.randomUUID(), applicationId: application.id, environmentId: parsed.data.environmentId ?? null, key, valueEncrypted });
  await recordAudit("application.variable_updated", application.id, scope.userId, c.req.raw, scope.project.id);
  return c.json({ environmentId: parsed.data.environmentId ?? null, key, value: parsed.data.value });
});

routes.delete("/:orgSlug/projects/:projectId/applications/:applicationId/variables/:key", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId")); if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("applications.update")) return c.json({ error: "Permission required: applications.update" }, 403);
  const application = await applicationInScope(scope, c.req.param("applicationId")); if (!application) return c.json({ error: "Application not found" }, 404);
  const environmentId = c.req.query("environmentId"); if (environmentId && !z.string().uuid().safeParse(environmentId).success) return c.json({ error: "Invalid environment ID" }, 400);
  const environmentCondition = environmentId ? eq(applicationEnvironmentVariables.environmentId, environmentId) : isNull(applicationEnvironmentVariables.environmentId);
  const [removed] = await db.delete(applicationEnvironmentVariables).where(and(eq(applicationEnvironmentVariables.applicationId, application.id), eq(applicationEnvironmentVariables.key, c.req.param("key")), environmentCondition)).returning({ id: applicationEnvironmentVariables.id });
  if (!removed) return c.json({ error: "Application variable not found" }, 404);
  await recordAudit("application.variable_deleted", application.id, scope.userId, c.req.raw, scope.project.id); return c.body(null, 204);
});

routes.get("/:orgSlug/projects/:projectId/applications/:applicationId/metrics", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("applications.read")) return c.json({ error: "Permission required: applications.read" }, 403);
  const application = await applicationInScope(scope, c.req.param("applicationId"));
  if (!application) return c.json({ error: "Application not found" }, 404);
  const range = z.enum(["15m", "1h", "6h", "24h", "7d"]).safeParse(c.req.query("range") ?? "1h");
  if (!range.success) return c.json({ error: "Invalid metrics range" }, 400);
  const requestedWorkload = c.req.query("workloadId");
  if (requestedWorkload && !z.string().uuid().safeParse(requestedWorkload).success) return c.json({ error: "Invalid workload ID" }, 400);
  const requestedDeployment = c.req.query("deploymentId");
  if (requestedDeployment && !z.string().uuid().safeParse(requestedDeployment).success) return c.json({ error: "Invalid deployment ID" }, 400);
  const deploymentItems = await db.select({ id: deployments.id }).from(deployments).where(and(eq(deployments.applicationId, application.id), ...(requestedDeployment ? [eq(deployments.id, requestedDeployment)] : [])));
  if (requestedDeployment && deploymentItems.length === 0) return c.json({ error: "Deployment not found" }, 404);
  const allWorkloads = deploymentItems.length ? await db.select({ id: workloads.id }).from(workloads).where(inArray(workloads.deploymentId, deploymentItems.map((deployment) => deployment.id))) : [];
  const workloadIds = requestedWorkload ? allWorkloads.filter((workload) => workload.id === requestedWorkload).map((workload) => workload.id) : allWorkloads.map((workload) => workload.id);
  if (requestedWorkload && workloadIds.length === 0) return c.json({ error: "Workload not found" }, 404);
  const durationMs = ({ "15m": 15 * 60_000, "1h": 60 * 60_000, "6h": 6 * 60 * 60_000, "24h": 24 * 60 * 60_000, "7d": 7 * 24 * 60 * 60_000 } as const)[range.data];
  const to = new Date(); const from = new Date(to.getTime() - durationMs);
  const bucketMs = metricBucketMs(range.data);
  const samples = await new PostgresWorkloadMetricsProvider().query(workloadIds, from, to, bucketMs);
  return c.json({ range: range.data, from: from.toISOString(), to: to.toISOString(), deploymentId: requestedDeployment ?? null, workloads: workloadIds, samples: aggregateWorkloadMetrics(samples, bucketMs) });
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
    : flatWorkloads.some((workload) => workload.healthStatus === "unhealthy")
      ? "degraded"
      : flatWorkloads.some((workload) => workload.healthStatus === "starting")
        ? "deploying"
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
  if (!scope.permissions.includes("applications.update")) return c.json({ error: "Permission required: applications.update" }, 403);
  if (!scope.permissions.includes("deployments.create")) return c.json({ error: "Permission required: deployments.create" }, 403);
  const application = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, c.req.param("applicationId")),
      eq(applications.projectId, scope.project.id),
    ),
  });
  if (!application) return c.json({ error: "Application not found" }, 404);
  if (application.lifecycleStatus === "archived") return c.json({ error: "Archived applications cannot be deployed" }, 409);
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
  const [runtimeDefaults, resourceDefaults, configuredPorts, configuredVolumes, applicationVariables] = await Promise.all([
    db.query.applicationRuntimeConfigurations.findFirst({ where: eq(applicationRuntimeConfigurations.applicationId, application.id) }),
    db.query.applicationResourceConfigurations.findFirst({ where: eq(applicationResourceConfigurations.applicationId, application.id) }),
    db.select().from(applicationPorts).where(eq(applicationPorts.applicationId, application.id)),
    db.select().from(applicationVolumeMounts).where(eq(applicationVolumeMounts.applicationId, application.id)),
    db.select().from(applicationEnvironmentVariables).where(eq(applicationEnvironmentVariables.applicationId, application.id)),
  ]);
  const environmentId = parsed.data.environmentId ?? application.defaultEnvironmentId;
  let environment: Record<string, string> = {};
  if (environmentId) {
    const selectedEnvironment = await db.query.projectEnvironments.findFirst({ where: and(eq(projectEnvironments.id, environmentId), eq(projectEnvironments.projectId, scope.project.id)) });
    if (!selectedEnvironment) return c.json({ error: "Environment not found in this project" }, 400);
    const values = await db.select().from(environmentVariables).where(and(eq(environmentVariables.environmentId, environmentId), eq(environmentVariables.isSecret, false)));
    environment = Object.fromEntries(await Promise.all(values.map(async (value) => [value.key, await decryptEnvironmentValue(value.valueEncrypted)] as const)));
  }
  const applicationDefaults = applicationVariables.filter((variable) => variable.environmentId === null);
  const applicationOverrides = environmentId ? applicationVariables.filter((variable) => variable.environmentId === environmentId) : [];
  for (const variable of [...applicationDefaults, ...applicationOverrides]) environment[variable.key] = await decryptEnvironmentValue(variable.valueEncrypted);
  const requirements = {
    cpuMilli: parsed.data.cpuMilli ?? resourceDefaults?.cpuMilli ?? 250,
    memoryMib: parsed.data.memoryMib ?? resourceDefaults?.memoryMib ?? 256,
    storageMib: parsed.data.storageMib ?? resourceDefaults?.storageMib ?? 0,
    runtime: "container" as const,
    ...(parsed.data.region ? { region: parsed.data.region } : {}),
    ...(parsed.data.requiredLabels ? { requiredLabels: parsed.data.requiredLabels } : {}),
  };
  if (configuredVolumes.some((volume) => !volume.readOnly) && (parsed.data.replicas ?? runtimeDefaults?.replicas ?? 1) > 1)
    return c.json({ error: "Writable local volumes require a single replica until shared storage is configured" }, 409);
  const ports = configuredPorts.length ? configuredPorts : [{ internalPort: application.internalPort, protocol: "tcp" as const, exposure: "private" as const, externalPort: null }];
  const runtimeConfig = {
    environment,
    ports: ports.map((port) => ({ containerPort: port.internalPort, protocol: port.protocol, exposure: port.exposure, ...(port.externalPort ? { externalPort: port.externalPort } : {}) })),
    volumes: configuredVolumes.map((volume) => ({ name: volume.volumeName, target: volume.mountPath, readOnly: volume.readOnly })),
    restartPolicy: runtimeDefaults?.restartPolicy ?? "unless-stopped",
    gracefulShutdownSeconds: runtimeDefaults?.gracefulShutdownSeconds ?? 15,
    ...(application.registryCredentialReference ? { registryCredentialReference: application.registryCredentialReference } : {}),
    ...(runtimeDefaults?.command ? { command: runtimeDefaults.command } : {}),
    ...(runtimeDefaults?.workingDirectory ? { workingDirectory: runtimeDefaults.workingDirectory } : {}),
    ...(runtimeDefaults?.healthcheckCommand ? { healthCheck: { command: runtimeDefaults.healthcheckCommand, intervalSeconds: runtimeDefaults.healthcheckIntervalSeconds, timeoutSeconds: runtimeDefaults.healthcheckTimeoutSeconds, retries: runtimeDefaults.healthcheckRetries, startPeriodSeconds: runtimeDefaults.healthcheckStartPeriodSeconds } } : {}),
  };
  const secretReferences = environmentId ? await db.select({ id: applicationSecretAttachments.id, targetKey: applicationSecretAttachments.targetKey, secretEnvironmentVariableId: applicationSecretAttachments.secretEnvironmentVariableId }).from(applicationSecretAttachments).where(and(eq(applicationSecretAttachments.applicationId, application.id), eq(applicationSecretAttachments.environmentId, environmentId))) : [];
  const configurationSnapshot = { source: { type: application.sourceType === "docker" ? "image" : "git", image: application.imageName }, environmentId: environmentId ?? null, runtime: runtimeDefaults ?? { runtime: "container", replicas: 1, restartPolicy: "unless-stopped", gracefulShutdownSeconds: 15 }, resources: requirements, ports, volumes: configuredVolumes, environmentKeys: Object.keys(environment), applicationVariableKeys: applicationVariables.map((variable) => ({ key: variable.key, environmentId: variable.environmentId })), secretReferences, registryCredentialReference: application.registryCredentialReference };
  const deployment = await createDeployment({
    applicationId: application.id,
    environmentId,
    image: application.imageName,
    replicas: parsed.data.replicas ?? runtimeDefaults?.replicas ?? 1,
    desiredState: "running",
    runtime: "container",
    requirements,
    runtimeConfig,
    configurationSnapshot,
    createdBy: scope.userId,
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
    message: `Deployment ${deployment.id} queued for agent reconciliation`,
  });
  await supersedePreviousDeployments(application.id, deployment.id);
  await reconcileDeployment(deployment.id);
  await recordAudit("application.deployed", application.id, scope.userId, c.req.raw, scope.project.id);
  return c.json({ deploymentId: deployment.id, revision: deployment.version, status: "deploying", internalPort: application.internalPort }, 202);
});

routes.post("/:orgSlug/projects/:projectId/applications/:applicationId/stop", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  if (!scope.permissions.includes("applications.update")) return c.json({ error: "Permission required: applications.update" }, 403);
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
  await recordAudit("application.stopped", application.id, scope.userId, c.req.raw, scope.project.id);
  return c.json({ status: "stopping" }, 202);
});

const applicationLogsQuery = z.object({ tail: z.coerce.number().int().min(1).max(2_000).default(500) });
routes.get("/:orgSlug/projects/:projectId/applications/:applicationId/logs", async (c) => {
  const scope = await getProjectScope(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!scope) return c.json({ error: "Project not found or access denied" }, 404);
  const application = await applicationInScope(scope, c.req.param("applicationId"));
  if (!application) return c.json({ error: "Application not found" }, 404);
  const query = applicationLogsQuery.safeParse(c.req.query());
  if (!query.success) return c.json({ error: "Invalid log request" }, 400);
  const active = await db.select({ id: workloads.id, nodeId: workloads.nodeId, actualState: workloads.actualState }).from(workloads).innerJoin(deployments, eq(workloads.deploymentId, deployments.id)).where(and(eq(deployments.applicationId, application.id), eq(workloads.desiredState, "running"))).limit(100);
  const entries = await Promise.all(active.map(async (workload) => {
    const [latest, pending] = await Promise.all([
      db.select({ result: agentCommands.result, completedAt: agentCommands.completedAt }).from(agentCommands).where(and(eq(agentCommands.resourceId, workload.id), eq(agentCommands.type, "workload.logs"), eq(agentCommands.status, "succeeded"))).orderBy(desc(agentCommands.completedAt)).limit(1),
      db.query.agentCommands.findFirst({ where: and(eq(agentCommands.resourceId, workload.id), eq(agentCommands.type, "workload.logs"), or(eq(agentCommands.status, "pending"), eq(agentCommands.status, "delivered"))) }),
    ]);
    if (workload.nodeId && workload.actualState === "running" && !pending) await db.insert(agentCommands).values({ id: crypto.randomUUID(), nodeId: workload.nodeId, type: "workload.logs", resourceId: workload.id, payload: { tail: query.data.tail } });
    const result = latest[0]?.result as { data?: { logs?: unknown } } | null;
    return { workloadId: workload.id, status: workload.actualState, logs: typeof result?.data?.logs === "string" ? result.data.logs : "", updatedAt: latest[0]?.completedAt?.toISOString() ?? null };
  }));
  return c.json({ workloads: entries });
});

export { routes as applicationRoutes };
