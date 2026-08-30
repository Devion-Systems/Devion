-- Health reports are ordered by a server-side generation and old rows begin
-- as unknown rather than receiving an invented healthy state.
ALTER TABLE "workloads"
  ADD COLUMN IF NOT EXISTS "health_failure_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "health_checked_at" timestamp,
  ADD COLUMN IF NOT EXISTS "last_healthy_at" timestamp,
  ADD COLUMN IF NOT EXISTS "health_changed_at" timestamp,
  ADD COLUMN IF NOT EXISTS "report_generation" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "lost_at" timestamp,
  ADD COLUMN IF NOT EXISTS "replacement_of_workload_id" text REFERENCES "workloads"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "replacement_reason" text;

ALTER TABLE "workloads" DROP CONSTRAINT IF EXISTS "workloads_health_status_check";
ALTER TABLE "workloads" ADD CONSTRAINT "workloads_health_status_check"
  CHECK ("health_status" IN ('none', 'starting', 'healthy', 'unhealthy', 'unknown'));

ALTER TABLE "workloads" DROP CONSTRAINT IF EXISTS "workloads_actual_state_check";
ALTER TABLE "workloads" ADD CONSTRAINT "workloads_actual_state_check"
  CHECK ("actual_state" IN ('pending', 'starting', 'running', 'stopped', 'failed', 'lost', 'unknown'));

UPDATE "workloads"
SET "health_status" = 'unknown'
WHERE "health_status" = 'none' AND "last_reported_at" IS NULL;

CREATE INDEX IF NOT EXISTS "workloads_node_actual_state_idx"
  ON "workloads" ("node_id", "actual_state");

ALTER TABLE "deployments"
  ADD COLUMN IF NOT EXISTS "recovery_attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "recovery_next_attempt_at" timestamp,
  ADD COLUMN IF NOT EXISTS "recovery_state" text NOT NULL DEFAULT 'idle';
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_recovery_state_check"
  CHECK ("recovery_state" IN ('idle', 'backoff', 'manual_intervention'));

ALTER TABLE "deployments"
  ADD COLUMN IF NOT EXISTS "reconcile_lease_id" text,
  ADD COLUMN IF NOT EXISTS "reconcile_lease_until" timestamp;
CREATE INDEX IF NOT EXISTS "deployments_reconcile_lease_idx"
  ON "deployments" ("reconcile_lease_until");

ALTER TABLE "nodes"
  ADD COLUMN IF NOT EXISTS "unhealthy_at" timestamp,
  ADD COLUMN IF NOT EXISTS "offline_at" timestamp;
