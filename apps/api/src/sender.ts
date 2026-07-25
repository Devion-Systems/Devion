import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { buildQueue } from "./schema";
import { randomUUID } from "node:crypto";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

Bun.serve({
  port: 3000,
  async fetch(req) {
    if (req.method === "POST" && new URL(req.url).pathname === "/enqueue") {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const imageName = formData.get("imageName") as string;

      if (!file || !imageName) {
        return Response.json({ error: "File und imageName erforderlich" }, { status: 400 });
      }

      // Zip als Base64 konvertieren
      const buffer = await file.arrayBuffer();
      const zipBase64 = Buffer.from(buffer).toString("base64");

      const jobId = randomUUID();

      // In die Queue eintragen
      await db.insert(buildQueue).values({
        id: jobId,
        imageName,
        zipBase64,
      });

      return Response.json({ success: true, jobId, message: "Build in Queue eingereiht." });
    }

    return new Response("Not Found", { status: 404 });
  },
});