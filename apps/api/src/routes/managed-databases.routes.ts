import { db, managedDatabases, member, organization } from "@repo/db";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { databasePlans, postgresVersions, PostgresRuntime } from "../lib/hosting/postgres-runtime.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

const input = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{1,62}$/),
  engine: z.literal("postgresql"),
  version: z.enum(postgresVersions),
  plan: z.enum(["starter", "standard", "performance"]).default("starter"),
  databaseName: z.string().trim().regex(/^[a-z][a-z0-9_]{0,62}$/).optional(),
  username: z.string().trim().regex(/^[a-z][a-z0-9_]{0,62}$/).optional(),
  password: z.string().min(12).max(128).optional(),
  region: z.string().max(80).default("local"),
  maintenanceWindow: z.string().max(120).optional(),
});
const updateInput = input.pick({ name: true, engine: true, version: true, plan: true, region: true, maintenanceWindow: true });
const routes = new Hono<AppEnv>();
const postgresRuntime = new PostgresRuntime();
routes.use("/*", requireAuthenticatedUser);
const deleteInput = z.object({ confirmationName: z.string().trim().min(1).max(63) });
const tableInput = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) });

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function canManageDatabases(role: string) {
  return role === "owner" || role === "admin";
}

async function access(request: Request, slug: string) {
  const current = await auth.api.getSession({ headers: request.headers });
  if (!current) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (!org) return null;
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, org.id), eq(member.userId, current.user.id)),
  });
  return membership ? { org, userId: current.user.id, role: membership.role } : null;
}

async function databaseInScope(orgId: string, databaseId: string) {
  return db.query.managedDatabases.findFirst({
    where: and(eq(managedDatabases.id, databaseId), eq(managedDatabases.organizationId, orgId)),
  });
}

async function requireReadyDatabase(orgId: string, databaseId: string) {
  const database = await databaseInScope(orgId, databaseId);
  if (!database) return { error: "Database not found" as const };
  if ((await postgresRuntime.status(database.containerName)) !== "ready") {
    return { error: "Database is not ready" as const };
  }
  return { database };
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
  const databaseName = parsed.data.databaseName ?? "app";
  const username = parsed.data.username ?? "devion";
  const password = crypto.getRandomValues(new Uint8Array(24));
  const generatedPassword = parsed.data.password ?? Buffer.from(password).toString("base64url");
  const resources = databasePlans[parsed.data.plan];
  try {
    await db.insert(managedDatabases).values({
      name: parsed.data.name,
      engine: parsed.data.engine,
      version: parsed.data.version,
      plan: parsed.data.plan,
      region: parsed.data.region,
      maintenanceWindow: parsed.data.maintenanceWindow,
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
          url: `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(generatedPassword)}@${containerName}:5432/${encodeURIComponent(databaseName)}`,
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
  const database = await databaseInScope(scope.org.id, c.req.param("databaseId"));
  if (!database) return c.json({ error: "Database not found" }, 404);
  return c.json({ ...database, status: await postgresRuntime.status(database.containerName) });
});
routes.patch("/:orgSlug/databases/:databaseId", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Not found" }, 404);
  const parsed = updateInput.partial().safeParse(await c.req.json());
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
  if (!canManageDatabases(scope.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const confirmation = deleteInput.safeParse(await c.req.json());
  if (!confirmation.success) return c.json({ error: "Database name confirmation is required" }, 400);
  const database = await databaseInScope(scope.org.id, c.req.param("databaseId"));
  if (!database) return c.json({ error: "Database not found" }, 404);
  if (confirmation.data.confirmationName !== database.name) {
    return c.json({ error: "Database name confirmation does not match" }, 400);
  }
  try {
    await postgresRuntime.remove(database.containerName);
  } catch (error) {
    c.get("logger").error({ error, databaseId: database.id }, "PostgreSQL removal failed");
    return c.json({ error: "Database removal failed" }, 503);
  }
  await db.delete(managedDatabases).where(eq(managedDatabases.id, database.id));
  return c.body(null, 204);
});
routes.get("/:orgSlug/databases/:databaseId/console/tables", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Not found" }, 404);
  const result = await requireReadyDatabase(scope.org.id, c.req.param("databaseId"));
  if ("error" in result) return c.json({ error: result.error }, result.error === "Database not found" ? 404 : 409);
  try {
    const output = await postgresRuntime.query(
      result.database.containerName,
      result.database.databaseName,
      result.database.username,
      "SELECT table_schema || E'\\t' || table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name",
    );
    const tables = output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [schema, name] = line.split("\t");
        return { schema, name };
      });
    return c.json({ tables });
  } catch (error) {
    c.get("logger").error({ error, databaseId: result.database.id }, "Database console table list failed");
    return c.json({ error: "Unable to inspect database tables" }, 503);
  }
});
routes.get("/:orgSlug/databases/:databaseId/console/tables/:schema/:tableName", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Not found" }, 404);
  const parsed = tableInput.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: "Invalid row limit" }, 400);
  const result = await requireReadyDatabase(scope.org.id, c.req.param("databaseId"));
  if ("error" in result) return c.json({ error: result.error }, result.error === "Database not found" ? 404 : 409);
  const schema = c.req.param("schema");
  const tableName = c.req.param("tableName");
  try {
    const existsOutput = await postgresRuntime.query(
      result.database.containerName,
      result.database.databaseName,
      result.database.username,
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema = ${quoteLiteral(schema)} AND table_name = ${quoteLiteral(tableName)})`,
    );
    if (existsOutput.trim() !== "t") return c.json({ error: "Table not found" }, 404);
    const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
    const columnsOutput = await postgresRuntime.query(
      result.database.containerName,
      result.database.databaseName,
      result.database.username,
      `SELECT column_name FROM information_schema.columns WHERE table_schema = ${quoteLiteral(schema)} AND table_name = ${quoteLiteral(tableName)} ORDER BY ordinal_position`,
    );
    const rowsOutput = await postgresRuntime.query(
      result.database.containerName,
      result.database.databaseName,
      result.database.username,
      `SELECT COALESCE(json_agg(row_data), '[]'::json)::text FROM (SELECT to_jsonb(item) AS row_data FROM ${qualifiedTable} AS item LIMIT ${parsed.data.limit}) AS rows`,
    );
    return c.json({
      schema,
      table: tableName,
      columns: columnsOutput.trim().split("\n").filter(Boolean),
      rows: JSON.parse(rowsOutput.trim() || "[]"),
      limit: parsed.data.limit,
    });
  } catch (error) {
    c.get("logger").error({ error, databaseId: result.database.id, schema, tableName }, "Database console query failed");
    return c.json({ error: "Unable to inspect database table" }, 503);
  }
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
