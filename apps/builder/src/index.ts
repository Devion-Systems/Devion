import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { unzipper } from "unzipper"; // bun add unzipper
import { buildQueue, buildHistory } from "./schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const TMP_BASE = join(import.meta.dir, ".worker-builds");

async function runWorker() {
  console.log("👷 Empfänger-Worker gestartet. Warte auf neue Jobs in der Queue...");

  while (true) {
    try {
      // 1. Nächsten freien Job abholen und direkt für andere Worker sperren
      const job = await db.transaction(async (tx) => {
        const result = await tx.execute(sql`
          SELECT * FROM build_queue
          WHERE status = 'PENDING'
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `);

        if (result.length === 0) return null;

        const nextJob = result[0] as typeof buildQueue.$inferSelect;

        // Job für die Bearbeitung reservieren
        await tx.update(buildQueue)
          .set({ status: "PROCESSING" })
          .where(eq(buildQueue.id, nextJob.id));

        return nextJob;
      });

      // Wenn die Queue leer ist -> 2 Sekunden schlafen
      if (!job) {
        await Bun.sleep(2000);
        continue;
      }

      console.log(`🔨 Starte Build für Job-ID: ${job.id} (Image: ${job.imageName})`);
      const startTime = Date.now();

      // 2. Temporären Ordner anlegen & Zip entpacken
      const workDir = join(TMP_BASE, job.id);
      const contextDir = join(workDir, "context");
      await mkdir(contextDir, { recursive: true });

      const zipBuffer = Buffer.from(job.zipBase64, "base64");
      const directory = await unzipper.Open.buffer(zipBuffer);
      await directory.extract({ path: contextDir });

      // 3. Docker-Build ausführen
      const dockerProc = Bun.spawn([
        "docker", "build",
        "-t", job.imageName,
        "-f", join(contextDir, job.dockerfile),
        contextDir
      ], { stdout: "pipe", stderr: "pipe" });

      const stdout = await new Response(dockerProc.stdout).text();
      const stderr = await new Response(dockerProc.stderr).text();
      const exitCode = await dockerProc.exited;

      const isSuccess = exitCode === 0;
      const durationMs = Date.now() - startTime;
      const combinedLogs = stdout + "\n" + stderr;

      // 4. In Fertig-Tabelle eintragen & aus Queue löschen (in einer Transaktion)
      await db.transaction(async (tx) => {
        await tx.insert(buildHistory).values({
          id: job.id,
          imageName: job.imageName,
          status: isSuccess ? "SUCCESS" : "FAILED",
          logs: combinedLogs,
          durationMs,
        });

        await tx.delete(buildQueue).where(eq(buildQueue.id, job.id));
      });

      // 5. Aufräumen
      await rm(workDir, { recursive: true, force: true });
      console.log(`✅ Job ${job.id} beendet mit Status: ${isSuccess ? "SUCCESS" : "FAILED"}`);

    } catch (error) {
      console.error("❌ Fehler im Empfänger-Worker:", error);
      await Bun.sleep(5000); // Bei Fehler kurz pausieren
    }
  }
}

runWorker();