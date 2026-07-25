import { Hono } from "hono";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { buildQueue, buildHistory, hostedApps, type BuildJob } from "./schema";
import { eq, sql } from "drizzle-orm";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { executeDevionAction } from "./workflow-runner";

const app = new Hono();
const db = drizzle(postgres(process.env.DATABASE_URL!, { max: 5 }));
const TMP_BASE = join(import.meta.dir, ".builder-tmp");

// Steuerungs-State für den Worker
let isWorkerRunning = false;

// --- WORKER LOGIK ---

async function runBuilder() {
  console.log("👷 Builder-Server aktiv. Warte auf Arbeit...");
  await mkdir(TMP_BASE, { recursive: true });
  isWorkerRunning = true;

  while (isWorkerRunning) {
    try {
      // Thread-sicher den nächsten Job reservieren (FOR UPDATE SKIP LOCKED)
      const job = await db.transaction(async (tx) => {
        const rows = await tx.execute<BuildJob>(sql`
          SELECT 
            id, image_name AS "imageName", source_type AS "sourceType",
            zip_base64 AS "zipBase64", git_url AS "gitUrl", workflow_yaml AS "workflowYaml"
          FROM build_queue
          WHERE status = 'PENDING'
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `);

        if (rows.length === 0) return null;
        const nextJob = rows[0];

        await tx.update(buildQueue)
          .set({ status: "PROCESSING" })
          .where(eq(buildQueue.id, nextJob.id));

        return nextJob;
      });

      if (!job) {
        await Bun.sleep(2000);
        continue;
      }

      console.log(`🔨 Builder verarbeitet Job ${job.id} ('${job.imageName}')`);
      await processBuild(job);

    } catch (err) {
      console.error("❌ Builder-Fehler:", err);
      await Bun.sleep(3000);
    }
  }
}

async function processBuild(job: BuildJob) {
  const startTime = Date.now();
  const workDir = join(TMP_BASE, job.id);
  const contextDir = join(workDir, "context");

  let isSuccess = false;
  let logs = "";

  try {
    await mkdir(contextDir, { recursive: true });

    // Quellcode beschaffen
    if (job.sourceType === "GIT" && job.gitUrl) {
      const git = Bun.spawn(["git", "clone", "--depth", "1", job.gitUrl, contextDir]);
      await git.exited;
    } else if (job.sourceType === "ZIP" && job.zipBase64) {
      /* ZIP Entpack-Logik */
    }

    // Action ausführen (.devion/action.yml)
    const result = await executeDevionAction(job.workflowYaml || "", {
      workDir: contextDir,
      imageName: job.imageName,
      env: { IMAGE_NAME: job.imageName },
    });

    isSuccess = result.success;
    logs = result.logs;

  } catch (err: unknown) {
    isSuccess = false;
    logs = err instanceof Error ? err.message : String(err);
  } finally {
    const durationMs = Date.now() - startTime;

    await db.transaction(async (tx) => {
      await tx.insert(buildHistory).values({
        id: job.id,
        imageName: job.imageName,
        status: isSuccess ? "SUCCESS" : "FAILED",
        logs,
        durationMs,
      });

      if (isSuccess) {
        await tx.insert(hostedApps).values({
          id: job.id,
          imageName: job.imageName,
          containerStatus: "READY",
        });
      }

      await tx.delete(buildQueue).where(eq(buildQueue.id, job.id));
    });

    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    console.log(`✅ Build [${job.id}] fertig: ${isSuccess ? "Erfolg" : "Fehler"}`);
  }
}

// --- HONO ROUTES ---

// Healthcheck & Status des Builders
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    workerRunning: isWorkerRunning,
    timestamp: new Date().toISOString(),
  });
});

// Builder manuell starten/stoppen (optional)
app.post("/worker/start", (c) => {
  if (!isWorkerRunning) {
    runBuilder();
    return c.json({ message: "Worker gestartet" });
  }
  return c.json({ message: "Worker läuft bereits" });
});

// Startet den Worker automatisch beim Booten der Anwendung
runBuilder();

export default {
  port: Number(process.env.PORT) || 3001,
  fetch: app.fetch,
};