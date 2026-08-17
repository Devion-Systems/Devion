import { z } from "zod";
import { AppError, ErrorCode } from "../error/app-errors.js";

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
  // SMTP / Email-Service (optional – wird per Feature-Flag gesteuert)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_SECURE: z.string().transform((v) => v === "true").default(false),
});

export type CoreEnv = z.infer<typeof coreEnvSchema>;

export function parseEnv<T extends z.ZodRawShape>(
  extendedSchema?: z.ZodObject<T>
): z.infer<z.ZodObject<T>> & CoreEnv {
  const schema = extendedSchema ? coreEnvSchema.merge(extendedSchema) : coreEnvSchema;
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const formatted = JSON.stringify(result.error.format(), null, 2);
    throw new AppError(
      `Environment validation failed:\n${formatted}`,
      ErrorCode.VALIDATION_ERROR,
      500
    );
  }

  return result.data as any;
}