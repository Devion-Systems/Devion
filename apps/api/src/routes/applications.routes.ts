import {
  applicationDeployments,
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
  deployments,
  environmentVariables,
  projectEnvironments,
  projects,
  workloads,
} from "@repo/db";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import {
  reconcileDeployment,
  stopApplicationWorkloads,
} from "../modules/deployments/controller.js";
import type { AppEnv } from "../types/env.js";
import { listAccessibleProjects, resolveProjectAccess } from "../features/projects/access.js";
import { decryptEnvironmentValue, encryptEnvironmentValue } from "../features/environments/crypto.js";

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
const buildConfigurationInput = z.object({
  buildMode: z.literal("dockerfile").default("dockerfile"), runtime: z.string().trim().min(1).max(64).default("container"), runtimeVersion: z.string().trim().max(64).nullable().optional(), rootDirectory: z.string().trim().min(1).max(512).refine((value) => !value.startsWith("/") && !value.split(/[\\/]+/).includes("..")), installCommand: z.string().max(2_000).nullable().optional(), buildCommand: z.string().max(2_000).nullable().optional(), startCommand: z.string().max(2_000).nullable().optional(), dockerfilePath: z.string().trim().max(512).nullable().optional(), buildContext: z.string().trim().max(512).nullable().optional(),
});
const runtimeConfigurationInput = z.object({ runtime: z.literal("container").default("container"), command: z.string().trim().min(1).max(2_000).nullable().optional(), workingDirectory: z.string().trim().min(1).max(512).refine((value) => value.startsWith("/")).nullable().optional(), restartPolicy: z.enum(["no", "on-failure", "always", "unless-stopped"]).default("unless-stopped"), gracefulShutdownSeconds: z.number().int().min(1).max(600).default(15), healthcheckCommand: z.string().trim().min(1).max(2_000).nullable().optional(), healthcheckIntervalSeconds: z.number().int().min(1).max(3_600).default(30), healthcheckTimeoutSeconds: z.number().int().min(1).max(600).default(5), healthcheckRetries: z.number().int().min(1).max(20).default(3), healthcheckStartPeriodSeconds: z.number().int().min(0).max(3_600).default(0), replicas: z.number().int().min(1).max(100).default(1) });
const resourceConfigurationInput = z.object({ cpuMilli: z.number().int().min(1).max(256_000).default(250), memoryMib: z.number().int().min(16).max(1_048_576).default(256), storageMib: z.number().int().min(0).max(1_048_576).default(0) });
const portsInput = z.array(z.object({ name: z.string().trim().min(1).max(64).nullable().optional(), internalPort: z.number().int().min(1).max(65_535), protocol: z.enum(["tcp", "udp"]).default("tcp"), exposure: z.enum(["private", "public"]).default("private"), externalPort: z.number().int().min(1).max(65_535).nullable().optional(), description: z.string().trim().max(500).nullable().optional() })).max(32).superRefine((ports, ctx) => { const seen = new Set<string>(); ports.forEach((port, index) => { const key = `${port.internalPort}/${port.protocol}`; if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "internalPort"], message: "Duplicate internal port and protocol" }); seen.add(key); }); });
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
  if (!projectIds.length) return c.json([]);
  const query = c.req.query();
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
    .where(and(eq(applications.organizationId, scope.organization.id), inArray(applications.projectId, projectIds)))
    .orderBy(asc(projects.name), asc(applications.name));
  const search = query.search?.trim().toLowerCase();
  const sourceType = query.sourceType === "git" || query.sourceType === "docker" ? query.sourceType : undefined;
  const lifecycleStatus = query.status === "active" || query.status === "archived" ? query.status : undefined;
  const applicationType = ["web", "api", "worker", "game_server", "custom"].includes(query.type ?? "") ? query.type : undefined;
  const filtered = items
    .filter((item) => !query.projectId || item.projectId === query.projectId)
    .filter((item) => !sourceType || item.sourceType === sourceType)
    .filter((item) => !lifecycleStatus || item.lifecycleStatus === lifecycleStatus)
    .filter((item) => !applicationType || item.applicationType === applicationType)
    .filter((item) => !search || [item.name, item.slug, item.description ?? "", item.gitUrl ?? ""].some((value) => value.toLowerCase().includes(search)))
    .sort((a, b) => query.sort === "name" ? a.name.localeCompare(b.name) : query.sort === "created" ? b.createdAt.getTime() - a.createdAt.getTime() : b.updatedAt.getTime() - a.updatedAt.getTime());
  return c.json(filtered);
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
  const ports = configuredPorts.length ? configuredPorts : [{ internalPort: application.internalPort, protocol: "tcp" as const, exposure: "private" as const }];
  const runtimeConfig = {
    environment,
    ports: ports.map((port) => ({ containerPort: port.internalPort, protocol: port.protocol, exposure: port.exposure })),
    volumes: configuredVolumes.map((volume) => ({ name: volume.volumeName, target: volume.mountPath, readOnly: volume.readOnly })),
    restartPolicy: runtimeDefaults?.restartPolicy ?? "unless-stopped",
    gracefulShutdownSeconds: runtimeDefaults?.gracefulShutdownSeconds ?? 15,
    ...(runtimeDefaults?.command ? { command: runtimeDefaults.command } : {}),
    ...(runtimeDefaults?.workingDirectory ? { workingDirectory: runtimeDefaults.workingDirectory } : {}),
    ...(runtimeDefaults?.healthcheckCommand ? { healthCheck: { command: runtimeDefaults.healthcheckCommand, intervalSeconds: runtimeDefaults.healthcheckIntervalSeconds, timeoutSeconds: runtimeDefaults.healthcheckTimeoutSeconds, retries: runtimeDefaults.healthcheckRetries, startPeriodSeconds: runtimeDefaults.healthcheckStartPeriodSeconds } } : {}),
  };
  const secretReferences = environmentId ? await db.select({ id: applicationSecretAttachments.id, targetKey: applicationSecretAttachments.targetKey, secretEnvironmentVariableId: applicationSecretAttachments.secretEnvironmentVariableId }).from(applicationSecretAttachments).where(and(eq(applicationSecretAttachments.applicationId, application.id), eq(applicationSecretAttachments.environmentId, environmentId))) : [];
  const configurationSnapshot = { source: { type: application.sourceType === "docker" ? "image" : "git", image: application.imageName }, environmentId: environmentId ?? null, runtime: runtimeDefaults ?? { runtime: "container", replicas: 1, restartPolicy: "unless-stopped", gracefulShutdownSeconds: 15 }, resources: requirements, ports, volumes: configuredVolumes, environmentKeys: Object.keys(environment), applicationVariableKeys: applicationVariables.map((variable) => ({ key: variable.key, environmentId: variable.environmentId })), secretReferences };
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
    replicas: parsed.data.replicas ?? runtimeDefaults?.replicas ?? 1,
    desiredState: "running",
    runtime: "container",
    requirements,
    runtimeConfig,
    configurationSnapshot,
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
  await recordAudit("application.deployed", application.id, scope.userId, c.req.raw, scope.project.id);
  return c.json({ deploymentId, status: "deploying", internalPort: application.internalPort }, 202);
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

export { routes as applicationRoutes };
