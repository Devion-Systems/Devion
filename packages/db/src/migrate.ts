import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDbPool, db } from "./database/db.js";

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    const pg = error as Error & { code?: string; detail?: string; hint?: string; position?: string; cause?: unknown };
    return { name: pg.name, message: pg.message, code: pg.code, detail: pg.detail, hint: pg.hint, position: pg.position, cause: pg.cause instanceof Error ? pg.cause.message : pg.cause };
  }
  return { error };
}

try {
  console.info("Applying Devion database migrations …");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.info("Devion database migrations completed.");
} catch (error) {
  // drizzle-kit occasionally hides the PostgreSQL error behind exit code 1.
  // Keep this structured and secret-free so operators can remediate safely.
  console.error("Devion database migration failed:", JSON.stringify(errorDetails(error)));
  process.exitCode = 1;
} finally {
  await closeDbPool();
}
