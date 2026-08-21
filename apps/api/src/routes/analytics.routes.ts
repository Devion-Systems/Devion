import { auditLogs, checkDbHealth, db, member, organization, projects, session, team, user } from "@repo/db";
import { dockerRegistry } from "@repo/registry";
import { blobStorage } from "@repo/s3";
import { count, countDistinct, desc, eq, gte } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { requirePlatformAdmin } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

const analyticsRoutes = new Hono<AppEnv>();
analyticsRoutes.use("/*", requirePlatformAdmin);

function asNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

analyticsRoutes.get("/overview", async (c) => {
  const activeSince = new Date();
  activeSince.setDate(activeSince.getDate() - 30);

  const [
    userCount,
    organizationCount,
    teamCount,
    projectCount,
    activeUserCount,
    verifiedUserCount,
    database,
    registry,
  ] = await Promise.all([
    db.select({ value: count() }).from(user),
    db.select({ value: count() }).from(organization),
    db.select({ value: count() }).from(team),
    db.select({ value: count() }).from(projects),
    db
      .select({ value: countDistinct(session.userId) })
      .from(session)
      .where(gte(session.updatedAt, activeSince)),
    db.select({ value: count() }).from(user).where(eq(user.emailVerified, true)),
    checkDbHealth().catch(() => ({ status: "error" as const, latencyMs: 0 })),
    dockerRegistry.ping().catch(() => false),
  ]);

  let storage = "ok" as "ok" | "error";
  try {
    await blobStorage.ensureBucketExists("devion-health-check");
  } catch {
    storage = "error";
  }

  const recentUsers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(8);

  return c.json({
    generatedAt: new Date().toISOString(),
    totals: {
      users: asNumber(userCount[0]?.value),
      activeUsers: asNumber(activeUserCount[0]?.value),
      verifiedUsers: asNumber(verifiedUserCount[0]?.value),
      organizations: asNumber(organizationCount[0]?.value),
      teams: asNumber(teamCount[0]?.value),
      projects: asNumber(projectCount[0]?.value),
    },
    services: {
      api: "ok",
      database,
      registry: registry ? "ok" : "error",
      storage,
    },
    recentUsers,
  });
});

analyticsRoutes.get("/users", async (c) => {
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(100);

  return c.json(users);
});

analyticsRoutes.get("/users/:userId", async (c) => {
  const userId = c.req.param("userId");
  const account = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!account) return c.json({ error: "User not found" }, 404);

  const [memberships, sessions] = await Promise.all([
    db
      .select({
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        role: member.role,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, userId)),
    db
      .select({
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, userId))
      .orderBy(desc(session.updatedAt)),
  ]);

  return c.json({ user: account, memberships, sessions });
});
const userAction = z.object({ role: z.enum(["admin", "user", "moderator"]).optional(), banned: z.boolean().optional(), banReason: z.string().max(500).optional() });
analyticsRoutes.patch("/users/:userId", async (c) => {
  const input = userAction.safeParse(await c.req.json()); if (!input.success) return c.json({ error: "Invalid user action" }, 400);
  const current = await auth.api.getSession({ headers: c.req.raw.headers }); if (!current) return c.json({ error: "Unauthorized" }, 401);
  if (current.user.id === c.req.param("userId") && input.data.banned) return c.json({ error: "You cannot ban your own account" }, 400);
  const [updated] = await db.update(user).set(input.data).where(eq(user.id, c.req.param("userId"))).returning(); if (!updated) return c.json({ error: "User not found" }, 404);
  if (input.data.banned) await db.delete(session).where(eq(session.userId, updated.id));
  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: current.user.id, action: "user.updated", targetType: "user", targetId: updated.id, metadata: JSON.stringify(input.data), ipAddress: c.req.header("x-real-ip") ?? null });
  return c.json(updated);
});

export { analyticsRoutes };
