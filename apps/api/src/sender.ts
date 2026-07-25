import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { buildQueue, hostedApps, buildHistory } from "./schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const db = drizzle(postgres(process.env.DATABASE_URL!));

Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // 1. Neuen Build-Auftrag vom Client entgegennehmen
    if (req.method === "POST" && url.pathname === "/api/builds") {
      const body = await req.json();
      const jobId = randomUUID();

      await db.insert(buildQueue).values({
        id: jobId,
        imageName: body.imageName,
        sourceType: body.sourceType, // "ZIP" oder "GIT"
        gitUrl: body.gitUrl,
        zipBase64: body.zipBase64,
      });

      return Response.json({ success: true, jobId, message: "In Queue eingereiht." });
    }

    // 2. Vom API-Server abfragen, welche Apps hostbereit sind
    if (req.method === "GET" && url.pathname === "/api/apps") {
      const apps = await db.select().from(hostedApps);
      return Response.json(apps);
    }

    // 3. Container starten (Beispiel fürs Hosten)
    if (req.method === "POST" && url.pathname.startsWith("/api/apps/host/")) {
      const appId = url.pathname.split("/").pop()!;
      const [app] = await db.select().from(hostedApps).where(eq(hostedApps.id, appId));

      if (!app) return new Response("App nicht gefunden", { status: 404 });

      // API Server startet hier den Container lokal oder via Docker Engine API
      const dockerRun = Bun.spawn(["docker", "run", "-d", app.imageName]);
      await dockerRun.exited;

      await db.update(hostedApps)
        .set({ containerStatus: "RUNNING" })
        .where(eq(hostedApps.id, appId));

      return Response.json({ success: true, message: `App ${app.imageName} wird gehostet!` });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("🚀 API-Server gestartet.");