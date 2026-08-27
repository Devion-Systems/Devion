CREATE TABLE IF NOT EXISTS "organization_role" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "description" text,
  "immutable" boolean DEFAULT false NOT NULL,
  "created_by" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "organizationRole_organizationId_idx" ON "organization_role" ("organization_id");
CREATE INDEX IF NOT EXISTS "organizationRole_createdBy_idx" ON "organization_role" ("created_by");
CREATE TABLE IF NOT EXISTS "organization_role_permission" (
  "role_id" text NOT NULL REFERENCES "organization_role"("id") ON DELETE cascade,
  "permission" text NOT NULL,
  PRIMARY KEY ("role_id", "permission")
);
CREATE INDEX IF NOT EXISTS "organizationRolePermission_roleId_idx" ON "organization_role_permission" ("role_id");
CREATE INDEX IF NOT EXISTS "organizationRolePermission_permission_idx" ON "organization_role_permission" ("permission");
