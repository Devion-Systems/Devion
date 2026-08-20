ALTER TABLE "managed_databases"
  ADD COLUMN "database_name" text NOT NULL DEFAULT 'app',
  ADD COLUMN "username" text NOT NULL DEFAULT 'devion',
  ADD COLUMN "container_name" text NOT NULL DEFAULT '',
  ADD COLUMN "cpu_millicores" integer NOT NULL DEFAULT 250,
  ADD COLUMN "memory_mib" integer NOT NULL DEFAULT 512,
  ADD COLUMN "storage_gib" integer NOT NULL DEFAULT 10;
--> statement-breakpoint
UPDATE "managed_databases"
SET "container_name" = 'devion-db-' || replace("id", '-', '')
WHERE "container_name" = '';
--> statement-breakpoint
ALTER TABLE "managed_databases" ALTER COLUMN "container_name" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "managed_databases" ADD CONSTRAINT "managed_databases_container_name_unique" UNIQUE("container_name");
