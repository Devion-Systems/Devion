import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/storage/database/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://devion:devion@localhost:5432/devion",
  },
});
