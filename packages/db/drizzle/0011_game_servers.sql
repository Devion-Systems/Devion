CREATE TABLE "game_servers" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "created_by_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "name" text NOT NULL,
  "game" text NOT NULL,
  "version" text DEFAULT 'LATEST' NOT NULL,
  "memory_mib" integer DEFAULT 2048 NOT NULL,
  "container_name" text NOT NULL,
  "status" text DEFAULT 'provisioning' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "game_servers_container_name_uidx" ON "game_servers" USING btree ("container_name");
CREATE INDEX "game_servers_organization_idx" ON "game_servers" USING btree ("organization_id");
