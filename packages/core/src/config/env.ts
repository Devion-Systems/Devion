import { z } from "zod";
import { AppError, ErrorCode } from "../error/app-errors.js";

const optionalNonEmpty = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const coreEnvSchema = z.object({
  API_PORT: z.coerce.number().default(3000),
  BUILDER_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  APP_NAME: z.string().default("Devion"),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_ACCESS_KEY: z.string().default("onprem_access_key"),
  S3_SECRET_KEY: z.string().default("onprem_secret_key_must_be_long"),
  S3_REGION: z.string().default("auto"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET muss mindestens 32 Zeichen lang sein"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL muss eine gültige URL sein"),
  DASHBOARD_URL: z.string().url().optional(),
  // Compose supplies empty values for optional SSO settings. Normalize these
  // to undefined so an unconfigured Generic OAuth provider cannot block boot.
  OIDC_ISSUER: optionalNonEmpty.pipe(z.string().url().optional()),
  OIDC_CLIENT_ID: optionalNonEmpty.pipe(z.string().min(1).optional()),
  OIDC_CLIENT_SECRET: optionalNonEmpty.pipe(z.string().min(1).optional()),
  OIDC_PROVIDER_ID: optionalNonEmpty
    .pipe(
      z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(64)
        .optional(),
    )
    .default("oidc"),
  OIDC_PROVIDER_NAME: optionalNonEmpty.pipe(z.string().max(100).optional()).default("Company SSO"),
  OIDC_ALLOWED_EMAIL_DOMAINS: optionalNonEmpty,
  OIDC_ALLOW_SIGN_UP: z
    .string()
    .transform((value) => value === "true")
    .default(false),
  OIDC_PROMPT: optionalNonEmpty.pipe(z.enum(["login", "consent", "select_account"]).optional()),
  // Enabled by default: only a SHA-1 hash prefix is sent to the Pwned
  // Passwords range API, never a plaintext password.
  HIBP_ENABLED: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(true),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
  // Compose supplies an empty value when no shared cookie domain is needed
  // (the host-IP first-install case). Normalize it instead of rejecting boot.
  BETTER_AUTH_COOKIE_DOMAIN: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .optional(),
  // Strongly recommended for internet-facing first boot. The value is only
  // accepted by the one-shot installation endpoint and is never persisted.
  DEVION_SETUP_TOKEN: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .pipe(z.string().min(16).max(256).optional())
    .optional(),
  // SMTP / Email-Service (optional – Versand erfolgt bei SMTP-Konfiguration standardmäßig)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .transform((v) => v === "true")
    .default(false),
});

export type CoreEnv = z.infer<typeof coreEnvSchema>;

type EnvironmentSchema = {
  safeParse(
    input: unknown,
  ):
    | { success: true; data: Record<string, unknown> }
    | { success: false; error: { format(): unknown } };
};

type SchemaOutput<T> = T extends { _output: infer Output } ? Output : Record<string, never>;

export function parseEnv<T = Record<string, never>>(extendedSchema?: T): CoreEnv & SchemaOutput<T> {
  const coreResult = coreEnvSchema.safeParse(process.env);

  if (!coreResult.success) {
    const formatted = JSON.stringify(coreResult.error.format(), null, 2);
    throw new AppError(
      `Environment validation failed:\n${formatted}`,
      ErrorCode.VALIDATION_ERROR,
      500,
    );
  }

  if (!extendedSchema) {
    return coreResult.data as CoreEnv & SchemaOutput<T>;
  }

  // Extensions are intentionally validated separately. Feature packages can
  // use either Zod v3 or v4 without breaking the core environment schema.
  const extensionResult = (extendedSchema as unknown as EnvironmentSchema).safeParse(process.env);
  if (!extensionResult.success) {
    const formatted = JSON.stringify(extensionResult.error.format(), null, 2);
    throw new AppError(
      `Environment validation failed:\n${formatted}`,
      ErrorCode.VALIDATION_ERROR,
      500,
    );
  }

  return { ...coreResult.data, ...extensionResult.data } as CoreEnv & SchemaOutput<T>;
}
