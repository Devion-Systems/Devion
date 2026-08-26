import { db, member, organization } from "@repo/db";
import { and, eq } from "drizzle-orm";
import { auth } from "../features/auth/config.js";

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
