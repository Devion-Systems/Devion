ALTER TABLE "workloads"
  ADD COLUMN IF NOT EXISTS "health_status" text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "health_message" text;
ALTER TABLE "workloads"
  ADD CONSTRAINT "workloads_health_status_check" CHECK ("health_status" IN ('none', 'starting', 'healthy', 'unhealthy'));
