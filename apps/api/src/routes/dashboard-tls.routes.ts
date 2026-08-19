import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { DashboardCertificateManager } from "../lib/network/dashboard-certificates.js";
import { requirePlatformAdmin } from "../middleware/auth.js";
import { isTrustedBrowserOrigin } from "../middleware/cors.js";
import type { AppEnv } from "../types/env.js";

const MAX_UPLOAD_BYTES = 320 * 1024;
const certificates = new DashboardCertificateManager();
const dashboardTlsRoutes = new Hono<AppEnv>();

dashboardTlsRoutes.use("/*", requirePlatformAdmin);
dashboardTlsRoutes.use("/*", bodyLimit({ maxSize: MAX_UPLOAD_BYTES }));

dashboardTlsRoutes.get("/certificate", async (c) => c.json(await certificates.getStatus()));

dashboardTlsRoutes.post("/certificate", async (c) => {
  if (!isTrustedBrowserOrigin(c.req.header("origin"))) {
    return c.json({ error: "A trusted browser origin is required" }, 403);
  }
  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return c.json({ error: "Certificate upload is too large" }, 413);
  }

  const body = await c.req.parseBody();
  const certificateFile = body.certificate;
  const privateKeyFile = body.privateKey;
  if (!(certificateFile instanceof File) || !(privateKeyFile instanceof File)) {
    return c.json({ error: "certificate and privateKey files are required" }, 400);
  }
  if (certificateFile.size + privateKeyFile.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "Certificate upload is too large" }, 413);
  }

  try {
    const status = await certificates.install(
      await certificateFile.text(),
      await privateKeyFile.text(),
    );
    c.get("logger").info(
      { fingerprint256: status.fingerprint256, validTo: status.validTo },
      "Dashboard TLS certificate installed",
    );
    return c.json(status, 201);
  } catch (error) {
    c.get("logger").warn({ error }, "Rejected dashboard TLS certificate upload");
    return c.json({ error: "Certificate or private key is invalid" }, 400);
  }
});

export { dashboardTlsRoutes };
