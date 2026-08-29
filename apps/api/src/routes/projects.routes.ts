import { applicationDeployments, applicationPorts, applications, auditLogs, builds, db, deployments, managedDatabases, member, organization, projectDomains, projectEnvironments, projectTeams, projects, team, user } from "@repo/db";
import { and, asc, count, desc, eq, inArray, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { resolveRolePermissions } from "../features/organizations/permissions.js";
import { DnsManager } from "../lib/network/dns.js";
import { type TraefikDomain, TraefikManager } from "../lib/network/traefik.js";
import { resolveWorkloadUpstreams } from "../features/routing/workload-upstreams.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import { listAccessibleProjects, resolveProjectAccess } from "../features/projects/access.js";
import type { AppEnv } from "../types/env.js";

const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(64),
  description: z.string().trim().max(500).optional(),
  type: z.enum(["git", "docker", "blank"]),
  // Forms commonly submit an empty string for an unselected Git source.
  // Normalize it before URL validation so blank and Docker projects work.
  gitUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().max(2_000).optional(),
  ),
  branch: z.string().trim().min(1).max(255).optional(),
  teamId: z.string().min(1).optional(),
  accessMode: z.enum(["organization", "team"]).default("organization"),
  teamIds: z.array(z.string().min(1)).max(50).default([]),
});

const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64).optional(),
  description: z.string().trim().max(500).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0);

const accessSchema = z.object({
  accessMode: z.enum(["organization", "team"]),
  teamIds: z.array(z.string().min(1)).max(50),
}).refine((value) => value.accessMode !== "team" || value.teamIds.length > 0, {
  message: "Team-scoped projects require at least one team",
});
const defaultEnvironmentSchema = z.object({ environmentId: z.string().uuid() });

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/);

const domainInputSchema = z.object({
  hostname: hostnameSchema,
  environment: z.string().trim().min(1).max(32).default("production"),
  applicationId: z.string().uuid(),
  deploymentId: z.string().uuid().optional().nullable(),
  targetPort: z.number().int().min(1).max(65_535),
  upstreamProtocol: z.enum(["http", "https"]).default("http"),
});

const TRAEFIK_ENABLED = process.env.TRAEFIK_ENABLED === "true";
const traefik = TRAEFIK_ENABLED ? new TraefikManager() : null;
const dnsManager = new DnsManager(process.env.TRAEFIK_PUBLIC_IP, process.env.TRAEFIK_CNAME_TARGET);

async function setDomainRouteStatus(domain: typeof projectDomains.$inferSelect, status: "active" | "failed"): Promise<void> {
  if (domain.status === status) return;
  await db.transaction(async (tx) => {
    await tx.update(projectDomains).set({ status }).where(eq(projectDomains.id, domain.id));
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorId: null,
      action: status === "active" ? "domain.route_available" : "domain.route_unavailable",
      targetType: "domain",
      targetId: domain.id,
      metadata: JSON.stringify({ projectId: domain.projectId, hostname: domain.hostname }),
    });
  });
}

async function syncTraefikRoutes(projectId: string): Promise<boolean> {
  if (!traefik) throw new Error("Traefik domain routing is disabled");
  const domains = await db.select().from(projectDomains).where(eq(projectDomains.projectId, projectId));
  // Do not rewrite a project's shared file while it still contains an active
  // legacy domain. That preserves an existing production route until each
  // hostname has been explicitly migrated to an Application/Port target.
  if (domains.some((domain) => domain.routingMigrationState === "legacy" && domain.status === "active")) return false;
  const routes: TraefikDomain[] = [];
  for (const domain of domains) {
    if (domain.status === "pending") continue;
    if (!domain.applicationId || !domain.targetPort || !domain.upstreamProtocol) {
      await setDomainRouteStatus(domain, "failed");
      continue;
    }
    try {
      const upstreams = await resolveWorkloadUpstreams({
        applicationId: domain.applicationId,
        deploymentId: domain.deploymentId,
        targetPort: domain.targetPort,
        upstreamProtocol: domain.upstreamProtocol,
        organizationId: domain.organizationId,
      });
      if (upstreams.length === 0) {
        await setDomainRouteStatus(domain, "failed");
        continue;
      }
      await setDomainRouteStatus(domain, "active");
      routes.push({ id: domain.id, hostname: domain.hostname, upstreams });
    } catch {
      await setDomainRouteStatus(domain, "failed");
    }
  }
  await traefik.syncProjectRoutes({ projectId }, routes);
  return true;
}

/** Periodic reconciliation also withdraws unhealthy/offline workload backends. */
export async function reconcileProjectDomainRoutes(projectId: string): Promise<void> {
  await syncTraefikRoutes(projectId);
}

async function validateDomainTarget(projectId: string, value: { applicationId?: string; deploymentId?: string | null; targetPort?: number }) {
  if (!value.applicationId) return;
  const application = await db.query.applications.findFirst({
    where: and(eq(applications.id, value.applicationId), eq(applications.projectId, projectId)),
  });
  if (!application) throw new Error("Application target does not belong to this project");
  if (!value.targetPort) throw new Error("Domain target requires a port");
  const port = await db.query.applicationPorts.findFirst({ where: and(eq(applicationPorts.applicationId, application.id), eq(applicationPorts.internalPort, value.targetPort), eq(applicationPorts.protocol, "tcp"), eq(applicationPorts.exposure, "public")) });
  if (!port) throw new Error("Domain target port must be a public TCP application port");
  if (!value.deploymentId) return;
  const deployment = await db.query.deployments.findFirst({
    where: and(eq(deployments.id, value.deploymentId), eq(deployments.applicationId, application.id)),
  });
  if (!deployment) throw new Error("Deployment target does not belong to this application");
}

const projectRoutes = new Hono<AppEnv>();
projectRoutes.use("/*", requireAuthenticatedUser);

async function getAuthorizedOrganization(request: Request, slug: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;

  const organizationRecord = await db.query.organization.findFirst({
    where: eq(organization.slug, slug),
  });
  if (!organizationRecord) return null;

  const membership = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, organizationRecord.id),
      eq(member.userId, session.user.id),
    ),
  });
  if (!membership) return null;

  return { organization: organizationRecord, membership, permissions: await resolveRolePermissions(membership.role, organizationRecord.id), userId: session.user.id };
}


/** Returns the organisation and the caller's membership for the dashboard shell. */
projectRoutes.get("/:orgSlug", async (c) => {
  const access = await getAuthorizedOrganization(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);

  return c.json({ org: access.organization, membership: access.membership, permissions: access.permissions });
});

projectRoutes.get("/:orgSlug/projects", async (c) => {
  const access = await listAccessibleProjects(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);
  const query = c.req.query();
  const status = query.status === "active" || query.status === "archived" ? query.status : undefined;
  const search = query.search?.trim().toLowerCase();
  const teamId = query.teamId;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit ?? "25", 10) || 25));
  const projectIds = access.projects.map((project) => project.id);
  const assignments = projectIds.length
    ? await db.select().from(projectTeams).where(inArray(projectTeams.projectId, projectIds))
    : [];
  const filtered = access.projects
    .filter((project) => !status || project.status === status)
    .filter((project) => !search || [project.name, project.slug, project.description ?? ""].some((value) => value.toLowerCase().includes(search)))
    .filter((project) => !teamId || assignments.some((assignment) => assignment.projectId === project.id && assignment.teamId === teamId))
    .sort((a, b) => query.sort === "name" ? a.name.localeCompare(b.name) : query.sort === "created" ? b.createdAt.getTime() - a.createdAt.getTime() : b.updatedAt.getTime() - a.updatedAt.getTime());
  const pageProjects = filtered.slice((page - 1) * limit, page * limit);
  const pageProjectIds = pageProjects.map((project) => project.id);
  const [applicationCounts, environmentCounts, domainCounts] = pageProjectIds.length ? await Promise.all([
    db.select({ projectId: applications.projectId, total: count() }).from(applications).where(inArray(applications.projectId, pageProjectIds)).groupBy(applications.projectId),
    db.select({ projectId: projectEnvironments.projectId, total: count() }).from(projectEnvironments).where(inArray(projectEnvironments.projectId, pageProjectIds)).groupBy(projectEnvironments.projectId),
    db.select({ projectId: projectDomains.projectId, total: count() }).from(projectDomains).where(inArray(projectDomains.projectId, pageProjectIds)).groupBy(projectDomains.projectId),
  ]) : [[], [], []];
  const items = pageProjects.map((project) => ({
    id: project.id, name: project.name, slug: project.slug, description: project.description,
    status: project.status, sourceType: project.sourceType, branch: project.branch,
    accessMode: project.accessMode, teamIds: assignments.filter((item) => item.projectId === project.id).map((item) => item.teamId),
    applicationCount: applicationCounts.find((item) => item.projectId === project.id)?.total ?? 0,
    environmentCount: environmentCounts.find((item) => item.projectId === project.id)?.total ?? 0,
    domainCount: domainCounts.find((item) => item.projectId === project.id)?.total ?? 0,
    createdAt: project.createdAt, updatedAt: project.updatedAt,
  }));
  return c.json({ items, page, limit, total: filtered.length });
});

/** Actual organization overview data. Deployment history is intentionally not inferred until a deployment runtime records it. */
projectRoutes.get("/:orgSlug/dashboard", async (c) => {
  const access = await listAccessibleProjects(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);
  const organizationId = access.organization.id;
  const projectIds = access.projects.map((project) => project.id);
  const [databases, domains] = await Promise.all([
    db
      .select({ status: managedDatabases.status, cpuMillicores: managedDatabases.cpuMillicores, memoryMib: managedDatabases.memoryMib, storageGib: managedDatabases.storageGib })
      .from(managedDatabases)
      .where(eq(managedDatabases.organizationId, organizationId)),
    projectIds.length ? db.select({ id: projectDomains.id }).from(projectDomains).where(inArray(projectDomains.projectId, projectIds)) : Promise.resolve([]),
  ]);
  const allocated = databases.reduce(
    (total, database) => ({
      cpuMillicores: total.cpuMillicores + database.cpuMillicores,
      memoryMib: total.memoryMib + database.memoryMib,
      storageGib: total.storageGib + database.storageGib,
    }),
    { cpuMillicores: 0, memoryMib: 0, storageGib: 0 },
  );
  return c.json({
    projects: { total: access.projects.length, healthy: access.projects.filter((project) => project.status === "active").length },
    databases: { total: databases.length, ready: databases.filter((database) => database.status === "ready").length, failed: databases.filter((database) => database.status === "failed").length },
    domains: domains.length,
    allocated,
    recentProjects: access.projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5).map(({ id, name, slug, status, branch, updatedAt }) => ({ id, name, slug, status, branch, updatedAt })),
  });
});

projectRoutes.post("/:orgSlug/projects", async (c) => {
  const access = await getAuthorizedOrganization(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);
  if (!access.permissions.includes("projects.create")) return c.json({ error: "Permission required: projects.create" }, 403);

  const payload = projectInputSchema.safeParse(await c.req.json());
  if (!payload.success)
    return c.json({ error: "Invalid project data", issues: payload.error.flatten() }, 400);

  if (payload.data.type === "git" && !payload.data.gitUrl) {
    return c.json({ error: "A Git repository URL is required for Git projects" }, 400);
  }

  const teamIds = [...new Set([...payload.data.teamIds, ...(payload.data.teamId ? [payload.data.teamId] : [])])];
  if (payload.data.accessMode === "team" && teamIds.length === 0) return c.json({ error: "Team-scoped projects require at least one team" }, 400);
  if (teamIds.length) {
    const assignedTeams = await db.select({ id: team.id }).from(team).where(eq(team.organizationId, access.organization.id));
    if (teamIds.some((teamId) => !assignedTeams.some((assignedTeam) => assignedTeam.id === teamId))) return c.json({ error: "Team not found in this organization" }, 400);
  }

  const id = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      const environmentId = crypto.randomUUID();
      await tx.insert(projects).values({
        id, organizationId: access.organization.id, createdByUserId: access.userId,
        name: payload.data.name, slug: payload.data.slug, description: payload.data.description || null,
        sourceType: payload.data.type, gitUrl: payload.data.gitUrl || null, branch: payload.data.branch || "main",
        teamId: teamIds[0] ?? null, accessMode: payload.data.accessMode,
      });
      await tx.insert(projectEnvironments).values({ id: environmentId, organizationId: access.organization.id, projectId: id, name: "production", slug: "production", displayName: "Production", protected: true });
      await tx.update(projects).set({ defaultEnvironmentId: environmentId }).where(eq(projects.id, id));
      if (teamIds.length) await tx.insert(projectTeams).values(teamIds.map((teamId) => ({ projectId: id, teamId, assignedByUserId: access.userId })));
      await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "project.created", targetType: "project", targetId: id, metadata: JSON.stringify({ organizationId: access.organization.id, slug: payload.data.slug }) });
      await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "environment.created", targetType: "environment", targetId: environmentId, metadata: JSON.stringify({ organizationId: access.organization.id, projectId: id, slug: "production" }) });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return c.json({ error: "A project with this address already exists" }, 409);
    }
    throw error;
  }

  c.get("logger").info(
    { projectId: id, organizationId: access.organization.id },
    "Project created",
  );
  return c.json({ id, slug: payload.data.slug }, 201);
});

async function getAuthorizedProject(request: Request, orgSlug: string, projectId: string) {
  return resolveProjectAccess(request, orgSlug, projectId);
}

/** Project metadata is available before a deployment runtime is connected. */
projectRoutes.get("/:orgSlug/projects/:projectId", async (c) => {
  const access = await getAuthorizedProject(
    c.req.raw,
    c.req.param("orgSlug"),
    c.req.param("projectId"),
  );
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);

  return c.json({
    id: access.project.id,
    name: access.project.name,
    slug: access.project.slug,
    description: access.project.description,
    sourceType: access.project.sourceType,
    gitUrl: access.project.gitUrl,
    branch: access.project.branch,
    status: access.project.status,
    accessMode: access.project.accessMode,
    defaultEnvironmentId: access.project.defaultEnvironmentId,
    archivedAt: access.project.archivedAt,
    permissions: access.permissions,
    routingTargetUrl: access.project.routingTargetUrl,
    createdAt: access.project.createdAt,
    updatedAt: access.project.updatedAt,
  });
});

projectRoutes.get("/:orgSlug/projects/:projectId/summary", async (c) => {
  const access = await getAuthorizedProject(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const applicationItems = await db.select({ id: applications.id }).from(applications).where(eq(applications.projectId, access.project.id));
  const applicationIds = applicationItems.map((item) => item.id);
  const [domainTotal, environmentTotal, deploymentTotal, failedDeploymentTotal] = await Promise.all([
    db.select({ total: count() }).from(projectDomains).where(eq(projectDomains.projectId, access.project.id)),
    db.select({ total: count() }).from(projectEnvironments).where(eq(projectEnvironments.projectId, access.project.id)),
    applicationIds.length ? db.select({ total: count() }).from(applicationDeployments).where(inArray(applicationDeployments.applicationId, applicationIds)) : Promise.resolve([{ total: 0 }]),
    applicationIds.length ? db.select({ total: count() }).from(applicationDeployments).where(and(inArray(applicationDeployments.applicationId, applicationIds), eq(applicationDeployments.status, "failed"))) : Promise.resolve([{ total: 0 }]),
  ]);
  return c.json({ applications: applicationIds.length, domains: domainTotal[0]?.total ?? 0, environments: environmentTotal[0]?.total ?? 0, deployments: deploymentTotal[0]?.total ?? 0, failedDeployments: failedDeploymentTotal[0]?.total ?? 0 });
});

projectRoutes.get("/:orgSlug/projects/:projectId/activity", async (c) => {
  const access = await getAuthorizedProject(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const items = await db.select({ id: auditLogs.id, action: auditLogs.action, targetType: auditLogs.targetType, targetId: auditLogs.targetId, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt, actorName: user.name, actorEmail: user.email }).from(auditLogs).leftJoin(user, eq(auditLogs.actorId, user.id)).where(or(eq(auditLogs.targetId, access.project.id), like(auditLogs.metadata, `%\"projectId\":\"${access.project.id}\"%`))).orderBy(desc(auditLogs.createdAt)).limit(50);
  return c.json(items);
});

projectRoutes.get("/:orgSlug/projects/:projectId/teams", async (c) => {
  const access = await getAuthorizedProject(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"));
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const items = await db.select({ id: team.id, name: team.name }).from(projectTeams).innerJoin(team, eq(projectTeams.teamId, team.id)).where(eq(projectTeams.projectId, access.project.id));
  return c.json({ accessMode: access.project.accessMode, teams: items });
});

projectRoutes.patch("/:orgSlug/projects/:projectId", async (c) => {
  const access = await resolveProjectAccess(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"), "projects.update");
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const payload = projectUpdateSchema.safeParse(await c.req.json());
  if (!payload.success) return c.json({ error: "Invalid project data", issues: payload.error.flatten() }, 400);
  try {
    const [updated] = await db.update(projects).set(payload.data).where(eq(projects.id, access.project.id)).returning();
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "project.updated", targetType: "project", targetId: updated.id, metadata: JSON.stringify({ fields: Object.keys(payload.data) }) });
    return c.json(updated);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return c.json({ error: "A project with this address already exists" }, 409);
    throw error;
  }
});

projectRoutes.put("/:orgSlug/projects/:projectId/access", async (c) => {
  const access = await resolveProjectAccess(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"), "projects.manage_access");
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const payload = accessSchema.safeParse(await c.req.json());
  if (!payload.success) return c.json({ error: "Invalid project access", issues: payload.error.flatten() }, 400);
  const teamIds = [...new Set(payload.data.teamIds)];
  const allowedTeams = await db.select({ id: team.id }).from(team).where(eq(team.organizationId, access.organization.id));
  if (teamIds.some((id) => !allowedTeams.some((item) => item.id === id))) return c.json({ error: "Team not found in this organization" }, 400);
  await db.transaction(async (tx) => {
    await tx.update(projects).set({ accessMode: payload.data.accessMode, teamId: teamIds[0] ?? null }).where(eq(projects.id, access.project.id));
    await tx.delete(projectTeams).where(eq(projectTeams.projectId, access.project.id));
    if (teamIds.length) await tx.insert(projectTeams).values(teamIds.map((teamId) => ({ projectId: access.project.id, teamId, assignedByUserId: access.userId })));
    await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "project.access_changed", targetType: "project", targetId: access.project.id, metadata: JSON.stringify({ accessMode: payload.data.accessMode, teamIds }) });
  });
  return c.json({ accessMode: payload.data.accessMode, teamIds });
});

projectRoutes.put("/:orgSlug/projects/:projectId/default-environment", async (c) => {
  const access = await resolveProjectAccess(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"), "projects.manage_environments");
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const payload = defaultEnvironmentSchema.safeParse(await c.req.json());
  if (!payload.success) return c.json({ error: "Invalid default environment" }, 400);
  const environment = await db.query.projectEnvironments.findFirst({ where: and(eq(projectEnvironments.id, payload.data.environmentId), eq(projectEnvironments.projectId, access.project.id)) });
  if (!environment) return c.json({ error: "Environment not found in this project" }, 404);
  const [project] = await db.update(projects).set({ defaultEnvironmentId: environment.id }).where(eq(projects.id, access.project.id)).returning();
  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "project.default_environment_changed", targetType: "project", targetId: project.id, metadata: JSON.stringify({ environmentId: environment.id, projectId: project.id }) });
  return c.json({ defaultEnvironmentId: environment.id });
});

projectRoutes.post("/:orgSlug/projects/:projectId/archive", async (c) => {
  const access = await resolveProjectAccess(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"), "projects.archive");
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  if (access.project.status === "archived") return c.json(access.project);
  const [project] = await db.update(projects).set({ status: "archived", archivedAt: new Date() }).where(eq(projects.id, access.project.id)).returning();
  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "project.archived", targetType: "project", targetId: project.id });
  return c.json(project);
});

projectRoutes.post("/:orgSlug/projects/:projectId/restore", async (c) => {
  const access = await resolveProjectAccess(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"), "projects.archive");
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const [project] = await db.update(projects).set({ status: "active", archivedAt: null }).where(eq(projects.id, access.project.id)).returning();
  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "project.restored", targetType: "project", targetId: project.id });
  return c.json(project);
});

projectRoutes.delete("/:orgSlug/projects/:projectId", async (c) => {
  const access = await resolveProjectAccess(c.req.raw, c.req.param("orgSlug"), c.req.param("projectId"), "projects.delete");
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const applicationItems = await db.select({ id: applications.id }).from(applications).where(eq(applications.projectId, access.project.id));
  const applicationIds = applicationItems.map((item) => item.id);
  const [domainTotal, environmentTotal, buildTotal, deploymentTotal] = await Promise.all([
    db.select({ total: count() }).from(projectDomains).where(eq(projectDomains.projectId, access.project.id)),
    db.select({ total: count() }).from(projectEnvironments).where(eq(projectEnvironments.projectId, access.project.id)),
    db.select({ total: count() }).from(builds).where(eq(builds.projectId, access.project.id)),
    applicationIds.length ? db.select({ total: count() }).from(deployments).where(inArray(deployments.applicationId, applicationIds)) : Promise.resolve([{ total: 0 }]),
  ]);
  const dependencies = { applications: applicationIds.length, deployments: deploymentTotal[0]?.total ?? 0, builds: buildTotal[0]?.total ?? 0, domains: domainTotal[0]?.total ?? 0, environments: environmentTotal[0]?.total ?? 0 };
  if (dependencies.applications || dependencies.deployments || dependencies.builds || dependencies.domains) return c.json({ error: "Project has dependent resources", dependencies }, 409);
  await db.transaction(async (tx) => {
    await tx.delete(projects).where(eq(projects.id, access.project.id));
    await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "project.deleted", targetType: "project", targetId: access.project.id, metadata: JSON.stringify({ dependencies }) });
  });
  return c.body(null, 204);
});

projectRoutes.get("/:orgSlug/projects/:projectId/domains", async (c) => {
  const access = await getAuthorizedProject(
    c.req.raw,
    c.req.param("orgSlug"),
    c.req.param("projectId"),
  );
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);

  return c.json(
    await db
      .select()
      .from(projectDomains)
      .where(eq(projectDomains.projectId, access.project.id))
      .orderBy(asc(projectDomains.hostname)),
  );
});

projectRoutes.post("/:orgSlug/projects/:projectId/domains", async (c) => {
  const access = await getAuthorizedProject(
    c.req.raw,
    c.req.param("orgSlug"),
    c.req.param("projectId"),
  );
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  if (!access.permissions.includes("projects.update")) return c.json({ error: "Permission required: projects.update" }, 403);
  if (access.project.status === "archived") return c.json({ error: "Archived projects cannot receive new domains" }, 409);
  const payload = domainInputSchema.safeParse(await c.req.json());
  if (!payload.success) return c.json({ error: "Invalid hostname" }, 400);
  try {
    await validateDomainTarget(access.project.id, payload.data);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid domain target" }, 400);
  }

  const id = crypto.randomUUID();
  const existingDomains = await db
    .select({ id: projectDomains.id, hostname: projectDomains.hostname })
    .from(projectDomains)
    .where(eq(projectDomains.projectId, access.project.id));
  if (existingDomains.some((domain) => domain.hostname === payload.data.hostname)) {
    return c.json({ error: "Hostname is already assigned to this project" }, 409);
  }

  try {
    await db.insert(projectDomains).values({
      id,
      organizationId: access.organization.id,
      projectId: access.project.id,
      ...payload.data,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      return c.json({ error: "Hostname is already assigned to this project" }, 409);
    throw error;
  }

  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "domain.created", targetType: "domain", targetId: id, metadata: JSON.stringify({ projectId: access.project.id, hostname: payload.data.hostname }) });

  // Attempt verification immediately. If DNS has not propagated yet, the
  // domain remains pending and the existing verify action can be retried.
  if (process.env.TRAEFIK_PUBLIC_IP || process.env.TRAEFIK_CNAME_TARGET) {
    const verified = await dnsManager.verifyDomain(payload.data.hostname);
    if (verified) {
      try {
        await db.update(projectDomains).set({ status: "active" }).where(eq(projectDomains.id, id));
        const published = await syncTraefikRoutes(access.project.id);
        if (!published) await db.update(projectDomains).set({ status: "pending" }).where(eq(projectDomains.id, id));
        const current = await db.query.projectDomains.findFirst({ where: eq(projectDomains.id, id) });
        return c.json({ id, ...payload.data, status: current?.status ?? "failed" }, 201);
      } catch (error) {
        c.get("logger").error(
          { error, projectId: access.project.id, hostname: payload.data.hostname },
          "Unable to publish automatically verified Traefik domain route",
        );
      }
    }
  }

  // Do not request a certificate until DNS ownership has been verified.
  return c.json({ id, ...payload.data, status: "pending" }, 201);
});

projectRoutes.patch("/:orgSlug/projects/:projectId/domains/:domainId", async (c) => {
  const access = await getAuthorizedProject(
    c.req.raw,
    c.req.param("orgSlug"),
    c.req.param("projectId"),
  );
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  if (!access.permissions.includes("projects.update")) return c.json({ error: "Permission required: projects.update" }, 403);
  const payload = domainInputSchema.partial().safeParse(await c.req.json());
  if (!payload.success || Object.keys(payload.data).length === 0)
    return c.json({ error: "Invalid domain update" }, 400);

  const current = await db.query.projectDomains.findFirst({
    where: and(
      eq(projectDomains.id, c.req.param("domainId")),
      eq(projectDomains.projectId, access.project.id),
    ),
  });
  if (!current) return c.json({ error: "Domain not found" }, 404);
  if (current.routingMigrationState === "legacy" && (!payload.data.applicationId || !payload.data.targetPort || !payload.data.upstreamProtocol))
    return c.json({ error: "Legacy domains must be migrated with applicationId, targetPort, and upstreamProtocol together" }, 400);
  try {
    await validateDomainTarget(access.project.id, {
      applicationId: payload.data.applicationId ?? current.applicationId ?? undefined,
      deploymentId: payload.data.deploymentId ?? current.deploymentId,
      targetPort: payload.data.targetPort ?? current.targetPort ?? undefined,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid domain target" }, 400);
  }

  const targetWasSupplied = payload.data.applicationId !== undefined || payload.data.targetPort !== undefined || payload.data.deploymentId !== undefined || payload.data.upstreamProtocol !== undefined;
  const update = {
    ...payload.data,
    ...(payload.data.hostname ? { status: "pending" as const, sslExpiresAt: null } : {}),
    ...(targetWasSupplied ? { routingMigrationState: "target" as const } : {}),
  };
  const allDomains = await db.select({ id: projectDomains.id, hostname: projectDomains.hostname }).from(projectDomains).where(eq(projectDomains.projectId, access.project.id));
  const nextDomains = allDomains.map((domain) => domain.id === current.id ? { ...domain, hostname: payload.data.hostname ?? domain.hostname } : domain);
  if (
    payload.data.hostname &&
    nextDomains.some(
      (domain) => domain.id !== current.id && domain.hostname === payload.data.hostname,
    )
  ) {
    return c.json({ error: "Hostname is already assigned to this project" }, 409);
  }
  const result = await db
    .update(projectDomains)
    .set(update)
    .where(
      and(
        eq(projectDomains.id, c.req.param("domainId")),
        eq(projectDomains.projectId, access.project.id),
      ),
    )
    .returning();
  try {
    const published = await syncTraefikRoutes(access.project.id);
    // An active legacy domain deliberately preserves the old project config.
    // Do not claim this changed target is live until its config can be published.
    if (!published) {
      await db.update(projectDomains).set({ status: "pending" }).where(eq(projectDomains.id, current.id));
      result[0]!.status = "pending";
    }
  }
  catch (error) {
    c.get("logger").error({ error, projectId: access.project.id }, "Unable to update Traefik domain route");
    return c.json({ error: "Domain was updated but its route could not be reconciled" }, 503);
  }
  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "domain.updated", targetType: "domain", targetId: current.id, metadata: JSON.stringify({ projectId: access.project.id, fields: Object.keys(update) }) });
  return c.json(result[0]);
});

projectRoutes.delete("/:orgSlug/projects/:projectId/domains/:domainId", async (c) => {
  const access = await getAuthorizedProject(
    c.req.raw,
    c.req.param("orgSlug"),
    c.req.param("projectId"),
  );
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  if (!access.permissions.includes("projects.update")) return c.json({ error: "Permission required: projects.update" }, 403);
  const current = await db.query.projectDomains.findFirst({
    where: and(
      eq(projectDomains.id, c.req.param("domainId")),
      eq(projectDomains.projectId, access.project.id),
    ),
  });
  if (!current) return c.json({ error: "Domain not found" }, 404);
  const result = await db
    .delete(projectDomains)
    .where(
      and(
        eq(projectDomains.id, c.req.param("domainId")),
        eq(projectDomains.projectId, access.project.id),
      ),
    )
    .returning({ id: projectDomains.id });
  if (!result[0]) return c.json({ error: "Domain not found" }, 404);
  try { await syncTraefikRoutes(access.project.id); }
  catch (error) {
    c.get("logger").error({ error, projectId: access.project.id }, "Unable to remove Traefik domain route");
  }
  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "domain.deleted", targetType: "domain", targetId: current.id, metadata: JSON.stringify({ projectId: access.project.id, hostname: current.hostname }) });
  return c.body(null, 204);
});

projectRoutes.post("/:orgSlug/projects/:projectId/domains/:domainId/verify", async (c) => {
  const access = await getAuthorizedProject(
    c.req.raw,
    c.req.param("orgSlug"),
    c.req.param("projectId"),
  );
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  if (!access.permissions.includes("projects.update")) return c.json({ error: "Permission required: projects.update" }, 403);
  const domain = await db.query.projectDomains.findFirst({
    where: and(
      eq(projectDomains.id, c.req.param("domainId")),
      eq(projectDomains.projectId, access.project.id),
    ),
  });
  if (!domain) return c.json({ error: "Domain not found" }, 404);
  if (!process.env.TRAEFIK_PUBLIC_IP && !process.env.TRAEFIK_CNAME_TARGET) {
    return c.json({ error: "DNS verification is not configured" }, 503);
  }

  const verified = await dnsManager.verifyDomain(domain.hostname);
  if (verified) {
    try {
      await db.update(projectDomains).set({ status: "active" }).where(eq(projectDomains.id, domain.id));
      const published = await syncTraefikRoutes(access.project.id);
      if (!published) await db.update(projectDomains).set({ status: "pending" }).where(eq(projectDomains.id, domain.id));
    } catch (error) {
      c.get("logger").error(
        { error, projectId: access.project.id, hostname: domain.hostname },
        "Unable to publish verified Traefik domain route",
      );
      return c.json({ error: "Domain was verified but could not be published" }, 503);
    }
  }
  const [result] = verified
    ? await db.select().from(projectDomains).where(eq(projectDomains.id, domain.id)).limit(1)
    : await db.update(projectDomains).set({ status: "pending" }).where(eq(projectDomains.id, domain.id)).returning();
  if (verified) await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: access.userId, action: "domain.verified", targetType: "domain", targetId: domain.id, metadata: JSON.stringify({ projectId: access.project.id, hostname: domain.hostname }) });
  return c.json(result);
});

export { projectRoutes };
