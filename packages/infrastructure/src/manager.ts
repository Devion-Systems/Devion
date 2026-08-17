import { checkDbHealth } from "./storage/database/db.js";
import { blobStorage } from "./storage/blob/client.js";
import { dockerRegistry } from "./storage/registry/index.js";
import { getLogger } from "@repo/core";

export interface InfrastructureHealthReport {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  database: { status: "ok" | "error"; latencyMs?: number; error?: string };
  blobStorage: { status: "ok" | "error"; error?: string };
  dockerRegistry: { status: "ok" | "error"; error?: string };
}

export async function checkInfrastructureHealth(): Promise<InfrastructureHealthReport> {
  const timestamp = new Date().toISOString();
  const report: InfrastructureHealthReport = {
    status: "ok",
    timestamp,
    database: { status: "ok" },
    blobStorage: { status: "ok" },
    dockerRegistry: { status: "ok" },
  };

  try {
    const dbHealth = await checkDbHealth();
    report.database = { status: dbHealth.status, latencyMs: dbHealth.latencyMs };
  } catch (err: any) {
    report.database = { status: "error", error: err.message };
    report.status = "degraded";
  }

  try {
    await blobStorage.ensureBucketExists("devion-health-check");
  } catch (err: any) {
    report.blobStorage = { status: "error", error: err.message };
    report.status = "degraded";
  }

  try {
    const registryOk = await dockerRegistry.ping();
    if (!registryOk) {
      report.dockerRegistry = { status: "error", error: "Docker Registry ping returned non-200 status" };
      report.status = "degraded";
    }
  } catch (err: any) {
    report.dockerRegistry = { status: "error", error: err.message };
    report.status = "degraded";
  }

  if (report.database.status === "error" && report.blobStorage.status === "error") {
    report.status = "error";
  }

  try {
    getLogger().info({ report }, "Infrastructure Health Check abgeschlossen");
  } catch {
    // logger fallback
  }

  return report;
}
