-- Applications have an organizational lifecycle distinct from runtime health.
-- Existing runtime statuses remain valid for backwards compatibility.
ALTER TABLE "applications"
  ADD CONSTRAINT "applications_status_check"
  CHECK ("status" IN ('draft', 'ready', 'deploying', 'healthy', 'degraded', 'failed', 'stopped', 'archived'));
