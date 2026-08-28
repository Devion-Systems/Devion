ALTER TABLE "application_runtime_configurations"
  ADD COLUMN IF NOT EXISTS "healthcheck_command" text,
  ADD COLUMN IF NOT EXISTS "healthcheck_interval_seconds" integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "healthcheck_timeout_seconds" integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "healthcheck_retries" integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "healthcheck_start_period_seconds" integer NOT NULL DEFAULT 0;
ALTER TABLE "application_runtime_configurations"
  ADD CONSTRAINT "application_healthcheck_interval_check" CHECK ("healthcheck_interval_seconds" BETWEEN 1 AND 3600),
  ADD CONSTRAINT "application_healthcheck_timeout_check" CHECK ("healthcheck_timeout_seconds" BETWEEN 1 AND 600),
  ADD CONSTRAINT "application_healthcheck_retries_check" CHECK ("healthcheck_retries" BETWEEN 1 AND 20),
  ADD CONSTRAINT "application_healthcheck_start_period_check" CHECK ("healthcheck_start_period_seconds" BETWEEN 0 AND 3600);
