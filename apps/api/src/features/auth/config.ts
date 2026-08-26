import { parseEnv } from "@repo/core";
import { authSchema, db } from "@repo/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { passkey } from "@better-auth/passkey";
import { apiKey } from "@better-auth/api-key";
import {
  admin,
  bearer,
  deviceAuthorization,
  emailOTP,
  genericOAuth,
  haveIBeenPwned,
  multiSession,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { sendEmail } from "../email/index.js";

const env = parseEnv();
const emailVerificationEnabled = Boolean(env.SMTP_HOST && env.SMTP_FROM);
const cookieDomain = env.BETTER_AUTH_COOKIE_DOMAIN?.trim();
const useSecureCookies = new URL(env.BETTER_AUTH_URL).protocol === "https:";
const passkeyOrigin = env.DASHBOARD_URL ?? env.BETTER_AUTH_URL;
const passkeyRpId = new URL(passkeyOrigin).hostname;
const dashboardUrl = env.DASHBOARD_URL ?? env.BETTER_AUTH_URL;
const oidcValues = [env.OIDC_ISSUER, env.OIDC_CLIENT_ID, env.OIDC_CLIENT_SECRET];
if (oidcValues.some(Boolean) && !oidcValues.every(Boolean)) {
  throw new Error("OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET must be set together");
}
const allowedOidcEmailDomains = new Set(
  (env.OIDC_ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean),
);
const oidcConfiguration =
  env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET
    ? [
        {
          providerId: env.OIDC_PROVIDER_ID,
          name: env.OIDC_PROVIDER_NAME,
          clientId: env.OIDC_CLIENT_ID,
          clientSecret: env.OIDC_CLIENT_SECRET,
          discoveryUrl: new URL(
            ".well-known/openid-configuration",
            `${env.OIDC_ISSUER.replace(/\/$/, "")}/`,
          ).toString(),
          requireIdTokenVerification: true,
          scopes: ["openid", "email", "profile"],
          pkce: true,
          disableSignUp: !env.OIDC_ALLOW_SIGN_UP,
          ...(env.OIDC_PROMPT ? { prompt: env.OIDC_PROMPT } : {}),
        },
      ]
    : [];
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
// The passkey plugin exposes WebAuthn types from a peer package. Keep the
// public auth instance boundary stable instead of leaking Bun's package-cache
// paths into generated declarations.
export const auth: any = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  appName: "Devion",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  user: {
    validateUserInfo: ({ user, source }) => {
      if (source.oauth?.providerId !== env.OIDC_PROVIDER_ID || allowedOidcEmailDomains.size === 0) {
        return;
      }
      const domain = user.email?.split("@").at(-1)?.toLowerCase();
      if (!domain || !allowedOidcEmailDomains.has(domain)) {
        return {
          error: "email_not_allowed",
          errorDescription: "This email domain is not allowed for company SSO.",
        };
      }
    },
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
    apiKey({
      enableSessionForAPIKeys: true,
      defaultPrefix: "devion_",
      requireName: true,
      rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 1_200 },
    }),
    // Device codes are only issued to the bundled CLI. The completed flow
    // returns a signed session token which bearer() accepts on API requests.
    deviceAuthorization({
      verificationUri: new URL("/device", dashboardUrl).toString(),
      expiresIn: "10m",
      interval: "5s",
      userCodeLength: 8,
      validateClient: (clientId) => clientId === "devion-cli",
    }),
    bearer({ requireSignature: true }),
    haveIBeenPwned({
      enabled: env.HIBP_ENABLED,
      customPasswordCompromisedMessage:
        "Dieses Passwort ist aus bekannten Datenlecks bekannt. Bitte verwende ein anderes, einzigartiges Passwort.",
    }),
    // Keep up to five account sessions available in one browser so users can
    // switch workspaces without repeatedly signing out and back in.
    multiSession({ maximumSessions: 5 }),
    genericOAuth({ config: oidcConfiguration }),
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
