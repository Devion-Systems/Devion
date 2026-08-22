import {
  applications,
  agentCommands,
  db,
  deployments,
  gameServerAccess,
  gameServers,
  member,
  organization,
  projects,
  team,
  teamMember,
  user,
  workloads,
} from "@repo/db";
import { and, asc, desc, eq, or } from "drizzle-orm";
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

async function scope(request: Request, slug: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (!org) return null;
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, org.id), eq(member.userId, session.user.id)),
  });
  return membership ? { org, role: membership.role, userId: session.user.id } : null;
}

function manager(role: string) {
  return role === "owner" || role === "admin";
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
  access: { role: string; userId: string },
  required: ServerAccessRole,
) {
  if (manager(access.role)) return true;
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
  const servers = await db
    .select()
    .from(gameServers)
    .where(eq(gameServers.organizationId, access.org.id))
    .orderBy(asc(gameServers.name));
  if (manager(access.role)) return c.json(servers);
  const permitted = await Promise.all(
    servers.map(async (server) =>
      (await hasServerRole(server.id, access, "viewer")) ? server : null,
    ),
  );
  return c.json(permitted.filter((server): server is NonNullable<typeof server> => server !== null));
});

/** Game servers are container Applications and therefore always belong to a project. */
routes.post("/:orgSlug/game-servers", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  if (!manager(access.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const parsed = input.safeParse(await c.req.json());
  if (!parsed.success)
    return c.json(
      { error: "Invalid game server configuration", issues: parsed.error.flatten() },
      400,
    );
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, parsed.data.projectId), eq(projects.organizationId, access.org.id)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);
  const serverId = crypto.randomUUID();
  const applicationId = crypto.randomUUID();
  const deploymentId = crypto.randomUUID();
  const containerName = `devion-game-${serverId.replaceAll("-", "")}`;
  const image = "itzg/minecraft-server:java21";
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
        },
        ports: [{ containerPort: 25565 }],
        volumes: [{ name: `${containerName}-data`, target: "/data" }],
      },
    });
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
  await db.update(gameServers).set({ status: "stopped" }).where(eq(gameServers.id, server.id));
  return c.json({ status: "stopping" }, 202);
});

routes.post("/:orgSlug/game-servers/:serverId/start", async (c) => {
  const access = await scope(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Not found" }, 404);
  const server = await managedServer(access.org.id, c.req.param("serverId"));
  if (!server) return c.json({ error: "Game server must be migrated before agent control is available" }, 409);
  const deploymentId = server.deploymentId;
  if (!deploymentId) return c.json({ error: "Game server has no deployment" }, 409);
  if (!(await hasServerRole(server.id, access, "operator")))
    return c.json({ error: "Server operator role required" }, 403);
  await db.update(deployments).set({ desiredState: "running" }).where(eq(deployments.id, deploymentId));
  await db.update(gameServers).set({ status: "provisioning" }).where(eq(gameServers.id, server.id));
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
  if (!server?.applicationId)
    return c.json({ error: "Legacy game servers must be migrated before deletion" }, 409);
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
