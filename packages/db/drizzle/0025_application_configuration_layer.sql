-- Application lifecycle is configuration metadata; deployment/workload health
-- remains derived from the control plane.
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "lifecycle_status" text NOT NULL DEFAULT 'active';
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "application_type" text NOT NULL DEFAULT 'custom';
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "default_environment_id" text;
UPDATE "applications" SET "lifecycle_status" = 'archived', "archived_at" = COALESCE("archived_at", "updated_at") WHERE "status" = 'archived';
ALTER TABLE "applications" ADD CONSTRAINT "applications_lifecycle_status_check" CHECK ("lifecycle_status" IN ('active', 'archived'));
ALTER TABLE "applications" ADD CONSTRAINT "applications_type_check" CHECK ("application_type" IN ('web', 'api', 'worker', 'game_server', 'custom'));

CREATE TABLE "application_build_configurations" (
  "application_id" text PRIMARY KEY NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "build_mode" text NOT NULL DEFAULT 'dockerfile', "runtime" text NOT NULL DEFAULT 'container', "runtime_version" text,
  "root_directory" text NOT NULL DEFAULT '.', "install_command" text, "build_command" text, "start_command" text,
  "dockerfile_path" text, "build_context" text, "updated_at" timestamp NOT NULL DEFAULT now()
);
INSERT INTO "application_build_configurations" ("application_id", "root_directory", "dockerfile_path", "build_context")
SELECT "id", "root_directory", "build_configuration"->>'dockerfile', "build_configuration"->>'context' FROM "applications" WHERE "source_type" = 'git'
ON CONFLICT ("application_id") DO NOTHING;

CREATE TABLE "application_runtime_configurations" (
  "application_id" text PRIMARY KEY NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "runtime" text NOT NULL DEFAULT 'container', "command" text, "working_directory" text,
  "restart_policy" text NOT NULL DEFAULT 'unless-stopped', "graceful_shutdown_seconds" integer NOT NULL DEFAULT 15,
  "replicas" integer NOT NULL DEFAULT 1, "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "application_runtime_check" CHECK ("runtime" = 'container'),
  CONSTRAINT "application_restart_policy_check" CHECK ("restart_policy" IN ('no','on-failure','always','unless-stopped')),
  CONSTRAINT "application_shutdown_check" CHECK ("graceful_shutdown_seconds" BETWEEN 1 AND 600),
  CONSTRAINT "application_replicas_check" CHECK ("replicas" BETWEEN 1 AND 100)
);
CREATE TABLE "application_resource_configurations" (
  "application_id" text PRIMARY KEY NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "cpu_milli" integer NOT NULL DEFAULT 250, "memory_mib" integer NOT NULL DEFAULT 256, "storage_mib" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "application_cpu_check" CHECK ("cpu_milli" > 0), CONSTRAINT "application_memory_check" CHECK ("memory_mib" > 0), CONSTRAINT "application_storage_check" CHECK ("storage_mib" >= 0)
);
CREATE TABLE "application_ports" (
  "id" text PRIMARY KEY NOT NULL, "application_id" text NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "name" text, "internal_port" integer NOT NULL, "protocol" text NOT NULL DEFAULT 'tcp', "exposure" text NOT NULL DEFAULT 'private', "external_port" integer, "description" text,
  CONSTRAINT "application_port_range_check" CHECK ("internal_port" BETWEEN 1 AND 65535),
  CONSTRAINT "application_port_protocol_check" CHECK ("protocol" IN ('tcp','udp')),
  CONSTRAINT "application_port_exposure_check" CHECK ("exposure" IN ('private','public')),
  CONSTRAINT "application_external_port_range_check" CHECK ("external_port" IS NULL OR "external_port" BETWEEN 1 AND 65535)
);
CREATE UNIQUE INDEX "application_ports_unique_port_uidx" ON "application_ports" ("application_id", "internal_port", "protocol");
CREATE INDEX "application_ports_application_idx" ON "application_ports" ("application_id");
-- Existing applications retain their legacy internal_port until an operator
-- explicitly configures their multi-port definition through the API.

CREATE TABLE "application_secret_attachments" (
  "id" text PRIMARY KEY NOT NULL, "application_id" text NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "environment_id" text REFERENCES "project_environments"("id") ON DELETE cascade,
  "secret_environment_variable_id" text NOT NULL REFERENCES "environment_variables"("id") ON DELETE restrict,
  "target_key" text NOT NULL, "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "application_secret_attachments_target_uidx" ON "application_secret_attachments" ("application_id", "environment_id", "target_key");
CREATE INDEX "application_secret_attachments_application_idx" ON "application_secret_attachments" ("application_id");

-- The attachment API performs this check too. Retain the invariant at the
-- database boundary so a direct write cannot attach a foreign-project secret.
CREATE OR REPLACE FUNCTION "devion_assert_application_secret_scope"()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "applications" application
    INNER JOIN "project_environments" environment ON environment."id" = NEW."environment_id"
    INNER JOIN "environment_variables" secret ON secret."id" = NEW."secret_environment_variable_id"
    WHERE application."id" = NEW."application_id"
      AND application."project_id" = environment."project_id"
      AND secret."environment_id" = environment."id"
      AND secret."is_secret" = true
  ) THEN
    RAISE EXCEPTION 'Application secret attachment must stay inside its project environment';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "application_secret_attachment_in_scope" ON "application_secret_attachments";
CREATE TRIGGER "application_secret_attachment_in_scope"
BEFORE INSERT OR UPDATE OF "application_id", "environment_id", "secret_environment_variable_id" ON "application_secret_attachments"
FOR EACH ROW EXECUTE FUNCTION "devion_assert_application_secret_scope"();
CREATE TABLE "application_volume_mounts" (
  "id" text PRIMARY KEY NOT NULL, "application_id" text NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "volume_name" text NOT NULL, "mount_path" text NOT NULL, "read_only" boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "application_volume_mounts_path_uidx" ON "application_volume_mounts" ("application_id", "mount_path");
CREATE INDEX "application_volume_mounts_application_idx" ON "application_volume_mounts" ("application_id");

ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "configuration_snapshot" jsonb;
