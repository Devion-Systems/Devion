import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { connect, PostgresRunRepository } from "./postgres.ts";

const config = loadConfig();
const repository = new PostgresRunRepository(connect(config.DATABASE_URL));
await repository.migrate();
const corsOrigins = config.CORS_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
const app = createApp(repository, config.BUILDER_API_TOKEN, corsOrigins);

export default { port: config.PORT, fetch: app.fetch };
console.log(`Devion Builder API listening on :${config.PORT}`);
