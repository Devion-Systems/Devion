import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AgentCommandResult, NodeResources } from "@repo/core";
import {
  agentCommands,
  applications,
  db,
  deployments,
  gameServers,
  member,
  nodeRegistrationTokens,
  nodes,
  organization,
  workloads,
} from "@repo/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

const routes = new Hono<AppEnv>();
const resourceQuantity = z.object({
  capacity: z.number().nonnegative(),
  allocatable: z.number().nonnegative(),
  reserved: z.number().nonnegative(),
  usage: z.number().nonnegative(),
});
const registerInput = z.object({
  registrationToken: z.string().min(32).max(512),
  name: z.string().trim().min(1).max(100),
  hostname: z.string().trim().min(1).max(253),
  architecture: z.string().trim().min(1).max(64),
  os: z.string().trim().min(1).max(128),
  agentVersion: z.string().trim().min(1).max(64),
  region: z.string().trim().max(64).optional(),
  labels: z.record(z.string().max(64)).default({}),
  capabilities: z.array(z.string().max(64)).max(50).default([]),
  runtimes: z
    .array(z.enum(["container", "microvm"]))
    .min(1)
    .default(["container"]),
});
const heartbeatInput = z.object({
  status: z.enum(["ready", "draining", "offline", "unhealthy"]),
  resources: z.object({
    cpuMilli: resourceQuantity,
    memoryMib: resourceQuantity,
    storageMib: resourceQuantity,
  }),
});
const commandResultInput = z
  .object({
    commandId: z.string().uuid(),
    status: z.enum(["succeeded", "failed"]),
    data: z.unknown().optional(),
    error: z
      .object({ code: z.string().min(1).max(100), message: z.string().min(1).max(1_000) })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "failed" && !value.error)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["error"],
        message: "Failed commands require an error",
      });
  });

const runtimeIdFromResult = z.object({ runtimeId: z.string().min(1).max(500) });
const runtimeResult = runtimeIdFromResult.extend({
  ports: z.record(z.number().int().min(1).max(65_535)).optional(),
});

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function createSecret() {
  return randomBytes(32).toString("base64url");
}
function manager(role: string) {
  return role === "owner" || role === "admin";
}

async function organizationAccess(request: Request, slug: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (!org) return null;
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, org.id), eq(member.userId, session.user.id)),
  });
  return membership ? { org, membership, userId: session.user.id } : null;
}

async function agentIdentity(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  if (!token) return null;
  const candidate = await db.query.nodes.findFirst({
    where: eq(nodes.agentTokenHash, tokenHash(token)),
  });
  if (!candidate) return null;
  // Defend against accidental future changes from using a non-constant-time comparison.
  return timingSafeEqual(Buffer.from(candidate.agentTokenHash), Buffer.from(tokenHash(token)))
    ? candidate
    : null;
}

routes.use("/organizations/*", requireAuthenticatedUser);

/** Creates a one-time registration secret; returned only in this response. */
routes.post("/organizations/:orgSlug/nodes/registration-tokens", async (c) => {
  const access = await organizationAccess(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);
  if (!manager(access.membership.role))
    return c.json({ error: "Owner or admin role required" }, 403);
  const parsed = z
    .object({ expiresInSeconds: z.number().int().min(60).max(86_400).default(3_600) })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Invalid registration token settings" }, 400);
  const secret = createSecret();
  const expiresAt = new Date(Date.now() + parsed.data.expiresInSeconds * 1_000);
  await db.insert(nodeRegistrationTokens).values({
    id: crypto.randomUUID(),
    organizationId: access.org.id,
    tokenHash: tokenHash(secret),
    expiresAt,
  });
  return c.json({ registrationToken: secret, expiresAt: expiresAt.toISOString() }, 201);
});

routes.get("/organizations/:orgSlug/nodes", async (c) => {
  const access = await organizationAccess(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);
  const items = await db
    .select({
      id: nodes.id,
      name: nodes.name,
      hostname: nodes.hostname,
      status: nodes.status,
      architecture: nodes.architecture,
      os: nodes.os,
      agentVersion: nodes.agentVersion,
      region: nodes.region,
      labels: nodes.labels,
      capabilities: nodes.capabilities,
      runtimes: nodes.runtimes,
      schedulingEnabled: nodes.schedulingEnabled,
      resources: nodes.resources,
      lastHeartbeatAt: nodes.lastHeartbeatAt,
      createdAt: nodes.createdAt,
    })
    .from(nodes)
    .where(eq(nodes.organizationId, access.org.id));
  return c.json(
    items.map((node) => ({ ...node, schedulingEnabled: node.schedulingEnabled === 1 })),
  );
});

/** Public enrollment endpoint. It accepts only a single-use registration secret, never a user session. */
routes.post("/api/agents/register", async (c) => {
  const parsed = registerInput.safeParse(await c.req.json());
  if (!parsed.success)
    return c.json({ error: "Invalid node registration", issues: parsed.error.flatten() }, 400);
  const registration = await db.query.nodeRegistrationTokens.findFirst({
    where: and(
      eq(nodeRegistrationTokens.tokenHash, tokenHash(parsed.data.registrationToken)),
      isNull(nodeRegistrationTokens.usedAt),
      gt(nodeRegistrationTokens.expiresAt, new Date()),
    ),
  });
  if (!registration) return c.json({ error: "Registration token is invalid or expired" }, 401);
  const agentToken = createSecret();
  const nodeId = crypto.randomUUID();
  const enrolled = await db.transaction(async (tx) => {
    const consumed = await tx
      .update(nodeRegistrationTokens)
      .set({ usedAt: new Date() })
      .where(
        and(eq(nodeRegistrationTokens.id, registration.id), isNull(nodeRegistrationTokens.usedAt)),
      )
      .returning({ id: nodeRegistrationTokens.id });
    if (consumed.length === 0) return false;
    await tx.insert(nodes).values({
      id: nodeId,
      organizationId: registration.organizationId,
      name: parsed.data.name,
      hostname: parsed.data.hostname,
      architecture: parsed.data.architecture,
      os: parsed.data.os,
      agentVersion: parsed.data.agentVersion,
      region: parsed.data.region ?? null,
      labels: parsed.data.labels,
      capabilities: parsed.data.capabilities,
      runtimes: parsed.data.runtimes,
      agentTokenHash: tokenHash(agentToken),
    });
    return true;
  });
  if (!enrolled) return c.json({ error: "Registration token was already used" }, 409);
  return c.json({ nodeId, agentToken }, 201);
});

routes.post("/api/agents/heartbeat", async (c) => {
  const node = await agentIdentity(c.req.raw);
  if (!node) return c.json({ error: "Agent authentication required" }, 401);
  const parsed = heartbeatInput.safeParse(await c.req.json());
  if (!parsed.success)
    return c.json({ error: "Invalid heartbeat", issues: parsed.error.flatten() }, 400);
  await db
    .update(nodes)
    .set({
      status: parsed.data.status,
      resources: parsed.data.resources,
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(nodes.id, node.id));
  // Resource snapshots are deliberately not accepted as user-writable node fields. Persisting time-series metrics is the observability module's responsibility.
  const resources: NodeResources = parsed.data.resources;
  return c.json({ accepted: true, resources });
});

routes.get("/api/agents/commands", async (c) => {
  const node = await agentIdentity(c.req.raw);
  if (!node) return c.json({ error: "Agent authentication required" }, 401);
  const commands = await db
    .select()
    .from(agentCommands)
    .where(
      and(
        eq(agentCommands.nodeId, node.id),
        or(eq(agentCommands.status, "pending"), eq(agentCommands.status, "delivered")),
      ),
    );
  return c.json(
    commands.map((command) => ({
      commandId: command.id,
      type: command.type,
      timestamp: command.createdAt.toISOString(),
      resourceId: command.resourceId,
      payload: command.payload,
      deadline: command.deadlineAt?.toISOString(),
    })),
  );
});

routes.post("/api/agents/commands/results", async (c) => {
  const node = await agentIdentity(c.req.raw);
  if (!node) return c.json({ error: "Agent authentication required" }, 401);
  const parsed = commandResultInput.safeParse(await c.req.json());
  if (!parsed.success)
    return c.json({ error: "Invalid command result", issues: parsed.error.flatten() }, 400);
  const result: AgentCommandResult = parsed.data;
  const updated = await db
    .update(agentCommands)
    .set({ status: result.status, result, completedAt: new Date() })
    .where(
      and(
        eq(agentCommands.id, result.commandId),
        eq(agentCommands.nodeId, node.id),
        or(eq(agentCommands.status, "pending"), eq(agentCommands.status, "delivered")),
      ),
    )
    .returning({
      id: agentCommands.id,
      type: agentCommands.type,
      resourceId: agentCommands.resourceId,
    });
  if (updated.length === 0) return c.json({ error: "Unknown or completed command" }, 404);
  const command = updated[0];
  if (!command) return c.json({ error: "Command result could not be persisted" }, 500);
  if (command.type === "workload.start") {
    const runtime = runtimeResult.safeParse(result.data);
    await db
      .update(workloads)
      .set({
        actualState: result.status === "succeeded" ? "running" : "failed",
        ...(runtime.success ? { runtimeId: runtime.data.runtimeId } : {}),
        lastReportedAt: new Date(),
      })
      .where(and(eq(workloads.id, command.resourceId), eq(workloads.nodeId, node.id)));
    const workload = await db.query.workloads.findFirst({
      where: eq(workloads.id, command.resourceId),
    });
    if (workload) {
      const deployment = await db.query.deployments.findFirst({
        where: eq(deployments.id, workload.deploymentId),
      });
      if (deployment) {
        await db
          .update(applications)
          .set({ status: result.status === "succeeded" ? "healthy" : "failed" })
          .where(eq(applications.id, deployment.applicationId));
        if (result.status === "succeeded") {
          const port = runtime.success ? runtime.data.ports?.["25565/tcp"] : undefined;
          await db
            .update(gameServers)
            .set({ status: "running", ...(port ? { runtimePort: port } : {}) })
            .where(eq(gameServers.applicationId, deployment.applicationId));
        } else {
          await db
            .update(gameServers)
            .set({ status: "failed" })
            .where(eq(gameServers.applicationId, deployment.applicationId));
        }
      }
    }
  } else if (command.type === "workload.stop" || command.type === "workload.delete") {
    await db
      .update(workloads)
      .set({
        actualState: result.status === "succeeded" ? "stopped" : "failed",
        lastReportedAt: new Date(),
      })
      .where(and(eq(workloads.id, command.resourceId), eq(workloads.nodeId, node.id)));
  }
  return c.body(null, 204);
});

export { routes as nodeRoutes };
