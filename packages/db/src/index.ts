// Database package exports. Blob storage and the registry live in @repo/s3 and
// @repo/registry respectively.
export { checkDbHealth, closeDbPool, db, getDb, getDbPool } from "./database/db.js";
export { authSchema } from "./database/schema/auth-schema.js";
export * from "./database/schema/schema.js";
