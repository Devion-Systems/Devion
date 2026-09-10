import { db, projects, projectTeams, teamMember } from "@repo/db";
import { and, asc, count, desc, eq, exists, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

export const projectListQuery = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["active", "archived"]).optional(),
  search: z.string().trim().max(200).optional(),
  teamId: z.string().min(1).max(128).optional(),
  sort: z.enum(["name", "created", "updated"]).default("updated"),
});

/** Caller must resolve membership and projects.read before using this query. */
export async function listProjectPage(
  organizationId: string, userId: string, role: string,
  query: z.infer<typeof projectListQuery>,
) {
  const teamAccess = db.select({ one: sql`1` }).from(projectTeams)
    .innerJoin(teamMember, eq(projectTeams.teamId, teamMember.teamId))
    .where(and(eq(projectTeams.projectId, projects.id), eq(teamMember.userId, userId)));
  const assigned = db.select({ one: sql`1` }).from(projectTeams)
    .where(and(eq(projectTeams.projectId, projects.id), eq(projectTeams.teamId, query.teamId ?? "")));
  // Escape LIKE wildcards: search retains the previous literal substring semantics.
  const search = `%${(query.search ?? "").replace(/[\\%_]/g, "\\$&")}%`;
  const where = and(
    eq(projects.organizationId, organizationId),
    role === "owner" || role === "admin" ? undefined : or(eq(projects.accessMode, "organization"), exists(teamAccess)),
    query.status ? eq(projects.status, query.status) : undefined,
    query.teamId ? exists(assigned) : undefined,
    query.search ? or(ilike(projects.name, search), ilike(projects.slug, search), ilike(projects.description, search)) : undefined,
  );
  const order = query.sort === "name" ? asc(projects.name) : query.sort === "created" ? desc(projects.createdAt) : desc(projects.updatedAt);
  const [items, totals] = await Promise.all([
    db.select().from(projects).where(where).orderBy(order, asc(projects.id)).limit(query.limit).offset((query.page - 1) * query.limit),
    db.select({ total: count() }).from(projects).where(where),
  ]);
  return { items, total: totals[0]?.total ?? 0 };
}
