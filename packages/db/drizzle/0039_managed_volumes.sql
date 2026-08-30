-- Managed volumes intentionally use a Devion-generated runtime name. Existing
-- application mounts remain untouched: without a runtime inventory there is no
-- safe way to infer their node or ownership, so they remain legacy mounts.
CREATE TABLE IF NOT EXISTS "volumes" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "runtime_name" text NOT NULL,
  "backend" text NOT NULL DEFAULT 'docker_local',
  "status" text NOT NULL DEFAULT 'available',
  "node_id" text REFERENCES "nodes"("id") ON DELETE SET NULL,
  "capacity_mib" integer,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "volumes_backend_check" CHECK ("backend" IN ('docker_local')),
  CONSTRAINT "volumes_status_check" CHECK ("status" IN ('available', 'in_use', 'unavailable', 'error', 'deleting', 'legacy')),
  CONSTRAINT "volumes_capacity_check" CHECK ("capacity_mib" IS NULL OR "capacity_mib" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "volumes_project_name_uidx" ON "volumes" ("project_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "volumes_runtime_name_uidx" ON "volumes" ("runtime_name");
CREATE INDEX IF NOT EXISTS "volumes_project_status_idx" ON "volumes" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "volumes_node_idx" ON "volumes" ("node_id");

ALTER TABLE "application_volume_mounts"
  ADD COLUMN IF NOT EXISTS "volume_id" text REFERENCES "volumes"("id") ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS "application_volume_mounts_volume_idx"
  ON "application_volume_mounts" ("volume_id");
CREATE UNIQUE INDEX IF NOT EXISTS "application_volume_mounts_volume_uidx"
  ON "application_volume_mounts" ("volume_id");

CREATE TABLE IF NOT EXISTS "deployment_volume_mounts" (
  "id" text PRIMARY KEY NOT NULL,
  "deployment_id" text NOT NULL REFERENCES "deployments"("id") ON DELETE CASCADE,
  "volume_id" text NOT NULL REFERENCES "volumes"("id") ON DELETE RESTRICT,
  "mount_path" text NOT NULL,
  "read_only" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "deployment_volume_mounts_path_uidx"
  ON "deployment_volume_mounts" ("deployment_id", "mount_path");
CREATE INDEX IF NOT EXISTS "deployment_volume_mounts_volume_idx"
  ON "deployment_volume_mounts" ("volume_id");

-- API scope checks are not the final security boundary. These triggers keep
-- direct SQL, background jobs, and future write paths within the same project.
CREATE OR REPLACE FUNCTION "devion_assert_application_volume_scope"()
RETURNS trigger AS $$
DECLARE expected_runtime_name text;
BEGIN
  IF NEW."volume_id" IS NULL THEN RETURN NEW; END IF;
  SELECT volume."runtime_name" INTO expected_runtime_name
  FROM "volumes" AS volume
  INNER JOIN "applications" AS application ON application."project_id" = volume."project_id"
  WHERE volume."id" = NEW."volume_id" AND application."id" = NEW."application_id";
  IF expected_runtime_name IS NULL THEN
    RAISE EXCEPTION 'Application volume mount must stay inside its project';
  END IF;
  IF NEW."volume_name" <> expected_runtime_name THEN
    RAISE EXCEPTION 'Managed volume mount runtime name must match its volume';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "application_volume_mount_scope" ON "application_volume_mounts";
CREATE TRIGGER "application_volume_mount_scope"
BEFORE INSERT OR UPDATE OF "application_id", "volume_id", "volume_name" ON "application_volume_mounts"
FOR EACH ROW EXECUTE FUNCTION "devion_assert_application_volume_scope"();

CREATE OR REPLACE FUNCTION "devion_assert_deployment_volume_scope"()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "deployments" AS deployment
    INNER JOIN "applications" AS application ON application."id" = deployment."application_id"
    INNER JOIN "volumes" AS volume ON volume."project_id" = application."project_id"
    WHERE deployment."id" = NEW."deployment_id" AND volume."id" = NEW."volume_id"
  ) THEN
    RAISE EXCEPTION 'Deployment volume mount must stay inside its project';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "deployment_volume_mount_scope" ON "deployment_volume_mounts";
CREATE TRIGGER "deployment_volume_mount_scope"
BEFORE INSERT OR UPDATE OF "deployment_id", "volume_id" ON "deployment_volume_mounts"
FOR EACH ROW EXECUTE FUNCTION "devion_assert_deployment_volume_scope"();

CREATE OR REPLACE FUNCTION "devion_assert_volume_node_scope"()
RETURNS trigger AS $$
BEGIN
  IF NEW."node_id" IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "projects" AS project
    INNER JOIN "nodes" AS node ON (node."organization_id" IS NULL OR node."organization_id" = project."organization_id")
    WHERE project."id" = NEW."project_id" AND node."id" = NEW."node_id"
  ) THEN
    RAISE EXCEPTION 'Volume node must belong to the project organization';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "volume_node_scope" ON "volumes";
CREATE TRIGGER "volume_node_scope"
BEFORE INSERT OR UPDATE OF "project_id", "node_id" ON "volumes"
FOR EACH ROW EXECUTE FUNCTION "devion_assert_volume_node_scope"();
