import { randomBytes } from "node:crypto";
import {
  applications,
  agentCommands,
  db,
  deployments,
  deploymentEvents,
  gameServerAccess,
  gameServers,
  member,
  organization,
  team,
  teamMember,
  user,
  workloads,
} from "@repo/db";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { resolveRolePermissions } from "../features/organizations/permissions.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import { listAccessibleProjects, resolveProjectAccess } from "../features/projects/access.js";
import {
  reconcileDeployment,
  stopApplicationWorkloads,
} from "../modules/deployments/controller.js";
import type { AppEnv } from "../types/env.js";

const routes = new Hono<AppEnv>();
routes.use("/*", requireAuthenticatedUser);

const input = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  game: z.literal("minecraft-java"),
  version: z.string().trim().min(1).max(64).default("LATEST"),
  memoryMib: z.number().int().min(1024).max(16_384).default(2048),
});
const consoleInput = z.object({ command: z.string().trim().min(1).max(1_024) });
const logQuery = z.object({ tail: z.coerce.number().int().min(1).max(2_000).default(500) });
const filePath = z.string().min(1).max(240).refine(
  (path) => !path.startsWith("/") && !path.split("/").some((part) => part === "." || part === ".." || part === ""),
  "Path must stay within the Minecraft data directory",
);
const fileReadInput = z.object({ path: filePath });
const fileWriteInput = z.object({ path: filePath, content: z.string().max(512 * 1024) });
const accessInput = z.object({
  subjectType: z.enum(["user", "team"]),
  subjectId: z.string().min(1),
  role: z.enum(["viewer", "operator", "admin"]),
});
const accessRoleRank = { viewer: 1, operator: 2, admin: 3 } as const;
type ServerAccessRole = keyof typeof accessRoleRank;

// Current Minecraft releases require Java 25. Keeping this explicit makes the
// runtime stable even when the upstream `latest` image changes its Java line.
const minecraftRuntimeImage = "itzg/minecraft-server:java25";

function withRconEnabled(runtimeConfig: unknown) {
  const current = runtimeConfig && typeof runtimeConfig === "object" && !Array.isArray(runtimeConfig)
    ? runtimeConfig as Record<string, unknown>
    : {};
  const environment = current.environment && typeof current.environment === "object" && !Array.isArray(current.environment)
    ? current.environment as Record<string, string>
    : {};
  return {
    ...current,
    environment: {
      ...environment,
      ENABLE_RCON: "TRUE",
      RCON_PASSWORD: environment.RCON_PASSWORD || randomBytes(24).toString("base64url"),
    },
  };
}

async function scope(request: Request, slug: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (!org) return null;
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, org.id), eq(member.userId, session.user.id)),
  });
  return membership
    ? {
        org,
        permissions: await resolveRolePermissions(membership.role, org.id),
        userId: session.user.id,
      }
    : null;
}

async function serverWorkload(server: typeof gameServers.$inferSelect) {
  if (!server.deploymentId) return null;
  return db.query.workloads.findFirst({
    where: eq(workloads.deploymentId, server.deploymentId),
    orderBy: [desc(workloads.updatedAt)],
  });
}

async function managedServer(orgId: string, serverId: string) {
  const server = await db.query.gameServers.findFirst({
    where: and(eq(gameServers.id, serverId), eq(gameServers.organizationId, orgId)),
  });
  if (!server?.applicationId || !server.deploymentId) return null;
  return server;
}

async function hasServerRole(
  serverId: string,
  access: { permissions: string[]; userId: string },
  required: ServerAccessRole,
) {
  // Organization-level application management is the broadest grant. Specific
  // game-server grants remain available for operators and viewers.
  if (access.permissions.includes("applications.update")) return true;
  const [direct, viaTeam] = await Promise.all([
    db
      .select({ role: gameServerAccess.role })
      .from(gameServerAccess)
      .where(and(eq(gameServerAccess.gameServerId, serverId), eq(gameServerAccess.userId, access.userId))),
    db
      .select({ role: gameServerAccess.role })
      .from(gameServerAccess)
      .innerJoin(teamMember, eq(gameServerAccess.teamId, teamMember.teamId))
      .where(
        and(eq(gameServerAccess.gameServerId, serverId), eq(teamMember.userId, access.userId)),
      ),
  ]);
  return [...direct, ...viaTeam].some(
    (grant) => accessRoleRank[grant.role as ServerAccessRole] >= accessRoleRank[required],
  );
}

routes.get("/:orgSlug/game-servers", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const projectAccess = await listAccessibleProjects(c.req.raw, c.req.param("orgSlug"));
  if (!projectAccess) return c.json({ error: "Not found" }, 404);
  const projectIds = new Set(projectAccess.projects.map((project) => project.id));
  const servers = await db
    .select()
    .from(gameServers)
    .where(eq(gameServers.organizationId, access.org.id))
    .orderBy(asc(gameServers.name));
  const scopedServers = servers.filter((server) => server.projectId && projectIds.has(server.projectId));
  if (access.permissions.includes("applications.read")) return c.json(scopedServers);
  const permitted = await Promise.all(
    scopedServers.map(async (server) =>
      (await hasServerRole(server.id, access, "viewer")) ? server : null,
    ),
  );
  return c.json(permitted.filter((server): server is NonNullable<typeof server> => server !== null));
});

/** Game servers are container Applications and therefore always belong to a project. */
routes.post("/:orgSlug/game-servers", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  if (!access.permissions.includes("applications.create"))
    return c.json({ error: "Permission required: applications.create" }, 403);
  const parsed = input.safeParse(await c.req.json());
  if (!parsed.success)
    return c.json(
      { error: "Invalid game server configuration", issues: parsed.error.flatten() },
      400,
    );
  const projectAccess = await resolveProjectAccess(c.req.raw, c.req.param("orgSlug"), parsed.data.projectId, "applications.create");
  if (!projectAccess) return c.json({ error: "Project not found or access denied" }, 404);
  const project = projectAccess.project;
  if (project.status === "archived") return c.json({ error: "Archived projects cannot receive new game servers" }, 409);
  const serverId = crypto.randomUUID();
  const applicationId = crypto.randomUUID();
  const deploymentId = crypto.randomUUID();
  const containerName = `devion-game-${serverId.replaceAll("-", "")}`;
  const image = minecraftRuntimeImage;
  const { projectId: _projectId, ...game } = parsed.data;
  await db.transaction(async (tx) => {
    await tx.insert(applications).values({
      id: applicationId,
      organizationId: access.org.id,
      projectId: project.id,
      name: parsed.data.name,
      slug: `game-${serverId.slice(0, 8)}`,
      sourceType: "docker",
      imageName: image,
      containerName,
      internalPort: 25565,
      status: "deploying",
    });
    await tx.insert(gameServers).values({
      id: serverId,
      organizationId: access.org.id,
      projectId: project.id,
      applicationId,
      deploymentId,
      createdByUserId: access.userId,
      containerName,
      status: "provisioning",
      ...game,
    });
    await tx.insert(gameServerAccess).values({
      id: crypto.randomUUID(),
      gameServerId: serverId,
      subjectType: "user",
      userId: access.userId,
      role: "admin",
    });
    await tx.insert(deployments).values({
      id: deploymentId,
      applicationId,
      version: 1,
      image,
      replicas: 1,
      desiredState: "running",
      runtime: "container",
      requirements: {
        cpuMilli: 1_000,
        memoryMib: parsed.data.memoryMib,
        storageMib: 0,
        runtime: "container",
      },
      runtimeConfig: {
        environment: {
          EULA: "TRUE",
          VERSION: parsed.data.version,
          MOTD: parsed.data.name,
          MEMORY: `${parsed.data.memoryMib}M`,
          ENABLE_RCON: "TRUE",
          RCON_PASSWORD: randomBytes(24).toString("base64url"),
        },
        ports: [{ containerPort: 25565 }],
        volumes: [{ name: `${containerName}-data`, target: "/data" }],
      },
      configurationSnapshot: {
        source: { type: "image", image },
        runtime: "container",
        resources: { cpuMilli: 1_000, memoryMib: parsed.data.memoryMib, storageMib: 0 },
        ports: [{ containerPort: 25565 }],
        volumes: [{ name: `${containerName}-data`, target: "/data" }],
        environmentKeys: ["EULA", "VERSION", "MOTD", "MEMORY", "ENABLE_RCON", "RCON_PASSWORD"],
      },
      status: "queued",
    });
    await tx.insert(deploymentEvents).values({ id: crypto.randomUUID(), deploymentId, type: "deployment.created", message: "Game server deployment revision v1 created" });
  });
  await reconcileDeployment(deploymentId);
  return c.json({ id: serverId, applicationId, deploymentId, status: "provisioning" }, 202);
});

routes.post("/:orgSlug/game-servers/:serverId/stop", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const server = await db.query.gameServers.findFirst({
    where: and(
      eq(gameServers.id, c.req.param("serverId")),
      eq(gameServers.organizationId, access.org.id),
    ),
  });
  if (server && !(await hasServerRole(server.id, access, "operator")))
    return c.json({ error: "Server operator role required" }, 403);
  if (!server?.applicationId)
    return c.json(
      { error: "Legacy game servers must be migrated before agent control is available" },
      409,
    );
  await stopApplicationWorkloads(server.applicationId);
  // Docker assigns a new host port on every start. Never keep advertising a
  // previous port while the workload is stopping or stopped.
  await db
    .update(gameServers)
    .set({ status: "stopped", runtimePort: null })
    .where(eq(gameServers.id, server.id));
  return c.json({ status: "stopping" }, 202);
});

routes.post("/:orgSlug/game-servers/:serverId/start", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const server = await managedServer(access.org.id, c.req.param("serverId"));
  if (!server) return c.json({ error: "Game server must be migrated before agent control is available" }, 409);
  const deploymentId = server.deploymentId;
  if (!deploymentId) return c.json({ error: "Game server has no deployment" }, 409);
  const applicationId = server.applicationId;
  if (!applicationId) return c.json({ error: "Game server has no application" }, 409);
  if (!(await hasServerRole(server.id, access, "operator")))
    return c.json({ error: "Server operator role required" }, 403);
  const deployment = await db.query.deployments.findFirst({ where: eq(deployments.id, deploymentId) });
  if (!deployment) return c.json({ error: "Game server deployment not found" }, 404);
  await db
    .update(deployments)
    .set({
      desiredState: "running",
      image: minecraftRuntimeImage,
      runtimeConfig: withRconEnabled(deployment.runtimeConfig),
    })
    .where(eq(deployments.id, deploymentId));
  await db
    .update(applications)
    .set({ imageName: minecraftRuntimeImage })
    .where(eq(applications.id, applicationId));
  await db
    .update(gameServers)
    .set({ status: "provisioning", runtimePort: null })
    .where(eq(gameServers.id, server.id));
  await reconcileDeployment(deploymentId);
  return c.json({ status: "starting" }, 202);
});

routes.post("/:orgSlug/game-servers/:serverId/console", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const parsed = consoleInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid Minecraft command" }, 400);
  const server = await managedServer(access.org.id, c.req.param("serverId"));
  if (!server) return c.json({ error: "Game server not found" }, 404);
  if (!(await hasServerRole(server.id, access, "operator")))
    return c.json({ error: "Server operator role required" }, 403);
  const workload = await serverWorkload(server);
  if (!workload?.nodeId || workload.actualState !== "running")
    return c.json({ error: "Game server is not running" }, 409);
  const commandId = crypto.randomUUID();
  await db.insert(agentCommands).values({
    id: commandId,
    nodeId: workload.nodeId,
    type: "minecraft.command",
    resourceId: workload.id,
    payload: { command: parsed.data.command },
  });
  return c.json({ commandId, status: "pending" }, 202);
});

routes.get("/:orgSlug/game-servers/:serverId/console", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const query = logQuery.safeParse(c.req.query());
  if (!query.success) return c.json({ error: "Invalid log request" }, 400);
  const server = await managedServer(access.org.id, c.req.param("serverId"));
  if (!server) return c.json({ error: "Game server not found" }, 404);
  if (!(await hasServerRole(server.id, access, "viewer")))
    return c.json({ error: "Server viewer role required" }, 403);
  const workload = await serverWorkload(server);
  if (!workload?.nodeId || workload.actualState !== "running")
    return c.json({ logs: "", status: "stopped" });
  const [latest] = await db
    .select({ result: agentCommands.result, completedAt: agentCommands.completedAt })
    .from(agentCommands)
    .where(
      and(
        eq(agentCommands.resourceId, workload.id),
        eq(agentCommands.type, "minecraft.logs"),
        eq(agentCommands.status, "succeeded"),
      ),
    )
    .orderBy(desc(agentCommands.completedAt))
    .limit(1);
  const pending = await db.query.agentCommands.findFirst({
    where: and(
      eq(agentCommands.resourceId, workload.id),
      eq(agentCommands.type, "minecraft.logs"),
      or(eq(agentCommands.status, "pending"), eq(agentCommands.status, "delivered")),
    ),
  });
  if (!pending)
    await db.insert(agentCommands).values({
      id: crypto.randomUUID(),
      nodeId: workload.nodeId,
      type: "minecraft.logs",
      resourceId: workload.id,
      payload: { tail: query.data.tail },
    });
  const result = latest?.result as { data?: { logs?: unknown } } | null;
  return c.json({
    logs: typeof result?.data?.logs === "string" ? result.data.logs : "",
    updatedAt: latest?.completedAt?.toISOString() ?? null,
    status: "running",
  });
});

routes.get("/:orgSlug/game-servers/:serverId/console/commands/:commandId", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const server = await managedServer(access.org.id, c.req.param("serverId"));
  if (!server) return c.json({ error: "Game server not found" }, 404);
  if (!(await hasServerRole(server.id, access, "viewer")))
    return c.json({ error: "Server viewer role required" }, 403);
  const workload = await serverWorkload(server);
  if (!workload) return c.json({ error: "Game server has no workload" }, 409);
  const command = await db.query.agentCommands.findFirst({
    where: and(
      eq(agentCommands.id, c.req.param("commandId")),
      eq(agentCommands.resourceId, workload.id),
      eq(agentCommands.type, "minecraft.command"),
    ),
  });
  if (!command) return c.json({ error: "Console command not found" }, 404);
  const result = command.result as { data?: { output?: unknown }; error?: { message?: unknown } } | null;
  return c.json({
    status: command.status,
    output: typeof result?.data?.output === "string" ? result.data.output : "",
    error: typeof result?.error?.message === "string" ? result.error.message : null,
  });
});

async function enqueueFileCommand(
  c: { req: { raw: Request; param: (name: string) => string }; json: (value: unknown, status?: 200 | 202 | 400 | 403 | 404 | 409) => Response },
  type: "minecraft.files.list" | "minecraft.files.read" | "minecraft.files.write",
  payload: unknown,
  requiredRole: ServerAccessRole,
) {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const server = await managedServer(access.org.id, c.req.param("serverId"));
  if (!server) return c.json({ error: "Game server not found" }, 404);
  if (!(await hasServerRole(server.id, access, requiredRole)))
    return c.json({ error: `Server ${requiredRole} role required` }, 403);
  const workload = await serverWorkload(server);
  if (!workload?.nodeId || workload.actualState !== "running")
    return c.json({ error: "Game server is not running" }, 409);
  const commandId = crypto.randomUUID();
  await db.insert(agentCommands).values({ id: commandId, nodeId: workload.nodeId, type, resourceId: workload.id, payload });
  return c.json({ commandId, status: "pending" }, 202);
}

routes.post("/:orgSlug/game-servers/:serverId/files/list", (c) =>
  enqueueFileCommand(c, "minecraft.files.list", {}, "viewer"),
);
routes.post("/:orgSlug/game-servers/:serverId/files/read", async (c) => {
  const parsed = fileReadInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid file path" }, 400);
  return enqueueFileCommand(c, "minecraft.files.read", parsed.data, "viewer");
});
routes.post("/:orgSlug/game-servers/:serverId/files/write", async (c) => {
  const parsed = fileWriteInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid file update" }, 400);
  return enqueueFileCommand(c, "minecraft.files.write", parsed.data, "operator");
});
routes.get("/:orgSlug/game-servers/:serverId/files/commands/:commandId", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const server = await managedServer(access.org.id, c.req.param("serverId"));
  if (!server || !(await hasServerRole(server.id, access, "viewer"))) return c.json({ error: "Not found" }, 404);
  const workload = await serverWorkload(server);
  if (!workload) return c.json({ error: "Game server has no workload" }, 409);
  const command = await db.query.agentCommands.findFirst({
    where: and(
      eq(agentCommands.id, c.req.param("commandId")), eq(agentCommands.resourceId, workload.id),
      or(eq(agentCommands.type, "minecraft.files.list"), eq(agentCommands.type, "minecraft.files.read"), eq(agentCommands.type, "minecraft.files.write")),
    ),
  });
  if (!command) return c.json({ error: "File command not found" }, 404);
  const result = command.result as { data?: unknown; error?: { message?: string } } | null;
  return c.json({ status: command.status, data: result?.data ?? null, error: result?.error?.message ?? null });
});

routes.get("/:orgSlug/game-servers/:serverId/access", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const server = await managedServer(access.org.id, c.req.param("serverId"));
  if (!server) return c.json({ error: "Game server not found" }, 404);
  if (!(await hasServerRole(server.id, access, "admin")))
    return c.json({ error: "Server admin role required" }, 403);
  const grants = await db
    .select({
      id: gameServerAccess.id,
      subjectType: gameServerAccess.subjectType,
      role: gameServerAccess.role,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      teamId: team.id,
      teamName: team.name,
    })
    .from(gameServerAccess)
    .leftJoin(user, eq(gameServerAccess.userId, user.id))
    .leftJoin(team, eq(gameServerAccess.teamId, team.id))
    .where(eq(gameServerAccess.gameServerId, server.id));
  return c.json(grants);
});

routes.put("/:orgSlug/game-servers/:serverId/access", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const parsed = accessInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid server access grant" }, 400);
  const server = await managedServer(access.org.id, c.req.param("serverId"));
  if (!server) return c.json({ error: "Game server not found" }, 404);
  if (!(await hasServerRole(server.id, access, "admin")))
    return c.json({ error: "Server admin role required" }, 403);
  if (parsed.data.subjectType === "user") {
    const orgMember = await db.query.member.findFirst({
      where: and(eq(member.organizationId, access.org.id), eq(member.userId, parsed.data.subjectId)),
    });
    if (!orgMember) return c.json({ error: "User is not an organization member" }, 400);
  } else {
    const orgTeam = await db.query.team.findFirst({
      where: and(eq(team.id, parsed.data.subjectId), eq(team.organizationId, access.org.id)),
    });
    if (!orgTeam) return c.json({ error: "Team not found" }, 400);
  }
  const existing = await db.query.gameServerAccess.findFirst({
    where:
      parsed.data.subjectType === "user"
        ? and(eq(gameServerAccess.gameServerId, server.id), eq(gameServerAccess.userId, parsed.data.subjectId))
        : and(eq(gameServerAccess.gameServerId, server.id), eq(gameServerAccess.teamId, parsed.data.subjectId)),
  });
  if (existing) {
    await db.update(gameServerAccess).set({ role: parsed.data.role }).where(eq(gameServerAccess.id, existing.id));
  } else {
    await db.insert(gameServerAccess).values({
      id: crypto.randomUUID(), gameServerId: server.id, subjectType: parsed.data.subjectType,
      role: parsed.data.role,
      ...(parsed.data.subjectType === "user" ? { userId: parsed.data.subjectId } : { teamId: parsed.data.subjectId }),
    });
  }
  return c.body(null, 204);
});

routes.delete("/:orgSlug/game-servers/:serverId/access/:grantId", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const server = await managedServer(access.org.id, c.req.param("serverId"));
  if (!server) return c.json({ error: "Game server not found" }, 404);
  if (!(await hasServerRole(server.id, access, "admin")))
    return c.json({ error: "Server admin role required" }, 403);
  await db.delete(gameServerAccess).where(and(eq(gameServerAccess.id, c.req.param("grantId")), eq(gameServerAccess.gameServerId, server.id)));
  return c.body(null, 204);
});

routes.delete("/:orgSlug/game-servers/:serverId", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const server = await db.query.gameServers.findFirst({
    where: and(
      eq(gameServers.id, c.req.param("serverId")),
      eq(gameServers.organizationId, access.org.id),
    ),
  });
  if (server && !(await hasServerRole(server.id, access, "admin")))
    return c.json({ error: "Server admin role required" }, 403);
  if (!server) return c.json({ error: "Game server not found" }, 404);
  // Legacy records predate workloads and cannot have a live container or
  // persistent world managed by Devion. They must remain removable so users
  // can replace them with an actual deployable server.
  if (!server.applicationId) {
    await db.delete(gameServers).where(eq(gameServers.id, server.id));
    return c.body(null, 204);
  }
  const active = await db
    .select({ id: workloads.id })
    .from(workloads)
    .innerJoin(deployments, eq(workloads.deploymentId, deployments.id))
    .where(
      and(
        eq(deployments.applicationId, server.applicationId),
        eq(workloads.desiredState, "running"),
      ),
    )
    .limit(1);
  if (active.length > 0)
    return c.json({ error: "Stop the game server and wait for its workload before deletion" }, 409);
  await db.transaction(async (tx) => {
    await tx.delete(gameServers).where(eq(gameServers.id, server.id));
    await tx.delete(applications).where(eq(applications.id, server.applicationId!));
  });
  return c.body(null, 204);
});

export { routes as gameServerRoutes };
