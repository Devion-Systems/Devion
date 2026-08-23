CREATE TABLE "system_installation" (
	"id" integer PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"administrator_id" text NOT NULL,
	"company_name" text NOT NULL,
	"primary_domain" text,
	"ldap_enabled" boolean DEFAULT false NOT NULL,
	"ldap_config_encrypted" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_installation_singleton" CHECK ("id" = 1)
);
--> statement-breakpoint
ALTER TABLE "system_installation" ADD CONSTRAINT "system_installation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_installation" ADD CONSTRAINT "system_installation_administrator_id_user_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
