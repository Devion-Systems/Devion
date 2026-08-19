import { parseEnv } from "@repo/core";
import { authSchema, db } from "@repo/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { admin, organization, twoFactor } from "better-auth/plugins";
import { sendEmail } from "../email/index.js";

const env = parseEnv();
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
 * Central Better Auth server instance. It intentionally consumes only API-local
 * features (email and feature flags) and the standalone @repo/db package.
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
    sendOnSignUp: true,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignInAfterVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendRequiredAuthEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Reset your password by opening this link: ${url}`,
      });
    },
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
  },
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  plugins: [
    twoFactor(),
    admin(),
    organization({
      creatorRole: "owner",
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
