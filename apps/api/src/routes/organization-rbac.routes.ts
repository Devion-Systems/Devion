import { auditLogs, db, member, organizationRole, organizationRolePermission, team, teamMember, user } from "@repo/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { allPermissions, isKnownPermission, permissionRegistry } from "../features/organizations/permissions.js";
import { hasPermission, requirePermission } from "../middleware/organization-policy.js";
import type { AppEnv } from "../types/env.js";

const routes = new Hono<AppEnv>();
const roleInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  permissions: z.array(z.string()).max(allPermissions.length),
});

function audit(actorId: string, action: string, targetType: string, targetId: string, metadata?: object) {
  return db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId, action, targetType, targetId, metadata: metadata ? JSON.stringify(metadata) : null });
}

async function getRole(orgId: string, roleId: string) {
  return db.query.organizationRole.findFirst({ where: and(eq(organizationRole.id, roleId), eq(organizationRole.organizationId, orgId)) });
}

routes.get("/:orgSlug/permissions", requirePermission("roles.read"), (c) => c.json(permissionRegistry.map(([key, category, name, description]) => ({ key, category, name, description }))));

routes.get("/:orgSlug/roles", requirePermission("roles.read"), async (c) => {
  const scope = await hasPermission(c.req.raw, c.req.param("orgSlug"), "roles.read");
  if (!scope) return c.json({ error: "Organization not found" }, 404);
  const roles = await db.select().from(organizationRole).where(eq(organizationRole.organizationId, scope.org.id)).orderBy(asc(organizationRole.name));
  const permissions = roles.length ? await db.select().from(organizationRolePermission).where(inArray(organizationRolePermission.roleId, roles.map((role) => role.id))) : [];
  const used = await db.select({ role: member.role }).from(member).where(eq(member.organizationId, scope.org.id));
  return c.json({ effectivePermissions: scope.permissions, system: ["owner", "admin", "developer", "viewer"], custom: roles.map((role) => ({ ...role, permissions: permissions.filter((item) => item.roleId === role.id).map((item) => item.permission), memberCount: used.filter((item) => item.role === `custom:${role.id}`).length })) });
});

routes.post("/:orgSlug/roles", requirePermission("roles.create"), async (c) => {
  const scope = await hasPermission(c.req.raw, c.req.param("orgSlug"), "roles.create");
  const input = roleInput.safeParse(await c.req.json());
  if (!scope || !input.success) return c.json({ error: "Invalid role" }, 400);
  if (input.data.permissions.some((permission) => !isKnownPermission(permission))) return c.json({ error: "Unknown permission" }, 400);
  const duplicate = await db.query.organizationRole.findFirst({ where: and(eq(organizationRole.organizationId, scope.org.id), eq(organizationRole.name, input.data.name)) });
  if (duplicate) return c.json({ error: "A role with this name already exists" }, 409);
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(organizationRole).values({ id, organizationId: scope.org.id, name: input.data.name, description: input.data.description ?? null, createdBy: scope.userId });
    if (input.data.permissions.length) await tx.insert(organizationRolePermission).values(input.data.permissions.map((permission) => ({ roleId: id, permission })));
  });
  await audit(scope.userId, "role.created", "organization_role", id, { organizationId: scope.org.id });
  return c.json({ id }, 201);
});

routes.patch("/:orgSlug/roles/:roleId", requirePermission("roles.update"), async (c) => {
  const scope = await hasPermission(c.req.raw, c.req.param("orgSlug"), "roles.update");
  const input = roleInput.safeParse(await c.req.json());
  if (!scope || !input.success) return c.json({ error: "Invalid role" }, 400);
  if (input.data.permissions.some((permission) => !isKnownPermission(permission))) return c.json({ error: "Unknown permission" }, 400);
  const role = await getRole(scope.org.id, c.req.param("roleId"));
  if (!role || role.immutable) return c.json({ error: "Role not found or immutable" }, 404);
  await db.transaction(async (tx) => {
    await tx.update(organizationRole).set({ name: input.data.name, description: input.data.description ?? null, updatedAt: new Date() }).where(eq(organizationRole.id, role.id));
    await tx.delete(organizationRolePermission).where(eq(organizationRolePermission.roleId, role.id));
    if (input.data.permissions.length) await tx.insert(organizationRolePermission).values(input.data.permissions.map((permission) => ({ roleId: role.id, permission })));
  });
  await audit(scope.userId, "role.updated", "organization_role", role.id);
  return c.body(null, 204);
});

routes.delete("/:orgSlug/roles/:roleId", requirePermission("roles.delete"), async (c) => {
  const scope = await hasPermission(c.req.raw, c.req.param("orgSlug"), "roles.delete");
  if (!scope) return c.json({ error: "Organization not found" }, 404);
  const role = await getRole(scope.org.id, c.req.param("roleId"));
  if (!role || role.immutable) return c.json({ error: "Role not found or immutable" }, 404);
  const assignees = await db.select({ id: member.id }).from(member).where(and(eq(member.organizationId, scope.org.id), eq(member.role, `custom:${role.id}`)));
  if (assignees.length) return c.json({ error: "Role is still assigned to members" }, 409);
  await db.delete(organizationRole).where(eq(organizationRole.id, role.id));
  await audit(scope.userId, "role.deleted", "organization_role", role.id);
  return c.body(null, 204);
});

routes.get("/:orgSlug/members", requirePermission("members.read"), async (c) => {
  const scope = await hasPermission(c.req.raw, c.req.param("orgSlug"), "members.read");
  if (!scope) return c.json({ error: "Organization not found" }, 404);
  const members = await db.select({ id: member.id, userId: user.id, name: user.name, email: user.email, role: member.role, joinedAt: member.createdAt }).from(member).innerJoin(user, eq(member.userId, user.id)).where(eq(member.organizationId, scope.org.id)).orderBy(asc(user.name));
  const assignments = await db.select({ userId: teamMember.userId, teamId: team.id, teamName: team.name }).from(teamMember).innerJoin(team, eq(teamMember.teamId, team.id)).where(eq(team.organizationId, scope.org.id));
  return c.json(members.map((item) => ({ ...item, teams: assignments.filter((assignment) => assignment.userId === item.userId).map(({ teamId, teamName }) => ({ id: teamId, name: teamName })) })));
});

routes.patch("/:orgSlug/members/:memberId/role", requirePermission("roles.assign"), async (c) => {
  const scope = await hasPermission(c.req.raw, c.req.param("orgSlug"), "roles.assign");
  const input = z.object({ role: z.string().min(1) }).safeParse(await c.req.json());
  if (!scope || !input.success) return c.json({ error: "Invalid role" }, 400);
  const target = await db.query.member.findFirst({ where: and(eq(member.id, c.req.param("memberId")), eq(member.organizationId, scope.org.id)) });
  if (!target) return c.json({ error: "Member not found" }, 404);
  if (input.data.role.startsWith("custom:")) {
    const custom = await getRole(scope.org.id, input.data.role.slice(7));
    if (!custom) return c.json({ error: "Custom role not found" }, 400);
  } else if (!["owner", "admin", "developer", "viewer"].includes(input.data.role)) return c.json({ error: "Unknown system role" }, 400);
  const owners = await db.select({ id: member.id }).from(member).where(and(eq(member.organizationId, scope.org.id), eq(member.role, "owner")));
  if (target.role === "owner" && input.data.role !== "owner" && owners.length <= 1) return c.json({ error: "The last owner cannot be demoted" }, 409);
  if (input.data.role === "owner" && !scope.permissions.includes("organization.delete")) return c.json({ error: "Only an owner may grant owner access" }, 403);
  await db.update(member).set({ role: input.data.role }).where(eq(member.id, target.id));
  await audit(scope.userId, "member.role_changed", "member", target.id, { role: input.data.role });
  return c.body(null, 204);
});

export { routes as organizationRbacRoutes };
