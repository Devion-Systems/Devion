CREATE TABLE "application_environment_variables" (
  "id" text PRIMARY KEY NOT NULL,
  "application_id" text NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "environment_id" text REFERENCES "project_environments"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "value_encrypted" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "application_environment_variables_application_idx" ON "application_environment_variables" ("application_id");
CREATE INDEX "application_environment_variables_environment_idx" ON "application_environment_variables" ("environment_id");
CREATE UNIQUE INDEX "application_environment_variables_default_key_uidx"
  ON "application_environment_variables" ("application_id", "key") WHERE "environment_id" IS NULL;
CREATE UNIQUE INDEX "application_environment_variables_override_key_uidx"
  ON "application_environment_variables" ("application_id", "environment_id", "key") WHERE "environment_id" IS NOT NULL;

CREATE OR REPLACE FUNCTION "devion_assert_application_variable_scope"()
RETURNS trigger AS $$
BEGIN
  IF NEW."environment_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "applications" application
    INNER JOIN "project_environments" environment ON environment."id" = NEW."environment_id"
    WHERE application."id" = NEW."application_id"
      AND application."project_id" = environment."project_id"
  ) THEN
    RAISE EXCEPTION 'Application variable override must stay inside its project environment';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "application_variable_in_scope"
BEFORE INSERT OR UPDATE OF "application_id", "environment_id" ON "application_environment_variables"
FOR EACH ROW EXECUTE FUNCTION "devion_assert_application_variable_scope"();
