ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "repository_provider" text DEFAULT 'generic' NOT NULL;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "root_directory" text DEFAULT '.' NOT NULL;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "build_configuration" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "auto_deploy_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "git_credential_reference" text;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "last_known_commit" text;

CREATE TABLE IF NOT EXISTS "builds" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "application_id" text NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "triggered_by" text REFERENCES "user"("id") ON DELETE set null,
  "trigger" text NOT NULL CHECK ("trigger" IN ('build','deploy','retry')),
  "retry_of_build_id" text REFERENCES "builds"("id") ON DELETE set null,
  "source_type" text DEFAULT 'git' NOT NULL,
  "repository_url" text NOT NULL,
  "repository_provider" text DEFAULT 'generic' NOT NULL,
  "branch" text NOT NULL,
  "commit_sha" text,
  "status" text DEFAULT 'created' NOT NULL CHECK ("status" IN ('created','queued','running','pushing','succeeded','failed','cancelled')),
  "builder_job_id" text UNIQUE,
  "build_configuration" jsonb NOT NULL,
  "image_repository" text NOT NULL,
  "image_tag" text NOT NULL,
  "image_digest" text,
  "error_code" text,
  "error_message" text,
  "queued_at" timestamp,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "builds_application_created_idx" ON "builds" ("application_id", "created_at");
CREATE INDEX IF NOT EXISTS "builds_project_status_idx" ON "builds" ("project_id", "status");

ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "build_id" text REFERENCES "builds"("id") ON DELETE restrict;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "commit_sha" text;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "created_by" text REFERENCES "user"("id") ON DELETE set null;
CREATE UNIQUE INDEX IF NOT EXISTS "deployments_build_uidx" ON "deployments" ("build_id") WHERE "build_id" IS NOT NULL;
