import { defineConfig } from 'drizzle-kit'
import { serverEnv } from "@repo/core"

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: serverEnv.DATABASE_URL!,
  }
});