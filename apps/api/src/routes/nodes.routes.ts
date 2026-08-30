import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AgentCommandResult, NodeResources } from "@repo/core";
import {
  agentCommands,
  applications,
  auditLogs,
  db,
  deploymentEvents,
  deployments,
  environmentVariables,
  gameServers,
  member,
  nodeRegistrationTokens,
  nodes,
  organization,
  projectEnvironments,
  volumes,
  workloadPorts,
  workloads,
} from "@repo/db";
import { and, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { resolveRolePermissions } from "../features/organizations/permissions.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import { resolveOrganizationAccess } from "../middleware/organization-policy.js";
import { decryptEnvironmentValue } from "../features/environments/crypto.js";
import { normalizeAdvertisedAddress } from "../features/routing/safe-address.js";
import { PostgresWorkloadMetricsProvider } from "../features/metrics/postgres-provider.js";
import { reconcileDomainRoutesForNode } from "../features/routing/controller.js";
import { refreshDeploymentStatus } from "../modules/deployments/service.js";
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
  advertisedAddress: z.string().trim().min(1).max(253).optional(),
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
const localRegisterInput = registerInput
  .omit({ registrationToken: true })
  .extend({ localToken: z.string().min(32).max(512) });
const heartbeatInput = z.object({
  status: z.enum(["ready", "draining", "offline", "unhealthy"]),
  resources: z.object({
    cpuMilli: resourceQuantity,
    memoryMib: resourceQuantity,
    storageMib: resourceQuantity,
  }),
});
const nodeSettingsInput = z.object({ schedulingEnabled: z.boolean().optional(), advertisedAddress: z.string().trim().min(1).max(253).nullable().optional() }).refine((value) => Object.keys(value).length > 0);
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
function secretMatches(candidate: string, expected: string) {
  return timingSafeEqual(Buffer.from(tokenHash(candidate)), Buffer.from(tokenHash(expected)));
}
async function organizationAccess(request: Request, slug: string) {
  const access = await resolveOrganizationAccess(request, slug);
  if (!access) return null;
  return {
    ...access,
    permissions: await resolveRolePermissions(access.membership.role, access.org.id),
  };
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
  if (!access.permissions.includes("nodes.manage"))
    return c.json({ error: "Permission required: nodes.manage" }, 403);
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
  if (!access.permissions.includes("nodes.read"))
    return c.json({ error: "Permission required: nodes.read" }, 403);
  const items = await db
    .select({
      id: nodes.id,
      name: nodes.name,
      hostname: nodes.hostname,
      advertisedAddress: nodes.advertisedAddress,
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
    .where(or(eq(nodes.organizationId, access.org.id), isNull(nodes.organizationId)));
  return c.json(items.map((node) => ({ ...node, schedulingEnabled: node.schedulingEnabled === 1 })));
});

/** Node details and assignments are read-only control-plane views for the dashboard. */
routes.get("/organizations/:orgSlug/nodes/:nodeId", async (c) => {
  const access = await organizationAccess(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);
  if (!access.permissions.includes("nodes.read"))
    return c.json({ error: "Permission required: nodes.read" }, 403);
  const node = await db.query.nodes.findFirst({
    where: and(
      eq(nodes.id, c.req.param("nodeId")),
      or(eq(nodes.organizationId, access.org.id), isNull(nodes.organizationId)),
    ),
  });
  if (!node) return c.json({ error: "Node not found" }, 404);
  const assignments = await db
    .select({
      id: workloads.id,
      desiredState: workloads.desiredState,
      actualState: workloads.actualState,
      runtimeId: workloads.runtimeId,
      lastReportedAt: workloads.lastReportedAt,
      deploymentId: deployments.id,
      image: deployments.image,
      applicationId: applications.id,
      applicationName: applications.name,
      projectId: applications.projectId,
    })
    .from(workloads)
    .innerJoin(deployments, eq(workloads.deploymentId, deployments.id))
    .innerJoin(applications, eq(deployments.applicationId, applications.id))
    .where(eq(workloads.nodeId, node.id));
  return c.json({
    ...node,
    schedulingEnabled: node.schedulingEnabled === 1,
    assignments,
  });
});

routes.patch("/organizations/:orgSlug/nodes/:nodeId", async (c) => {
  const access = await organizationAccess(c.req.raw, c.req.param("orgSlug"));
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);
  if (!access.permissions.includes("nodes.manage"))
    return c.json({ error: "Permission required: nodes.manage" }, 403);
  const parsed = nodeSettingsInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid node settings" }, 400);
  let advertisedAddress: string | null | undefined = parsed.data.advertisedAddress;
  if (advertisedAddress) {
    try { advertisedAddress = normalizeAdvertisedAddress(advertisedAddress); }
    catch (error) { return c.json({ error: error instanceof Error ? error.message : "Invalid advertised address" }, 400); }
  }
  const updated = await db
    .update(nodes)
    .set({ ...(parsed.data.schedulingEnabled === undefined ? {} : { schedulingEnabled: parsed.data.schedulingEnabled ? 1 : 0 }), ...(advertisedAddress !== undefined ? { advertisedAddress } : {}), updatedAt: new Date() })
    .where(
      and(
        eq(nodes.id, c.req.param("nodeId")),
        or(eq(nodes.organizationId, access.org.id), isNull(nodes.organizationId)),
      ),
    )
    .returning({ id: nodes.id, schedulingEnabled: nodes.schedulingEnabled, advertisedAddress: nodes.advertisedAddress });
  if (!updated[0]) return c.json({ error: "Node not found" }, 404);
  if (advertisedAddress !== undefined) {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorId: access.userId,
      action: "node.advertised_address_updated",
      targetType: "node",
      targetId: updated[0].id,
      metadata: JSON.stringify({ organizationId: access.org.id, advertisedAddress: updated[0].advertisedAddress }),
      ipAddress: c.req.header("x-real-ip") ?? null,
    });
    void reconcileDomainRoutesForNode(updated[0].id).catch((error) =>
      c.get("logger").error({ error, nodeId: updated[0].id }, "Unable to reconcile routes after advertised address change"),
    );
  }
  return c.json({ id: updated[0].id, schedulingEnabled: updated[0].schedulingEnabled === 1, advertisedAddress: updated[0].advertisedAddress });
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
  let advertisedAddress: string | null = null;
  try { advertisedAddress = parsed.data.advertisedAddress ? normalizeAdvertisedAddress(parsed.data.advertisedAddress) : null; }
  catch (error) { return c.json({ error: error instanceof Error ? error.message : "Invalid advertised address" }, 400); }
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
      advertisedAddress,
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

/**
 * The host that runs Devion is available by default. Its secret exists only in
 * the local Compose environment, so it can enroll without being assigned to a
 * customer organization. Extra, remote hosts still use one-time org tokens.
 */
routes.post("/api/agents/local/register", async (c) => {
  const parsed = localRegisterInput.safeParse(await c.req.json());
  if (!parsed.success)
    return c.json(
      { error: "Invalid local agent registration", issues: parsed.error.flatten() },
      400,
    );
  const localToken = process.env.DEVION_LOCAL_AGENT_TOKEN;
  if (!localToken || !secretMatches(parsed.data.localToken, localToken))
    return c.json({ error: "Local agent authentication required" }, 401);
  const agentToken = createSecret();
  let advertisedAddress: string | null = null;
  try { advertisedAddress = parsed.data.advertisedAddress ? normalizeAdvertisedAddress(parsed.data.advertisedAddress) : null; }
  catch (error) { return c.json({ error: error instanceof Error ? error.message : "Invalid advertised address" }, 400); }
  const existing = await db.query.nodes.findFirst({
    where: and(isNull(nodes.organizationId), eq(nodes.hostname, parsed.data.hostname)),
  });
  const values = {
    name: parsed.data.name,
    hostname: parsed.data.hostname,
    advertisedAddress,
    architecture: parsed.data.architecture,
    os: parsed.data.os,
    agentVersion: parsed.data.agentVersion,
    region: parsed.data.region ?? null,
    labels: parsed.data.labels,
    capabilities: parsed.data.capabilities,
    runtimes: parsed.data.runtimes,
    status: "provisioning" as const,
    agentTokenHash: tokenHash(agentToken),
    updatedAt: new Date(),
  };
  const nodeId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    await db.update(nodes).set(values).where(eq(nodes.id, existing.id));
  } else {
    await db.insert(nodes).values({ id: nodeId, organizationId: null, ...values });
  }
  return c.json({ nodeId, agentToken }, existing ? 200 : 201);
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
      ...(parsed.data.status === "ready" ? { unhealthyAt: null, offlineAt: null } : {}),
      ...(parsed.data.status === "unhealthy" ? { unhealthyAt: new Date(), offlineAt: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(nodes.id, node.id));
  if (parsed.data.status === "ready") {
    await db.update(volumes).set({ status: "in_use" }).where(and(
      eq(volumes.nodeId, node.id),
      eq(volumes.status, "unavailable"),
    ));
  }
  if (node.status !== parsed.data.status) {
    void reconcileDomainRoutesForNode(node.id).catch((error) =>
      c.get("logger").error({ error, nodeId: node.id }, "Unable to reconcile routes after node status change"),
    );
  }
  // Resource snapshots are deliberately not accepted as user-writable node fields. Persisting time-series metrics is the observability module's responsibility.
  const resources: NodeResources = parsed.data.resources;
  return c.json({ accepted: true, resources });
});

routes.get("/api/agents/commands", async (c) => {
  const node = await agentIdentity(c.req.raw);
  if (!node) return c.json({ error: "Agent authentication required" }, 401);
  // A command is leased to one poll. If the agent dies before reporting its
  // result, the expired lease makes it eligible again without re-running it on
  // every normal polling interval.
  const now = new Date();
  const leaseExpiredAt = new Date(now.getTime() - 5 * 60_000);
  const candidates = await db
    .select()
    .from(agentCommands)
    .where(
      and(
        eq(agentCommands.nodeId, node.id),
        or(
          eq(agentCommands.status, "pending"),
          and(
            eq(agentCommands.status, "delivered"),
            or(isNull(agentCommands.deliveredAt), lt(agentCommands.deliveredAt, leaseExpiredAt)),
          ),
        ),
      ),
    );
  const commands = (await Promise.all(
    candidates.map((candidate) =>
      db
        .update(agentCommands)
        .set({
          status: "delivered",
          deliveredAt: now,
          deliveryAttempts: sql`${agentCommands.deliveryAttempts} + 1`,
        })
        .where(
          and(
            eq(agentCommands.id, candidate.id),
            eq(agentCommands.nodeId, node.id),
            or(
              eq(agentCommands.status, "pending"),
              and(
                eq(agentCommands.status, "delivered"),
                or(isNull(agentCommands.deliveredAt), lt(agentCommands.deliveredAt, leaseExpiredAt)),
              ),
            ),
          ),
        )
        .returning(),
    ),
  )).flat();
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
const reportedPortsInput = z.record(z.number().int().min(1).max(65_535));
const workloadTelemetryInput = z.object({ reports: z.array(z.object({ workloadId: z.string().uuid(), reportGeneration: z.number().int().positive(), actualState: z.enum(["running", "stopped", "failed", "unknown"]), healthStatus: z.enum(["none", "starting", "healthy", "unhealthy"]), healthMessage: z.string().trim().min(1).max(1_000).optional(), observedAt: z.string().datetime(), ports: reportedPortsInput.optional() })).min(1).max(500) });
const metricNumber = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER);
const workloadMetricsInput = z.object({ samples: z.array(z.object({ workloadId: z.string().uuid(), recordedAt: z.string().datetime(), cpuUsagePercent: z.number().finite().min(0).max(10_000).nullable(), memoryUsageBytes: metricNumber, memoryLimitBytes: metricNumber.nullable(), networkRxBytes: metricNumber, networkTxBytes: metricNumber, diskReadBytes: metricNumber, diskWriteBytes: metricNumber })).min(1).max(500) });

const configuredPortsSchema = z.object({ ports: z.array(z.object({ containerPort: z.number().int().min(1).max(65_535), protocol: z.enum(["tcp", "udp"]).optional(), exposure: z.enum(["private", "public"]).optional() })).default([]) });

async function replaceObservedWorkloadPorts(nodeId: string, workloadId: string, ports: Record<string, number>): Promise<void> {
  const workload = await db.query.workloads.findFirst({ where: and(eq(workloads.id, workloadId), eq(workloads.nodeId, nodeId)) });
  if (!workload) return;
  const deployment = await db.query.deployments.findFirst({ where: eq(deployments.id, workload.deploymentId) });
  const configured = configuredPortsSchema.safeParse(deployment?.runtimeConfig).data?.ports ?? [];
  const observed = Object.entries(ports).flatMap(([key, hostPort]) => {
    const match = /^(\d+)\/(tcp|udp)$/.exec(key);
    if (!match) return [];
    const containerPort = Number(match[1]); const protocol = match[2] as "tcp" | "udp";
    const configuredPort = configured.find((item) => item.containerPort === containerPort && (item.protocol ?? "tcp") === protocol);
    if (!configuredPort || (configuredPort.exposure ?? "private") !== "public") return [];
    return [{ workloadId, containerPort, hostPort, protocol, exposure: "public" as const, observedAt: new Date() }];
  });
  await db.transaction(async (tx) => {
    await tx.delete(workloadPorts).where(eq(workloadPorts.workloadId, workloadId));
    if (observed.length) await tx.insert(workloadPorts).values(observed);
  });
}

/** Delivers decrypted secrets only to the agent assigned to this workload. They are never copied into commands or deployment records. */
routes.get("/api/agents/workloads/:workloadId/secrets", async (c) => {
  const node = await agentIdentity(c.req.raw);
  if (!node) return c.json({ error: "Agent authentication required" }, 401);
  const workload = await db.query.workloads.findFirst({ where: and(eq(workloads.id, c.req.param("workloadId")), eq(workloads.nodeId, node.id)) });
  if (!workload) return c.json({ error: "Workload not found" }, 404);
  const deployment = await db.query.deployments.findFirst({ where: eq(deployments.id, workload.deploymentId) });
  if (!deployment) return c.json({ error: "Deployment not found" }, 404);
  const application = await db.query.applications.findFirst({ where: eq(applications.id, deployment.applicationId) });
  if (!application) return c.json({ error: "Application not found" }, 404);
  const snapshot = deployment.configurationSnapshot as { environmentId?: unknown; secretReferences?: unknown } | null;
  const environmentId = typeof snapshot?.environmentId === "string" ? snapshot.environmentId : null;
  const references = z.array(z.object({ targetKey: z.string().regex(/^[A-Z_][A-Z0-9_]{0,127}$/), secretEnvironmentVariableId: z.string().uuid() })).safeParse(snapshot?.secretReferences ?? []);
  if (!environmentId || !references.success || references.data.length === 0) return c.json({ environment: {} });
  const values = await db.select({ id: environmentVariables.id, valueEncrypted: environmentVariables.valueEncrypted }).from(environmentVariables).where(and(inArray(environmentVariables.id, references.data.map((reference) => reference.secretEnvironmentVariableId)), eq(environmentVariables.environmentId, environmentId), eq(environmentVariables.isSecret, true)));
  const encryptedById = new Map(values.map((value) => [value.id, value.valueEncrypted]));
  const environment = Object.fromEntries(await Promise.all(references.data.filter((reference) => encryptedById.has(reference.secretEnvironmentVariableId)).map(async (reference) => [reference.targetKey, await decryptEnvironmentValue(encryptedById.get(reference.secretEnvironmentVariableId)!) ] as const)));
  return c.json({ environment });
});

/** Registry credentials are delivered separately from container environment variables. */
routes.get("/api/agents/workloads/:workloadId/registry-credentials", async (c) => {
  const node = await agentIdentity(c.req.raw);
  if (!node) return c.json({ error: "Agent authentication required" }, 401);
  const workload = await db.query.workloads.findFirst({ where: and(eq(workloads.id, c.req.param("workloadId")), eq(workloads.nodeId, node.id)) });
  if (!workload) return c.json({ error: "Workload not found" }, 404);
  const deployment = await db.query.deployments.findFirst({ where: eq(deployments.id, workload.deploymentId) });
  if (!deployment) return c.json({ error: "Deployment not found" }, 404);
  const application = await db.query.applications.findFirst({ where: eq(applications.id, deployment.applicationId) });
  if (!application) return c.json({ error: "Application not found" }, 404);
  const snapshot = deployment.configurationSnapshot as { registryCredentialReference?: unknown } | null;
  const reference = typeof snapshot?.registryCredentialReference === "string" ? snapshot.registryCredentialReference : null;
  if (!reference) return c.json({ credentials: null });
  const [credential] = await db.select({ valueEncrypted: environmentVariables.valueEncrypted }).from(environmentVariables).innerJoin(projectEnvironments, eq(environmentVariables.environmentId, projectEnvironments.id)).where(and(eq(environmentVariables.id, reference), eq(environmentVariables.isSecret, true), eq(projectEnvironments.projectId, application.projectId))).limit(1);
  if (!credential) return c.json({ error: "Registry credential is unavailable" }, 409);
  let raw: unknown;
  try { raw = JSON.parse(await decryptEnvironmentValue(credential.valueEncrypted)); }
  catch { return c.json({ error: "Registry credential must contain JSON username and password fields" }, 409); }
  const parsed = z.object({ username: z.string().min(1).max(512), password: z.string().min(1).max(4096) }).safeParse(raw);
  if (!parsed.success) return c.json({ error: "Registry credential must contain JSON username and password fields" }, 409);
  return c.json({ credentials: parsed.data });
});

routes.get("/api/agents/workloads", async (c) => {
  const node = await agentIdentity(c.req.raw);
  if (!node) return c.json({ error: "Agent authentication required" }, 401);
  return c.json(await db.select({ workloadId: workloads.id, cpuMilli: sql<number>`(${deployments.requirements}->>'cpuMilli')::integer`, reportGeneration: workloads.reportGeneration }).from(workloads).innerJoin(deployments, eq(workloads.deploymentId, deployments.id)).where(and(eq(workloads.nodeId, node.id), eq(workloads.desiredState, "running"))));
});

routes.post("/api/agents/workloads/telemetry", async (c) => {
  const node = await agentIdentity(c.req.raw);
  if (!node) return c.json({ error: "Agent authentication required" }, 401);
  const parsed = workloadTelemetryInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid workload telemetry", issues: parsed.error.flatten() }, 400);
  const now = new Date();
  const reports = parsed.data.reports.map((report) => ({ ...report, observedAt: new Date(report.observedAt) }));
  if (reports.some((report) => report.observedAt.getTime() < now.getTime() - 5 * 60_000 || report.observedAt.getTime() > now.getTime() + 60_000)) return c.json({ error: "Health timestamp is outside the accepted window" }, 400);
  const reportIds = [...new Set(reports.map((report) => report.workloadId))];
  if (reportIds.length !== reports.length) return c.json({ error: "A telemetry batch may contain each workload only once" }, 400);
  const owned = await db.select({ id: workloads.id, reportGeneration: workloads.reportGeneration, healthStatus: workloads.healthStatus, healthCheckedAt: workloads.healthCheckedAt }).from(workloads).where(and(inArray(workloads.id, reportIds), eq(workloads.nodeId, node.id)));
  if (owned.length !== reportIds.length) return c.json({ error: "Telemetry batch contains a workload not assigned to this node" }, 403);
  const generations = new Map(owned.map((workload) => [workload.id, workload.reportGeneration]));
  if (reports.some((report) => generations.get(report.workloadId) !== report.reportGeneration)) return c.json({ error: "Telemetry report generation is stale" }, 409);
  const previous = new Map(owned.map((workload) => [workload.id, workload]));
  if (reports.some((report) => (previous.get(report.workloadId)?.healthCheckedAt?.getTime() ?? Number.NEGATIVE_INFINITY) >= report.observedAt.getTime())) return c.json({ error: "Telemetry report is older than the current workload state" }, 409);
  await Promise.all(reports.map(async (report) => {
    const prior = previous.get(report.workloadId);
    await db.update(workloads).set({ actualState: report.actualState, healthStatus: report.healthStatus, healthMessage: report.healthMessage ?? null, healthFailureCount: report.healthStatus === "unhealthy" ? sql`${workloads.healthFailureCount} + 1` : 0, healthCheckedAt: report.observedAt, ...(report.healthStatus === "healthy" ? { lastHealthyAt: report.observedAt } : {}), ...(prior?.healthStatus !== report.healthStatus ? { healthChangedAt: now } : {}), ...(report.ports === undefined ? {} : { publishedPorts: report.ports }), lastReportedAt: now }).where(and(eq(workloads.id, report.workloadId), eq(workloads.nodeId, node.id), eq(workloads.reportGeneration, report.reportGeneration), or(isNull(workloads.healthCheckedAt), lt(workloads.healthCheckedAt, report.observedAt))));
    if (report.ports !== undefined) await replaceObservedWorkloadPorts(node.id, report.workloadId, report.ports);
  }));
  const reportedIds = reports.map((report) => report.workloadId);
  const reportedWorkloads = reportedIds.length
    ? await db.select({ deploymentId: workloads.deploymentId }).from(workloads).where(and(inArray(workloads.id, reportedIds), eq(workloads.nodeId, node.id)))
    : [];
  await Promise.all([...new Set(reportedWorkloads.map((workload) => workload.deploymentId))].map((deploymentId) => refreshDeploymentStatus(deploymentId)));
  if (reports.some((report) => report.ports !== undefined)) {
    void reconcileDomainRoutesForNode(node.id).catch((error) =>
      c.get("logger").error({ error, nodeId: node.id }, "Unable to reconcile routes after workload port report"),
    );
  }
  return c.json({ accepted: reports.length });
});

/** Agent-only batch ingestion. The node is derived from the bearer token, not client input. */
routes.post("/api/agents/workloads/metrics", async (c) => {
  const node = await agentIdentity(c.req.raw);
  if (!node) return c.json({ error: "Agent authentication required" }, 401);
  const parsed = workloadMetricsInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid workload metrics", issues: parsed.error.flatten() }, 400);
  const now = Date.now();
  const samples = parsed.data.samples.map((sample) => ({ ...sample, recordedAt: new Date(sample.recordedAt) }));
  if (samples.some((sample) => sample.recordedAt.getTime() < now - 8 * 24 * 60 * 60_000 || sample.recordedAt.getTime() > now + 5 * 60_000)) return c.json({ error: "Metric timestamp is outside the accepted window" }, 400);
  const ids = [...new Set(samples.map((sample) => sample.workloadId))];
  const owned = await db.select({ id: workloads.id }).from(workloads).where(and(inArray(workloads.id, ids), eq(workloads.nodeId, node.id)));
  if (owned.length !== ids.length) return c.json({ error: "Metric batch contains a workload not assigned to this node" }, 403);
  await new PostgresWorkloadMetricsProvider().write(samples.map((sample) => ({ ...sample, nodeId: node.id })));
  return c.json({ accepted: samples.length }, 202);
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
        eq(agentCommands.status, "delivered"),
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
        ...(runtime.success && runtime.data.ports ? { publishedPorts: runtime.data.ports } : {}),
        lastReportedAt: new Date(),
      })
      .where(and(eq(workloads.id, command.resourceId), eq(workloads.nodeId, node.id)));
    const workload = await db.query.workloads.findFirst({
      where: eq(workloads.id, command.resourceId),
    });
    if (workload) {
      await db.insert(deploymentEvents).values({
        id: crypto.randomUUID(), deploymentId: workload.deploymentId, workloadId: workload.id, nodeId: node.id,
        type: result.status === "succeeded" ? "workload.started" : "workload.start_failed",
        message: result.status === "succeeded" ? "Workload started on agent" : "Agent failed to start workload",
        reason: result.status === "succeeded" ? null : typeof (result.data as { error?: unknown } | undefined)?.error === "string" ? (result.data as { error: string }).error : null,
      });
      const deployment = await db.query.deployments.findFirst({
        where: eq(deployments.id, workload.deploymentId),
      });
      if (deployment) {
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
      await refreshDeploymentStatus(workload.deploymentId);
    }
    if (runtime.success && runtime.data.ports) {
      await replaceObservedWorkloadPorts(node.id, command.resourceId, runtime.data.ports);
    }
    void reconcileDomainRoutesForNode(node.id).catch((error) =>
      c.get("logger").error({ error, nodeId: node.id }, "Unable to reconcile routes after workload start"),
    );
  } else if (command.type === "workload.stop" || command.type === "workload.delete") {
    await db
      .update(workloads)
      .set({
        actualState: result.status === "succeeded" ? "stopped" : "failed",
        lastReportedAt: new Date(),
      })
      .where(and(eq(workloads.id, command.resourceId), eq(workloads.nodeId, node.id)));
    const workload = await db.query.workloads.findFirst({ where: eq(workloads.id, command.resourceId) });
    if (workload) {
      await db.insert(deploymentEvents).values({
        id: crypto.randomUUID(), deploymentId: workload.deploymentId, workloadId: workload.id, nodeId: node.id,
        type: result.status === "succeeded" ? "workload.stopped" : "workload.stop_failed",
        message: result.status === "succeeded" ? "Workload stopped on agent" : "Agent failed to stop workload",
      });
      await refreshDeploymentStatus(workload.deploymentId);
    }
    void reconcileDomainRoutesForNode(node.id).catch((error) =>
      c.get("logger").error({ error, nodeId: node.id }, "Unable to reconcile routes after workload stop"),
    );
  }
  return c.body(null, 204);
});

export { routes as nodeRoutes };
