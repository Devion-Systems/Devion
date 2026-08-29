import { loadConfig } from "./config.ts";
import { connect, PostgresRunRepository } from "./postgres.ts";

const config = loadConfig();
const sql = connect(config.DATABASE_URL);
await new PostgresRunRepository(sql, config.BUILDER_SECRET_ENCRYPTION_KEY).migrate();
await sql.end({ timeout: 5 });
console.log("Builder migration complete");
