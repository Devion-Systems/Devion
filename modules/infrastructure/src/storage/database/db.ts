import { Pool, type PoolConfig } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema/schema.js";
import { parseEnv, AppError, ErrorCode, getLogger } from "@repo/core";

export type DbClient = NodePgDatabase<typeof schema>;

let poolInstance: Pool | null = null;
let dbInstance: DbClient | null = null;

function getSafeLogger() {
  try {
    return getLogger();
  } catch {
    return null;
  }
}

export function getDbPool(customConfig?: Partial<PoolConfig>): Pool {
  if (poolInstance) return poolInstance;

  const env = parseEnv() as any;
  const connectionString = env.DATABASE_URL as string | undefined;

  if (!connectionString) {
    throw new AppError(
      "DATABASE_URL is required to initialize PostgreSQL connection pool",
      ErrorCode.VALIDATION_ERROR,
      500
    );
  }

  const poolConfig: PoolConfig = {
    connectionString,
    max: Number(process.env.DB_POOL_MAX) || 20,
    min: Number(process.env.DB_POOL_MIN) || 5,
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT) || 5000,
    maxUses: 7500,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ...customConfig,
  };

  poolInstance = new Pool(poolConfig);

  poolInstance.on("error", (err) => {
    getSafeLogger()?.error({ err }, "Schwerwiegender PostgreSQL Pool-Fehler");
  });

  poolInstance.on("connect", () => {
    getSafeLogger()?.debug("Neue PostgreSQL Verbindung im Pool etabliert");
  });

  return poolInstance;
}

export function getDb(): DbClient {
  if (dbInstance) return dbInstance;

  const pool = getDbPool();
  dbInstance = drizzle({
    client: pool,
    schema,
    logger: process.env.NODE_ENV === "development",
  });

  return dbInstance;
}

export async function checkDbHealth(): Promise<{ status: "ok" | "error"; latencyMs: number }> {
  const start = Date.now();
  try {
    const pool = getDbPool();
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err: any) {
    getSafeLogger()?.error({ err }, "PostgreSQL Health Check fehlgeschlagen");
    throw new AppError(
      "Database health check failed",
      ErrorCode.SERVICE_UNAVAILABLE,
      503,
      { cause: err }
    );
  }
}

export async function closeDbPool(): Promise<void> {
  if (poolInstance) {
    getSafeLogger()?.info("Schließe PostgreSQL Connection Pool...");
    await poolInstance.end();
    poolInstance = null;
    dbInstance = null;
  }
}

export const db = getDb();
