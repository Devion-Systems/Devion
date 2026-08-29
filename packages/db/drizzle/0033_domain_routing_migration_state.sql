ALTER TABLE "project_domains"
  ADD COLUMN IF NOT EXISTS "routing_migration_state" text NOT NULL DEFAULT 'target';

ALTER TABLE "project_domains"
  ADD CONSTRAINT "project_domains_routing_migration_state_check"
  CHECK ("routing_migration_state" IN ('target', 'legacy'));

-- Preserve already-published legacy routes until an operator gives each
-- domain an explicit Application/Port target. The new resolver never consumes
-- routing_target_url, so this state is an availability guard, not a fallback.
UPDATE "project_domains"
SET "routing_migration_state" = 'legacy'
WHERE "status" = 'active' AND "application_id" IS NULL;
