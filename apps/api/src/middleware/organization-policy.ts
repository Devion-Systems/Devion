import { db, member, organization } from "@repo/db";
import { and, eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { auth } from "../features/auth/config.js";
import { resolveRolePermissions, type Permission } from "../features/organizations/permissions.js";
import type { AppEnv } from "../types/env.js";

export type OrganizationPermission = "read" | "manage";

/** Single source of truth for Devion organisation role permissions. */
export function hasOrganizationPermission(role: string, permission: OrganizationPermission) {
  if (permission === "read") return role === "owner" || role === "admin" || role === "member";
  return role === "owner" || role === "admin";
}

/** Resolves the caller and membership without ever trusting a client org id. */
export async function resolveOrganizationAccess(request: Request, slug: string) {
  const current = await auth.api.getSession({ headers: request.headers });
  if (!current) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (!org) return null;
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, org.id), eq(member.userId, current.user.id)),
  });
  return membership ? { org, membership, userId: current.user.id } : null;
}

export async function hasPermission(request: Request, slug: string, permission: Permission) {
  const access = await resolveOrganizationAccess(request, slug);
  if (!access) return null;
  const permissions = await resolveRolePermissions(access.membership.role, access.org.id);
  return { ...access, permissions, allowed: permissions.includes(permission) };
}

/** Rejects organization routes unless the caller belongs to the URL organization. */
export const requireOrganizationAccess: MiddlewareHandler<AppEnv> = async (c, next) => {
  const slug = c.req.param("orgSlug");
  const access = slug ? await resolveOrganizationAccess(c.req.raw, slug) : null;
  if (!access) return c.json({ error: "Organization not found or access denied" }, 404);

  await next();
};

/** Backend authorization boundary for every permission-protected route. */
export function requirePermission(permission: Permission): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const slug = c.req.param("orgSlug");
    const access = slug ? await hasPermission(c.req.raw, slug, permission) : null;
    if (!access) return c.json({ error: "Organization not found or access denied" }, 404);
    if (!access.allowed) return c.json({ error: `Permission required: ${permission}` }, 403);
    await next();
  };
}
