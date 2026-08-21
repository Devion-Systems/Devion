import { db, member, organization, projects, team, teamMember, user } from "@repo/db";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../features/auth/config.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

const routes = new Hono<AppEnv>();
routes.use("/*", requireAuthenticatedUser);
const createInput = z.object({ name: z.string().trim().min(2).max(80) });
const memberInput = z.object({ userId: z.string().min(1) });

async function access(request: Request, slug: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (!org) return null;
  const membership = await db.query.member.findFirst({ where: and(eq(member.organizationId, org.id), eq(member.userId, session.user.id)) });
  return membership ? { org, role: membership.role, userId: session.user.id } : null;
}
function canManage(role: string) { return role === "owner" || role === "admin"; }
async function scopedTeam(orgId: string, teamId: string) { return db.query.team.findFirst({ where: and(eq(team.id, teamId), eq(team.organizationId, orgId)) }); }

routes.get("/:orgSlug/teams", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug")); if (!scope) return c.json({ error: "Not found" }, 404);
  const items = await db.select().from(team).where(eq(team.organizationId, scope.org.id)).orderBy(asc(team.name));
  return c.json(await Promise.all(items.map(async (item) => ({ ...item, memberCount: (await db.select({ id: teamMember.id }).from(teamMember).where(eq(teamMember.teamId, item.id))).length, projectCount: (await db.select({ id: projects.id }).from(projects).where(eq(projects.teamId, item.id))).length }))));
});
routes.post("/:orgSlug/teams", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug")); if (!scope) return c.json({ error: "Not found" }, 404); if (!canManage(scope.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const parsed = createInput.safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Invalid team name" }, 400);
  const id = crypto.randomUUID();
  await db.insert(team).values({ id, name: parsed.data.name, organizationId: scope.org.id, createdAt: new Date() });
  await db.insert(teamMember).values({ id: crypto.randomUUID(), teamId: id, userId: scope.userId, createdAt: new Date() });
  return c.json({ id, name: parsed.data.name }, 201);
});
routes.get("/:orgSlug/teams/:teamId", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug")); if (!scope) return c.json({ error: "Not found" }, 404);
  const item = await scopedTeam(scope.org.id, c.req.param("teamId")); if (!item) return c.json({ error: "Team not found" }, 404);
  const [members, assignedProjects] = await Promise.all([
    db.select({ id: teamMember.id, userId: user.id, name: user.name, email: user.email, image: user.image }).from(teamMember).innerJoin(user, eq(teamMember.userId, user.id)).where(eq(teamMember.teamId, item.id)).orderBy(asc(user.name)),
    db.select({ id: projects.id, name: projects.name, slug: projects.slug, status: projects.status }).from(projects).where(eq(projects.teamId, item.id)).orderBy(asc(projects.name)),
  ]);
  return c.json({ ...item, members, projects: assignedProjects });
});
routes.patch("/:orgSlug/teams/:teamId", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug")); if (!scope) return c.json({ error: "Not found" }, 404); if (!canManage(scope.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const parsed = createInput.partial().safeParse(await c.req.json()); if (!parsed.success || !parsed.data.name) return c.json({ error: "Invalid team name" }, 400);
  const result = await db.update(team).set({ name: parsed.data.name }).where(and(eq(team.id, c.req.param("teamId")), eq(team.organizationId, scope.org.id))).returning();
  return result[0] ? c.json(result[0]) : c.json({ error: "Team not found" }, 404);
});
routes.delete("/:orgSlug/teams/:teamId", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug")); if (!scope) return c.json({ error: "Not found" }, 404); if (!canManage(scope.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const result = await db.delete(team).where(and(eq(team.id, c.req.param("teamId")), eq(team.organizationId, scope.org.id))).returning({ id: team.id });
  return result[0] ? c.body(null, 204) : c.json({ error: "Team not found" }, 404);
});
routes.post("/:orgSlug/teams/:teamId/members", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug")); if (!scope) return c.json({ error: "Not found" }, 404); if (!canManage(scope.role)) return c.json({ error: "Owner or admin role required" }, 403);
  const parsed = memberInput.safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Invalid member" }, 400);
  if (!(await scopedTeam(scope.org.id, c.req.param("teamId")))) return c.json({ error: "Team not found" }, 404);
  const orgMember = await db.query.member.findFirst({ where: and(eq(member.organizationId, scope.org.id), eq(member.userId, parsed.data.userId)) }); if (!orgMember) return c.json({ error: "User is not an organization member" }, 400);
  try { await db.insert(teamMember).values({ id: crypto.randomUUID(), teamId: c.req.param("teamId"), userId: parsed.data.userId, createdAt: new Date() }); } catch (error) { if ((error as { code?: string }).code === "23505") return c.json({ error: "User is already in this team" }, 409); throw error; }
  return c.body(null, 201);
});
routes.delete("/:orgSlug/teams/:teamId/members/:userId", async (c) => {
  const scope = await access(c.req.raw, c.req.param("orgSlug")); if (!scope) return c.json({ error: "Not found" }, 404); if (!canManage(scope.role)) return c.json({ error: "Owner or admin role required" }, 403);
  if (!(await scopedTeam(scope.org.id, c.req.param("teamId")))) return c.json({ error: "Team not found" }, 404);
  await db.delete(teamMember).where(and(eq(teamMember.teamId, c.req.param("teamId")), eq(teamMember.userId, c.req.param("userId")))); return c.body(null, 204);
});
export { routes as teamRoutes };
