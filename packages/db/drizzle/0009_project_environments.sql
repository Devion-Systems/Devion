CREATE TABLE "project_environments" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "display_name" text NOT NULL,
  "branch" text DEFAULT 'main' NOT NULL,
  "auto_deploy_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "project_environments_project_name_uidx" ON "project_environments" USING btree ("project_id", "name");
CREATE INDEX "project_environments_organization_idx" ON "project_environments" USING btree ("organization_id");
CREATE INDEX "project_environments_project_idx" ON "project_environments" USING btree ("project_id");

CREATE TABLE "environment_variables" (
  "id" text PRIMARY KEY NOT NULL,
  "environment_id" text NOT NULL REFERENCES "project_environments"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "value_encrypted" text NOT NULL,
  "is_secret" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "environment_variables_environment_key_uidx" ON "environment_variables" USING btree ("environment_id", "key");
CREATE INDEX "environment_variables_environment_idx" ON "environment_variables" USING btree ("environment_id");
