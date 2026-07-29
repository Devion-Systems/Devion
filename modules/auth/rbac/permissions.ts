import type { Brand } from "@devion/core";

export type Role = "owner" | "admin" | "member" | "viewer" | "agent";

export const Permissions = {
  // System / Tenant
  TENANT_MANAGE: "tenant:manage",
  TENANT_READ: "tenant:read",
  // Users & Org
  USER_INVITE: "user:invite",
  USER_MANAGE_ROLES: "user:manage_roles",
  // Secrets & System Config
  SECRETS_READ: "secrets:read",
  SECRETS_WRITE: "secrets:write",
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const RolePermissions: Record<Role, Permission[]> = {
  owner: Object.values(Permissions),
  admin: [
    Permissions.TENANT_READ,
    Permissions.USER_INVITE,
    Permissions.USER_MANAGE_ROLES,
    Permissions.SECRETS_READ,
  ],
  member: [Permissions.TENANT_READ],
  viewer: [Permissions.TENANT_READ],
  agent: [Permissions.TENANT_READ, Permissions.SECRETS_READ],
};

export function hasPermission(role: Role, requiredPermission: Permission): boolean {
  return RolePermissions[role]?.includes(requiredPermission) ?? false;
}