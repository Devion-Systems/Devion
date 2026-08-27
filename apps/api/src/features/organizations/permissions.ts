import { db, organizationRole, organizationRolePermission } from "@repo/db";
import { and, eq } from "drizzle-orm";

export const permissionRegistry = [
  ["organization.read", "Organisation", "Organisation lesen", "Organisation und Kontext anzeigen."],
  ["organization.update", "Organisation", "Organisation ändern", "Name und Einstellungen ändern."],
  ["organization.delete", "Organisation", "Organisation löschen", "Organisation dauerhaft löschen."],
  ["members.read", "Mitglieder", "Mitglieder lesen", "Mitglieder und Rollen anzeigen."],
  ["members.invite", "Mitglieder", "Mitglieder einladen", "Einladungen erstellen und widerrufen."],
  ["members.update", "Mitglieder", "Mitglieder ändern", "Rollen und Mitgliedschaften ändern."],
  ["members.remove", "Mitglieder", "Mitglieder entfernen", "Mitglieder aus der Organisation entfernen."],
  ["roles.read", "Rollen", "Rollen lesen", "Rollen und Rechte anzeigen."],
  ["roles.create", "Rollen", "Rollen erstellen", "Custom Roles erstellen."],
  ["roles.update", "Rollen", "Rollen ändern", "Custom Roles und Rechte ändern."],
  ["roles.delete", "Rollen", "Rollen löschen", "Unbenutzte Custom Roles löschen."],
  ["roles.assign", "Rollen", "Rollen zuweisen", "Rollen an Mitglieder zuweisen."],
  ["teams.read", "Teams", "Teams lesen", "Teams und Teammitglieder anzeigen."],
  ["teams.create", "Teams", "Teams erstellen", "Teams erstellen."],
  ["teams.update", "Teams", "Teams ändern", "Teams umbenennen und Mitglieder verwalten."],
  ["teams.delete", "Teams", "Teams löschen", "Teams löschen."],
  ["projects.read", "Projekte", "Projekte lesen", "Projekte und Ressourcen anzeigen."],
  ["projects.create", "Projekte", "Projekte erstellen", "Projekte erstellen."],
  ["projects.update", "Projekte", "Projekte ändern", "Projekte und Deployments verwalten."],
  ["projects.delete", "Projekte", "Projekte löschen", "Projekte löschen."],
  ["applications.read", "Anwendungen", "Anwendungen lesen", "Anwendungen und Laufzeit anzeigen."],
  ["applications.create", "Anwendungen", "Anwendungen erstellen", "Anwendungen in Projekten erstellen."],
  ["applications.update", "Anwendungen", "Anwendungen ändern", "Anwendungen bereitstellen und stoppen."],
  ["applications.delete", "Anwendungen", "Anwendungen löschen", "Anwendungen löschen."],
  ["builds.read", "Builds", "Builds lesen", "Builds und Logs anzeigen."],
  ["builds.create", "Builds", "Builds starten", "Builds und Deployments starten."],
  ["builds.cancel", "Builds", "Builds abbrechen", "Laufende Builds abbrechen."],
  ["nodes.read", "Hardware", "Hardware lesen", "Knoten anzeigen."],
  ["nodes.manage", "Hardware", "Hardware verwalten", "Knoten registrieren und verwalten."],
  ["audit.read", "Audit", "Audit lesen", "Audit-Protokoll anzeigen."],
] as const;

export type Permission = (typeof permissionRegistry)[number][0];
export const allPermissions = permissionRegistry.map(([key]) => key) as Permission[];

const systemPermissions: Record<string, readonly Permission[]> = {
  owner: allPermissions,
  admin: allPermissions.filter((permission) => !["organization.delete"].includes(permission)),
  developer: ["organization.read", "members.read", "roles.read", "teams.read", "projects.read", "projects.create", "projects.update", "applications.read", "applications.create", "applications.update", "builds.read", "builds.create", "builds.cancel"],
  member: ["organization.read", "members.read", "roles.read", "teams.read", "projects.read", "projects.create", "projects.update", "applications.read", "applications.create", "applications.update", "builds.read", "builds.create", "builds.cancel"],
  viewer: ["organization.read", "members.read", "roles.read", "teams.read", "projects.read", "applications.read", "builds.read", "nodes.read", "audit.read"],
};

export async function resolveRolePermissions(role: string, organizationId?: string): Promise<Permission[]> {
  if (role.startsWith("custom:")) {
    const roleId = role.slice("custom:".length);
    const permissions = await db
      .select({ permission: organizationRolePermission.permission })
      .from(organizationRolePermission)
      .innerJoin(organizationRole, eq(organizationRole.id, organizationRolePermission.roleId))
      .where(
        organizationId
          ? and(eq(organizationRole.id, roleId), eq(organizationRole.organizationId, organizationId))
          : eq(organizationRole.id, roleId),
      );
    return permissions.map((item) => item.permission).filter((item): item is Permission => allPermissions.includes(item as Permission));
  }
  return [...(systemPermissions[role] ?? [])];
}

export function isKnownPermission(value: string): value is Permission {
  return allPermissions.includes(value as Permission);
}
