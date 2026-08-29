ALTER TABLE "deployments"
  ADD COLUMN IF NOT EXISTS "environment_id" text REFERENCES "project_environments"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS "failure_reason" text,
  ADD COLUMN IF NOT EXISTS "rollback_from_deployment_id" text REFERENCES "deployments"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "started_at" timestamp,
  ADD COLUMN IF NOT EXISTS "completed_at" timestamp,
  ADD COLUMN IF NOT EXISTS "failed_at" timestamp;

ALTER TABLE "deployments" ADD CONSTRAINT "deployments_status_check"
  CHECK ("status" IN ('queued', 'scheduling', 'starting', 'running', 'degraded', 'failed', 'stopping', 'stopped', 'superseded'));

-- Legacy rows had no durable revision invariant. Re-number deterministically
-- from their historical creation order before enforcing it.
WITH numbered AS (
  SELECT "id", row_number() OVER (PARTITION BY "application_id" ORDER BY "created_at", "id")::integer AS revision
  FROM "deployments"
)
UPDATE "deployments" AS deployment
SET "version" = numbered.revision
FROM numbered
WHERE deployment."id" = numbered."id";

UPDATE "deployments"
SET "status" = CASE WHEN "desired_state" = 'running' THEN 'queued' ELSE 'stopped' END
WHERE "status" = 'queued';

CREATE UNIQUE INDEX IF NOT EXISTS "deployments_application_version_uidx" ON "deployments" ("application_id", "version");
CREATE INDEX IF NOT EXISTS "deployments_application_status_idx" ON "deployments" ("application_id", "status");
CREATE INDEX IF NOT EXISTS "deployments_environment_idx" ON "deployments" ("environment_id");

CREATE TABLE IF NOT EXISTS "deployment_events" (
  "id" text PRIMARY KEY,
  "deployment_id" text NOT NULL REFERENCES "deployments"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "message" text NOT NULL,
  "workload_id" text REFERENCES "workloads"("id") ON DELETE SET NULL,
  "node_id" text REFERENCES "nodes"("id") ON DELETE SET NULL,
  "reason" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "deployment_events_deployment_created_idx" ON "deployment_events" ("deployment_id", "created_at");
