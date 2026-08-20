import { db, managedDatabases, member, organization } from "@repo/db";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { databasePlans, PostgresRuntime } from "../lib/hosting/postgres-runtime.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

const input = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{1,62}$/),
  engine: z.literal("postgresql"),
  version: z
    .string()
    .regex(/^\d+(?:\.\d+){0,2}$/)
    .max(32),
  plan: z.enum(["starter", "standard", "performance"]).default("starter"),
  region: z.string().max(80).default("local"),
  maintenanceWindow: z.string().max(120).optional(),
});
const routes = new Hono<AppEnv>();
const postgresRuntime = new PostgresRuntime();
routes.use("/*", requireAuthenticatedUser);
async function access(request: Request, slug: string) {
  const current = await auth.api.getSession({ headers: request.headers });
  if (!current) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (!org) return null;
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, org.id), eq(member.userId, current.user.id)),
  });
  return membership ? { org, userId: current.user.id } : null;
}
routes.get("/:orgSlug/databases", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Not found" }, 404);
  const databases = await db
    .select()
    .from(managedDatabases)
    .where(eq(managedDatabases.organizationId, scope.org.id))
    .orderBy(asc(managedDatabases.name));
  return c.json(
    await Promise.all(
      databases.map(async (database) => ({
        ...database,
        status: await postgresRuntime.status(database.containerName),
      })),
    ),
  );
});
routes.post("/:orgSlug/databases", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Not found" }, 404);
  const parsed = input.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid database configuration" }, 400);
  const id = crypto.randomUUID();
  const containerName = `devion-db-${id.replaceAll("-", "")}`;
  const databaseName = "app";
  const username = "devion";
  const password = crypto.getRandomValues(new Uint8Array(24));
  const generatedPassword = Buffer.from(password).toString("base64url");
  const resources = databasePlans[parsed.data.plan];
  try {
    await db.insert(managedDatabases).values({
      ...parsed.data,
      id,
      organizationId: scope.org.id,
      createdByUserId: scope.userId,
      status: "provisioning",
      containerName,
      databaseName,
      username,
      ...resources,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      return c.json({ error: "Database name already exists" }, 409);
    throw error;
  }
  try {
    await postgresRuntime.provision({
      containerName,
      databaseName,
      username,
      password: generatedPassword,
      version: parsed.data.version,
      plan: parsed.data.plan,
    });
    const status = await postgresRuntime.status(containerName);
    await db.update(managedDatabases).set({ status }).where(eq(managedDatabases.id, id));
    return c.json(
      {
        id,
        status,
        connection: {
          host: containerName,
          port: 5432,
          database: databaseName,
          username,
          password: generatedPassword,
          url: `postgresql://${username}:${generatedPassword}@${containerName}:5432/${databaseName}`,
        },
      },
      201,
    );
  } catch (error) {
    await db.update(managedDatabases).set({ status: "failed" }).where(eq(managedDatabases.id, id));
    c.get("logger").error({ error, databaseId: id }, "PostgreSQL provisioning failed");
    return c.json({ error: "Database provisioning failed" }, 503);
  }
});
routes.get("/:orgSlug/databases/:databaseId", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Not found" }, 404);
  const database = await db.query.managedDatabases.findFirst({
    where: and(
      eq(managedDatabases.id, c.req.param("databaseId")),
      eq(managedDatabases.organizationId, scope.org.id),
    ),
  });
  if (!database) return c.json({ error: "Database not found" }, 404);
  return c.json({ ...database, status: await postgresRuntime.status(database.containerName) });
});
routes.patch("/:orgSlug/databases/:databaseId", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Not found" }, 404);
  const parsed = input.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid database configuration" }, 400);
  const current = await db.query.managedDatabases.findFirst({
    where: and(
      eq(managedDatabases.id, c.req.param("databaseId")),
      eq(managedDatabases.organizationId, scope.org.id),
    ),
  });
  if (!current) return c.json({ error: "Database not found" }, 404);
  if (parsed.data.engine && parsed.data.engine !== current.engine) {
    return c.json({ error: "Database engine cannot be changed" }, 400);
  }
  const plan = parsed.data.plan ?? current.plan;
  if (plan !== current.plan) await postgresRuntime.updatePlan(current.containerName, plan);
  const result = await db
    .update(managedDatabases)
    .set({ ...parsed.data, ...(plan !== current.plan ? databasePlans[plan] : {}) })
    .where(
      and(
        eq(managedDatabases.id, c.req.param("databaseId")),
        eq(managedDatabases.organizationId, scope.org.id),
      ),
    )
    .returning();
  if (!result[0]) return c.json({ error: "Database not found" }, 404);
  return c.json(result[0]);
});
routes.delete("/:orgSlug/databases/:databaseId", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Not found" }, 404);
  const database = await db.query.managedDatabases.findFirst({
    where: and(
      eq(managedDatabases.id, c.req.param("databaseId")),
      eq(managedDatabases.organizationId, scope.org.id),
    ),
  });
  if (!database) return c.json({ error: "Database not found" }, 404);
  try {
    await postgresRuntime.remove(database.containerName);
  } catch (error) {
    c.get("logger").error({ error, databaseId: database.id }, "PostgreSQL removal failed");
    return c.json({ error: "Database removal failed" }, 503);
  }
  await db.delete(managedDatabases).where(eq(managedDatabases.id, database.id));
  return c.body(null, 204);
});
routes.get("/:orgSlug/resources", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Not found" }, 404);
  const databases = await db
    .select({
      cpuMillicores: managedDatabases.cpuMillicores,
      memoryMib: managedDatabases.memoryMib,
      storageGib: managedDatabases.storageGib,
    })
    .from(managedDatabases)
    .where(eq(managedDatabases.organizationId, scope.org.id));
  const allocated = databases.reduce(
    (total, item) => ({
      cpuMillicores: total.cpuMillicores + item.cpuMillicores,
      memoryMib: total.memoryMib + item.memoryMib,
      storageGib: total.storageGib + item.storageGib,
    }),
    { cpuMillicores: 0, memoryMib: 0, storageGib: 0 },
  );
  return c.json({ allocated, databases: databases.length });
});

export { routes as managedDatabaseRoutes };
