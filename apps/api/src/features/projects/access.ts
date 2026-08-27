import { db, member, organization, projectTeams, projects, teamMember } from "@repo/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { auth } from "../auth/config.js";
import { resolveRolePermissions, type Permission } from "../organizations/permissions.js";

export type ProjectAccess = {
  organization: typeof organization.$inferSelect;
  project: typeof projects.$inferSelect;
  userId: string;
  role: string;
  permissions: Permission[];
};

export async function resolveProjectAccess(
  request: Request,
  orgSlug: string,
  projectId: string,
  permission: Permission = "projects.read",
): Promise<ProjectAccess | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, orgSlug) });
  if (!org) return null;
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, org.id), eq(member.userId, session.user.id)),
  });
  if (!membership) return null;
  const permissions = await resolveRolePermissions(membership.role, org.id);
  if (!permissions.includes(permission)) return null;
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.organizationId, org.id)),
  });
  if (!project) return null;
  if (project.accessMode === "team" && membership.role !== "owner" && membership.role !== "admin") {
    const teamAccess = await db
      .select({ projectId: projectTeams.projectId })
      .from(projectTeams)
      .innerJoin(teamMember, eq(projectTeams.teamId, teamMember.teamId))
      .where(and(eq(projectTeams.projectId, project.id), eq(teamMember.userId, session.user.id)))
      .limit(1);
    if (!teamAccess[0]) return null;
  }
  return { organization: org, project, userId: session.user.id, role: membership.role, permissions };
}

/** Filter Project lists through the same policy used by detail endpoints. */
export async function listAccessibleProjects(
  request: Request,
  orgSlug: string,
  permission: Permission = "projects.read",
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, orgSlug) });
  if (!org) return null;
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, org.id), eq(member.userId, session.user.id)),
  });
  if (!membership) return null;
  const permissions = await resolveRolePermissions(membership.role, org.id);
  if (!permissions.includes(permission)) return null;
  if (membership.role === "owner" || membership.role === "admin") {
    const allProjects = await db.query.projects.findMany({ where: eq(projects.organizationId, org.id) });
    return { organization: org, userId: session.user.id, permissions, projects: allProjects };
  }
  const memberships = await db
    .select({ teamId: teamMember.teamId })
    .from(teamMember)
    .where(eq(teamMember.userId, session.user.id));
  const teamIds = new Set(memberships.map(({ teamId }) => teamId));
  const assignedProjectIds = teamIds.size
    ? (await db.select({ projectId: projectTeams.projectId }).from(projectTeams).where(inArray(projectTeams.teamId, [...teamIds]))).map((item) => item.projectId)
    : [];
  const visibleProjects = await db.query.projects.findMany({
    where: and(
      eq(projects.organizationId, org.id),
      assignedProjectIds.length
        ? or(eq(projects.accessMode, "organization"), inArray(projects.id, assignedProjectIds))
        : eq(projects.accessMode, "organization"),
    ),
  });
  return {
    organization: org,
    userId: session.user.id,
    permissions,
    projects: visibleProjects,
  };
}
