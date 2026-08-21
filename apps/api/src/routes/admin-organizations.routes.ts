import { db, member, organization, projects, team } from "@repo/db";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requirePlatformAdmin } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";
const routes = new Hono<AppEnv>(); routes.use("/*", requirePlatformAdmin);
const input = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64) });
async function summary(item: typeof organization.$inferSelect) { const [members, teams, projectItems] = await Promise.all([db.select({ id: member.id }).from(member).where(eq(member.organizationId, item.id)), db.select({ id: team.id }).from(team).where(eq(team.organizationId, item.id)), db.select({ id: projects.id }).from(projects).where(eq(projects.organizationId, item.id))]); return { ...item, memberCount: members.length, teamCount: teams.length, projectCount: projectItems.length }; }
routes.get("/", async (c) => c.json(await Promise.all((await db.select().from(organization).orderBy(asc(organization.name))).map(summary))));
routes.get("/:organizationId", async (c) => { const item = await db.query.organization.findFirst({ where: eq(organization.id, c.req.param("organizationId")) }); return item ? c.json(await summary(item)) : c.json({ error: "Organization not found" }, 404); });
routes.patch("/:organizationId", async (c) => { const parsed = input.safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Invalid organization data" }, 400); try { const result = await db.update(organization).set(parsed.data).where(eq(organization.id, c.req.param("organizationId"))).returning(); return result[0] ? c.json(await summary(result[0])) : c.json({ error: "Organization not found" }, 404); } catch (error) { if ((error as { code?: string }).code === "23505") return c.json({ error: "Organization slug already exists" }, 409); throw error; } });
routes.delete("/:organizationId", async (c) => { const result = await db.delete(organization).where(eq(organization.id, c.req.param("organizationId"))).returning({ id: organization.id }); return result[0] ? c.body(null, 204) : c.json({ error: "Organization not found" }, 404); });
export { routes as adminOrganizationRoutes };
