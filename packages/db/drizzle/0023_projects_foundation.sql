-- Keep existing project records and assignments intact while moving Projects
-- from a runtime status to an organizational lifecycle.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "access_mode" text NOT NULL DEFAULT 'organization';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "default_environment_id" text;
UPDATE "projects" SET "status" = 'active' WHERE "status" <> 'archived';
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'active';

CREATE TABLE IF NOT EXISTS "project_teams" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "team_id" text NOT NULL REFERENCES "team"("id") ON DELETE cascade,
  "assigned_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "project_teams_project_team_uidx" ON "project_teams" ("project_id", "team_id");
CREATE INDEX IF NOT EXISTS "project_teams_project_idx" ON "project_teams" ("project_id");
CREATE INDEX IF NOT EXISTS "project_teams_team_idx" ON "project_teams" ("team_id");
INSERT INTO "project_teams" ("project_id", "team_id")
SELECT "id", "team_id" FROM "projects" WHERE "team_id" IS NOT NULL
ON CONFLICT ("project_id", "team_id") DO NOTHING;

ALTER TABLE "project_environments" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE "project_environments" ADD COLUMN IF NOT EXISTS "protected" boolean NOT NULL DEFAULT false;
UPDATE "project_environments" SET "slug" = "name" WHERE "slug" IS NULL;
ALTER TABLE "project_environments" ALTER COLUMN "slug" SET NOT NULL;
DROP INDEX IF EXISTS "project_environments_project_name_uidx";
CREATE UNIQUE INDEX IF NOT EXISTS "project_environments_project_slug_uidx" ON "project_environments" ("project_id", "slug");

-- Existing projects may predate environments. Give only those projects a
-- stable, protected production environment; never modify existing ones.
INSERT INTO "project_environments" (
  "id", "organization_id", "project_id", "name", "slug", "display_name", "protected"
)
SELECT
  md5('devion-default-environment:' || project."id"),
  project."organization_id",
  project."id",
  'production',
  'production',
  'Production',
  true
FROM "projects" project
WHERE NOT EXISTS (
  SELECT 1 FROM "project_environments" environment
  WHERE environment."project_id" = project."id"
);

UPDATE "projects" project
SET "default_environment_id" = (
  SELECT environment."id"
  FROM "project_environments" environment
  WHERE environment."project_id" = project."id"
  ORDER BY (environment."slug" = 'production') DESC, environment."created_at" ASC
  LIMIT 1
)
WHERE project."default_environment_id" IS NULL;

CREATE OR REPLACE FUNCTION "devion_assert_default_project_environment"()
RETURNS trigger AS $$
BEGIN
  IF NEW."default_environment_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "project_environments"
    WHERE "id" = NEW."default_environment_id" AND "project_id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Default environment must belong to its project';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "projects_default_environment_in_scope" ON "projects";
CREATE TRIGGER "projects_default_environment_in_scope"
BEFORE INSERT OR UPDATE OF "default_environment_id" ON "projects"
FOR EACH ROW EXECUTE FUNCTION "devion_assert_default_project_environment"();

-- Existing legacy team assignments become team-scoped projects.
UPDATE "projects" SET "access_mode" = 'team' WHERE "team_id" IS NOT NULL;

-- PostgreSQL cannot express this cross-table tenant invariant with a simple
-- foreign key. Enforce it at the database boundary as well as in the API.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "project_teams" assignment
    INNER JOIN "projects" project ON project."id" = assignment."project_id"
    INNER JOIN "team" assigned_team ON assigned_team."id" = assignment."team_id"
    WHERE project."organization_id" <> assigned_team."organization_id"
  ) THEN
    RAISE EXCEPTION 'Cannot migrate project team assignments across organizations';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "devion_assert_project_team_organization"()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "projects" project
    INNER JOIN "team" assigned_team ON assigned_team."id" = NEW."team_id"
    WHERE project."id" = NEW."project_id"
      AND project."organization_id" = assigned_team."organization_id"
  ) THEN
    RAISE EXCEPTION 'Project and team must belong to the same organization';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "project_teams_same_organization" ON "project_teams";
CREATE TRIGGER "project_teams_same_organization"
BEFORE INSERT OR UPDATE OF "project_id", "team_id" ON "project_teams"
FOR EACH ROW EXECUTE FUNCTION "devion_assert_project_team_organization"();

CREATE OR REPLACE FUNCTION "devion_assert_legacy_project_team_organization"()
RETURNS trigger AS $$
BEGIN
  IF NEW."team_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "team"
    WHERE "id" = NEW."team_id" AND "organization_id" = NEW."organization_id"
  ) THEN
    RAISE EXCEPTION 'Project and team must belong to the same organization';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "projects_legacy_team_same_organization" ON "projects";
CREATE TRIGGER "projects_legacy_team_same_organization"
BEFORE INSERT OR UPDATE OF "organization_id", "team_id" ON "projects"
FOR EACH ROW EXECUTE FUNCTION "devion_assert_legacy_project_team_organization"();
