CREATE TABLE "applications" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "source_type" text NOT NULL,
  "git_url" text,
  "image_name" text,
  "branch" text DEFAULT 'main' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "applications_project_slug_uidx" ON "applications" USING btree ("project_id", "slug");
CREATE INDEX "applications_organization_idx" ON "applications" USING btree ("organization_id");
CREATE INDEX "applications_project_idx" ON "applications" USING btree ("project_id");
