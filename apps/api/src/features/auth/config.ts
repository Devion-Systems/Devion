import { parseEnv } from "@repo/core";
import { authSchema, db } from "@repo/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { passkey } from "@better-auth/passkey";
import { admin, emailOTP, organization, twoFactor } from "better-auth/plugins";
import { sendEmail } from "../email/index.js";

const env = parseEnv();
const emailVerificationEnabled = Boolean(env.SMTP_HOST && env.SMTP_FROM);
const cookieDomain = env.BETTER_AUTH_COOKIE_DOMAIN?.trim();
const useSecureCookies = new URL(env.BETTER_AUTH_URL).protocol === "https:";
const passkeyOrigin = env.DASHBOARD_URL ?? env.BETTER_AUTH_URL;
const passkeyRpId = new URL(passkeyOrigin).hostname;
const trustedOrigins = [
  env.BETTER_AUTH_URL,
  ...(env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
];

async function sendRequiredAuthEmail(options: { to: string; subject: string; text: string }) {
  const result = await sendEmail(options);
  if (!result.success) {
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: result.error ?? "Authentication email could not be delivered",
    });
  }
}

/**
 * Central Better Auth server instance. It intentionally consumes only the
 * API-local email service and the standalone @repo/db package.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  appName: "Devion",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  user: {
    changeEmail: { enabled: true },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await sendRequiredAuthEmail({
          to: user.email,
          subject: "Confirm account deletion",
          text: `Confirm account deletion by opening this link: ${url}`,
        });
      },
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendRequiredAuthEmail({
        to: user.email,
        subject: "Verify your email address",
        text: `Verify your email address by opening this link: ${url}`,
      });
    },
    sendOnSignUp: emailVerificationEnabled,
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    requireEmailVerification: emailVerificationEnabled,
    autoSignInAfterVerification: true,
    onExistingUserSignUp: async ({ user }) => {
      await sendRequiredAuthEmail({
        to: user.email,
        subject: "Sign-up attempt with your email",
        text: "Someone tried to create an account using your email address. If this was you, try signing in instead. If not, you can safely ignore this email.",
      });
    },
  },
  rateLimit: { enabled: true, window: 10, max: 100 },
  advanced: {
    ipAddress: { ipAddressHeaders: ["x-real-ip"], ipv6Subnet: 56 },
    // A fresh installation is accessed by the host IP over HTTP. Secure
    // cookies are enabled automatically once the configured public URL uses
    // HTTPS, preserving the normal production posture for custom domains.
    useSecureCookies,
    ...(cookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: cookieDomain,
          },
        }
      : {}),
  },
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  plugins: [
    passkey({
      rpID: passkeyRpId,
      rpName: "Devion",
      origin: passkeyOrigin,
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
    }),
    emailOTP({
      otpLength: 8,
      expiresIn: 10 * 60,
      allowedAttempts: 3,
      storeOTP: "hashed",
      disableSignUp: true,
      rateLimit: { window: 60, max: 3 },
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "forget-password") return;

        await sendRequiredAuthEmail({
          to: email,
          subject: "Dein Devion-Code zum Zurücksetzen des Passworts",
          text: `Dein Sicherheitscode lautet: ${otp}\n\nDer Code ist 10 Minuten gültig und kann höchstens dreimal geprüft werden. Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.`,
        });
      },
    }),
    twoFactor({
      issuer: "Devion",
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { amount: 10, length: 10 },
    }),
    admin(),
    organization({
      creatorRole: "owner",
      allowUserToCreateOrganization: async (candidate) =>
        (candidate as { role?: string }).role === "admin",
      teams: { enabled: true, maximumTeams: 50, allowRemovingAllTeams: false },
      invitationExpiresIn: 60 * 60 * 48,
      cancelPendingInvitationsOnReInvite: true,
      requireEmailVerificationOnInvitation: true,
      sendInvitationEmail: async ({ email, id, organization: invitedOrganization, role }) => {
        const dashboardUrl = env.DASHBOARD_URL ?? env.BETTER_AUTH_URL;
        await sendRequiredAuthEmail({
          to: email,
          subject: `Invitation to ${invitedOrganization.name}`,
          text: `You were invited as ${role} to ${invitedOrganization.name}. Open ${dashboardUrl}/join-organization?invitationId=${encodeURIComponent(id)} to accept the invitation.`,
        });
      },
    }),
  ],
});
