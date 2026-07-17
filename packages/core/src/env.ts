import { z } from "zod";

const ServerEnvSchema = z.object({
  API_PORT: z.string().transform(Number).default(3000),
  BUILDER_PORT: z.string().transform(Number).default(3001),
  DATABASE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  APP_NAME: z.string().default("Devion"),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let _serverEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("❌ Server-Variablen dürfen nicht im Browser geladen werden!");
  }
  if (_serverEnv) return _serverEnv;

  const result = ServerEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid Server environment variables:", JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  _serverEnv = result.data;
  return _serverEnv;
}

export const serverEnv = getServerEnv();