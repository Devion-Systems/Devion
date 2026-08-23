import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { parseEnv } from "@repo/core";
import { db, organization, systemInstallation, user } from "@repo/db";
import { eq, sql } from "drizzle-orm";
import { auth } from "../auth/config.js";

export type LdapSetup = {
  url: string;
  baseDn: string;
  bindDn?: string;
  bindPassword?: string;
  userSearchFilter: string;
  groupSearchBase?: string;
  startTls: boolean;
};

export async function getInstallation() {
  return db.query.systemInstallation.findFirst({ where: eq(systemInstallation.id, 1) });
}

function encryptJson(value: unknown) {
  const key = createHash("sha256").update(parseEnv().BETTER_AUTH_SECRET).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export async function installSystem(input: {
  companyName: string;
  organizationSlug: string;
  administrator: { name: string; email: string; password: string };
  primaryDomain?: string;
  ldap?: LdapSetup;
}) {
  const outcome = await db.transaction(async (tx) => {
    // One lock shared by all API replicas. It is released on commit/rollback.
    await tx.execute(sql`select pg_advisory_xact_lock(445846221)`);
    const existing = await tx.query.systemInstallation.findFirst({
      where: eq(systemInstallation.id, 1),
    });
    if (existing) throw new Error("INSTALLATION_ALREADY_COMPLETED");

    const signedUp = await auth.api.signUpEmail({
      body: {
        name: input.administrator.name,
        email: input.administrator.email,
        password: input.administrator.password,
      },
    });
    const administratorId = signedUp.user.id;

    let createdOrganizationId: string | null = null;
    try {
      // This update must be visible to Better Auth's separate organization call.
      await db
        .update(user)
        .set({ role: "admin", emailVerified: true })
        .where(eq(user.id, administratorId));

      const createdOrganization = await auth.api.createOrganization({
        body: {
          name: input.companyName,
          slug: input.organizationSlug,
          userId: administratorId,
          keepCurrentActiveOrganization: false,
        },
      });
      createdOrganizationId = createdOrganization.id;

      // A nested transaction creates a savepoint. If this final write fails,
      // the outer transaction remains usable for committed compensation.
      await tx.transaction(async (setupTx) => {
        await setupTx.insert(systemInstallation).values({
          id: 1,
          organizationId: createdOrganization.id,
          administratorId,
          companyName: input.companyName,
          primaryDomain: input.primaryDomain,
          ldapEnabled: Boolean(input.ldap),
          ldapConfigEncrypted: input.ldap ? encryptJson(input.ldap) : null,
          settings: { onboardingVersion: 1 },
        });
      });
      return {
        ok: true as const,
        result: {
          organizationSlug: createdOrganization.slug,
          administratorEmail: input.administrator.email,
        },
      };
    } catch (error) {
      // Better Auth calls use their own transaction. Avoid leaving a usable
      // bootstrap account behind if organization/setup persistence fails.
      if (createdOrganizationId) {
        await tx.delete(organization).where(eq(organization.id, createdOrganizationId));
      }
      await tx.delete(user).where(eq(user.id, administratorId));
      return { ok: false as const, error };
    }
  });

  if (!outcome.ok) throw outcome.error;
  return outcome.result;
}
