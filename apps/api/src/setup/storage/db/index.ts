import { db, checkDbHealth, closeDbPool } from "@repo/db";

// Health-Check ausführen
const health = await checkDbHealth();
console.log(`DB Status: ${health.status}, Latency: ${health.latencyMs}ms`);

// Drizzle ORM Query
const activeProjects = await db.query.projects.findMany();

// Clean Shutdown
process.on("SIGTERM", async () => {
  await closeDbPool();
});
