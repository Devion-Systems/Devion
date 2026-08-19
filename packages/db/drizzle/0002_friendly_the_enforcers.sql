CREATE TABLE "managed_databases" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"name" text NOT NULL,
	"engine" text NOT NULL,
	"version" text NOT NULL,
	"plan" text DEFAULT 'starter' NOT NULL,
	"status" text DEFAULT 'provisioning' NOT NULL,
	"region" text DEFAULT 'local' NOT NULL,
	"maintenance_window" text DEFAULT 'Sunday 02:00 UTC' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "managed_databases" ADD CONSTRAINT "managed_databases_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_databases" ADD CONSTRAINT "managed_databases_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "managed_databases_organization_name_uidx" ON "managed_databases" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "managed_databases_organization_idx" ON "managed_databases" USING btree ("organization_id");