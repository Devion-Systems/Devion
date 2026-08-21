import { db, managedDatabases, member, organization, projectDomains, projects, team } from "@repo/db";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { DnsManager } from "../lib/network/dns.js";
import { type TraefikDomain, TraefikManager } from "../lib/network/traefik.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
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
  gitUrl: z.string().url().max(2_000).optional(),
  branch: z.string().trim().min(1).max(255).optional(),
  teamId: z.string().min(1).optional(),
});

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/);

const domainInputSchema = z.object({
  hostname: hostnameSchema,
  environment: z.string().trim().min(1).max(32).default("production"),
});

const TRAEFIK_ENABLED = process.env.TRAEFIK_ENABLED === "true";
const traefik = TRAEFIK_ENABLED ? new TraefikManager() : null;
const dnsManager = new DnsManager(process.env.TRAEFIK_PUBLIC_IP, process.env.TRAEFIK_CNAME_TARGET);

function resolveProjectUpstream(project: { slug: string; routingTargetUrl: string | null }) {
  if (project.routingTargetUrl) return project.routingTargetUrl;
  const template = process.env.TRAEFIK_PROJECT_UPSTREAM_TEMPLATE;
  if (!template) throw new Error("No deployment upstream is configured for this project");
  return template.replaceAll("{projectSlug}", project.slug);
}

async function syncTraefikRoutes(
  project: { id: string; slug: string; routingTargetUrl: string | null },
  domains: TraefikDomain[],
) {
  if (!traefik) throw new Error("Traefik domain routing is disabled");
  await traefik.syncProjectRoutes(
    {
      projectId: project.id,
      projectSlug: project.slug,
      targetUrl: resolveProjectUpstream(project),
    },
    domains,
  );
}

function activeDomains<T extends TraefikDomain & { status: string }>(
  domains: T[],
): TraefikDomain[] {
  return domains
    .filter((domain) => domain.status === "active")
    .map(({ id, hostname }) => ({ id, hostname }));
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

  return { organization: organizationRecord, membership, userId: session.user.id };
}

/** Returns the organisation and the caller's membership for the dashboard shell. */
projectRoutes.get("/:orgSlug", async (c) => {
  const access = await getAuthorizedOrganization(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);

  return c.json({ org: access.organization, membership: access.membership });
});

projectRoutes.get("/:orgSlug/projects", async (c) => {
  const access = await getAuthorizedOrganization(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);

  const items = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      status: projects.status,
      sourceType: projects.sourceType,
      branch: projects.branch,
      teamId: projects.teamId,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.organizationId, access.organization.id))
    .orderBy(asc(projects.name));

  return c.json(items);
});

/** Actual organization overview data. Deployment history is intentionally not inferred until a deployment runtime records it. */
projectRoutes.get("/:orgSlug/dashboard", async (c) => {
  const access = await getAuthorizedOrganization(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);
  const organizationId = access.organization.id;
  const [projectItems, projectTotals, healthyProjectTotals, databases, domains] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, slug: projects.slug, status: projects.status, branch: projects.branch, updatedAt: projects.updatedAt })
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .orderBy(desc(projects.updatedAt))
      .limit(5),
    db.select({ total: count() }).from(projects).where(eq(projects.organizationId, organizationId)),
    db
      .select({ total: count() })
      .from(projects)
      .where(and(eq(projects.organizationId, organizationId), eq(projects.status, "healthy"))),
    db
      .select({ status: managedDatabases.status, cpuMillicores: managedDatabases.cpuMillicores, memoryMib: managedDatabases.memoryMib, storageGib: managedDatabases.storageGib })
      .from(managedDatabases)
      .where(eq(managedDatabases.organizationId, organizationId)),
    db.select({ id: projectDomains.id }).from(projectDomains).where(eq(projectDomains.organizationId, organizationId)),
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
    projects: { total: projectTotals[0]?.total ?? 0, healthy: healthyProjectTotals[0]?.total ?? 0 },
    databases: { total: databases.length, ready: databases.filter((database) => database.status === "ready").length, failed: databases.filter((database) => database.status === "failed").length },
    domains: domains.length,
    allocated,
    recentProjects: projectItems,
  });
});

projectRoutes.post("/:orgSlug/projects", async (c) => {
  const access = await getAuthorizedOrganization(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);

  const payload = projectInputSchema.safeParse(await c.req.json());
  if (!payload.success)
    return c.json({ error: "Invalid project data", issues: payload.error.flatten() }, 400);

  if (payload.data.type === "git" && !payload.data.gitUrl) {
    return c.json({ error: "A Git repository URL is required for Git projects" }, 400);
  }

  if (payload.data.teamId) {
    const assignedTeam = await db.query.team.findFirst({
      where: and(eq(team.id, payload.data.teamId), eq(team.organizationId, access.organization.id)),
    });
    if (!assignedTeam) return c.json({ error: "Team not found in this organization" }, 400);
  }

  const id = crypto.randomUUID();
  try {
    await db.insert(projects).values({
      id,
      organizationId: access.organization.id,
      createdByUserId: access.userId,
      name: payload.data.name,
      slug: payload.data.slug,
      description: payload.data.description || null,
      sourceType: payload.data.type,
      gitUrl: payload.data.gitUrl || null,
      branch: payload.data.branch || "main",
      teamId: payload.data.teamId || null,
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
  const access = await getAuthorizedOrganization(request, orgSlug);
  if (!access) return null;

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.organizationId, access.organization.id)),
  });
  return project ? { ...access, project } : null;
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
    routingTargetUrl: access.project.routingTargetUrl,
    createdAt: access.project.createdAt,
    updatedAt: access.project.updatedAt,
  });
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
  const payload = domainInputSchema.safeParse(await c.req.json());
  if (!payload.success) return c.json({ error: "Invalid hostname" }, 400);

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

  // Attempt verification immediately. If DNS has not propagated yet, the
  // domain remains pending and the existing verify action can be retried.
  if (process.env.TRAEFIK_PUBLIC_IP || process.env.TRAEFIK_CNAME_TARGET) {
    const verified = await dnsManager.verifyDomain(payload.data.hostname);
    if (verified) {
      const allDomains = await db
        .select({
          id: projectDomains.id,
          hostname: projectDomains.hostname,
          status: projectDomains.status,
        })
        .from(projectDomains)
        .where(eq(projectDomains.projectId, access.project.id));
      try {
        await syncTraefikRoutes(access.project, [
          ...activeDomains(allDomains.filter((domain) => domain.id !== id)),
          { id, hostname: payload.data.hostname },
        ]);
        await db.update(projectDomains).set({ status: "active" }).where(eq(projectDomains.id, id));
        return c.json({ id, ...payload.data, status: "active" }, 201);
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

  const update = payload.data.hostname
    ? { ...payload.data, status: "pending" as const, sslExpiresAt: null }
    : payload.data;
  const allDomains = await db
    .select({
      id: projectDomains.id,
      hostname: projectDomains.hostname,
      status: projectDomains.status,
    })
    .from(projectDomains)
    .where(eq(projectDomains.projectId, access.project.id));
  const nextDomains = allDomains.map((domain) =>
    domain.id === current.id
      ? { ...domain, hostname: payload.data.hostname ?? domain.hostname }
      : domain,
  );
  if (
    payload.data.hostname &&
    nextDomains.some(
      (domain) => domain.id !== current.id && domain.hostname === payload.data.hostname,
    )
  ) {
    return c.json({ error: "Hostname is already assigned to this project" }, 409);
  }
  try {
    // A changed hostname must be verified again, so remove its old active
    // route now and wait for the explicit verification before publishing it.
    await syncTraefikRoutes(
      access.project,
      activeDomains(
        payload.data.hostname
          ? nextDomains.filter((domain) => domain.id !== current.id)
          : nextDomains,
      ),
    );
  } catch (error) {
    c.get("logger").error(
      { error, projectId: access.project.id },
      "Unable to update Traefik domain route",
    );
    return c.json({ error: "Domain route could not be configured" }, 503);
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
  return c.json(result[0]);
});

projectRoutes.delete("/:orgSlug/projects/:projectId/domains/:domainId", async (c) => {
  const access = await getAuthorizedProject(
    c.req.raw,
    c.req.param("orgSlug"),
    c.req.param("projectId"),
  );
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
  const current = await db.query.projectDomains.findFirst({
    where: and(
      eq(projectDomains.id, c.req.param("domainId")),
      eq(projectDomains.projectId, access.project.id),
    ),
  });
  if (!current) return c.json({ error: "Domain not found" }, 404);
  const remainingDomains = await db
    .select({
      id: projectDomains.id,
      hostname: projectDomains.hostname,
      status: projectDomains.status,
    })
    .from(projectDomains)
    .where(eq(projectDomains.projectId, access.project.id));
  try {
    await syncTraefikRoutes(
      access.project,
      activeDomains(remainingDomains.filter((domain) => domain.id !== current.id)),
    );
  } catch (error) {
    c.get("logger").error(
      { error, projectId: access.project.id },
      "Unable to remove Traefik domain route",
    );
    return c.json({ error: "Domain route could not be removed" }, 503);
  }
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
  return c.body(null, 204);
});

projectRoutes.post("/:orgSlug/projects/:projectId/domains/:domainId/verify", async (c) => {
  const access = await getAuthorizedProject(
    c.req.raw,
    c.req.param("orgSlug"),
    c.req.param("projectId"),
  );
  if (!access) return c.json({ error: "Project not found or access denied" }, 404);
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
    const allDomains = await db
      .select({
        id: projectDomains.id,
        hostname: projectDomains.hostname,
        status: projectDomains.status,
      })
      .from(projectDomains)
      .where(eq(projectDomains.projectId, access.project.id));
    try {
      await syncTraefikRoutes(access.project, [
        ...activeDomains(allDomains.filter((item) => item.id !== domain.id)),
        { id: domain.id, hostname: domain.hostname },
      ]);
    } catch (error) {
      c.get("logger").error(
        { error, projectId: access.project.id, hostname: domain.hostname },
        "Unable to publish verified Traefik domain route",
      );
      return c.json({ error: "Domain was verified but could not be published" }, 503);
    }
  }
  const [result] = await db
    .update(projectDomains)
    .set({ status: verified ? "active" : "pending" })
    .where(eq(projectDomains.id, domain.id))
    .returning();
  return c.json(result);
});

export { projectRoutes };
