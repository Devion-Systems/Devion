import { db, managedDatabases, member, organization } from "@repo/db";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

const input = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{1,62}$/),
  engine: z.enum(["postgresql", "mysql", "redis"]),
  version: z.string().max(32),
  plan: z.enum(["starter", "standard", "performance"]).default("starter"),
  region: z.string().max(80).default("local"),
  maintenanceWindow: z.string().max(120).optional(),
});
const routes = new Hono<AppEnv>();
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
  return c.json(
    await db
      .select()
      .from(managedDatabases)
      .where(eq(managedDatabases.organizationId, scope.org.id))
      .orderBy(asc(managedDatabases.name)),
  );
});
routes.post("/:orgSlug/databases", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Not found" }, 404);
  const parsed = input.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid database configuration" }, 400);
  const id = crypto.randomUUID();
  try {
    await db.insert(managedDatabases).values({
      ...parsed.data,
      id,
      organizationId: scope.org.id,
      createdByUserId: scope.userId,
      status: "provisioning",
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      return c.json({ error: "Database name already exists" }, 409);
    throw error;
  }
  return c.json({ id }, 201);
});
routes.patch("/:orgSlug/databases/:databaseId", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug"));
  if (!scope) return c.json({ error: "Not found" }, 404);
  const parsed = input.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid database configuration" }, 400);
  const result = await db
    .update(managedDatabases)
    .set(parsed.data)
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

export { routes as managedDatabaseRoutes };
