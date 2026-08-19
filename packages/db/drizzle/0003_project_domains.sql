CREATE TABLE "project_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"hostname" text NOT NULL,
	"environment" text DEFAULT 'production' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"ssl_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_domains" ADD CONSTRAINT "project_domains_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_domains" ADD CONSTRAINT "project_domains_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "project_domains_project_hostname_uidx" ON "project_domains" USING btree ("project_id","hostname");
--> statement-breakpoint
CREATE INDEX "project_domains_organization_idx" ON "project_domains" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "project_domains_project_idx" ON "project_domains" USING btree ("project_id");
