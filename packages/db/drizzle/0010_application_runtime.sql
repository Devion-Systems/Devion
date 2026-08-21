ALTER TABLE "applications" ADD COLUMN "container_name" text;
ALTER TABLE "applications" ADD COLUMN "internal_port" integer DEFAULT 3000 NOT NULL;
CREATE UNIQUE INDEX "applications_container_name_uidx" ON "applications" USING btree ("container_name");
CREATE TABLE "application_deployments" (
  "id" text PRIMARY KEY NOT NULL,
  "application_id" text NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "actor_id" text REFERENCES "user"("id") ON DELETE set null,
  "action" text NOT NULL,
  "status" text NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "application_deployments_application_idx" ON "application_deployments" USING btree ("application_id", "created_at");
