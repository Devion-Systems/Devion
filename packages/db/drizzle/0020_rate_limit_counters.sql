CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
  "key" text PRIMARY KEY NOT NULL,
  "count" integer NOT NULL,
  "reset_at" timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "rate_limit_counters_reset_at_idx" ON "rate_limit_counters" ("reset_at");
