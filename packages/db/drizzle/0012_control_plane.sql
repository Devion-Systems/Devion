CREATE TABLE "nodes" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "name" text NOT NULL, "hostname" text NOT NULL, "status" text DEFAULT 'provisioning' NOT NULL,
  "architecture" text NOT NULL, "os" text NOT NULL, "agent_version" text NOT NULL,
  "region" text, "labels" jsonb DEFAULT '{}'::jsonb NOT NULL, "capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL, "runtimes" jsonb DEFAULT '[]'::jsonb NOT NULL, "resources" jsonb,
  "scheduling_enabled" integer DEFAULT 1 NOT NULL, "agent_token_hash" text NOT NULL UNIQUE,
  "last_heartbeat_at" timestamp, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "nodes_organization_idx" ON "nodes" USING btree ("organization_id");
CREATE INDEX "nodes_status_idx" ON "nodes" USING btree ("status");
CREATE TABLE "node_registration_tokens" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "token_hash" text NOT NULL UNIQUE, "expires_at" timestamp NOT NULL, "used_at" timestamp, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "node_registration_tokens_organization_idx" ON "node_registration_tokens" USING btree ("organization_id");
CREATE TABLE "deployments" (
  "id" text PRIMARY KEY NOT NULL, "application_id" text NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "version" integer NOT NULL, "image" text NOT NULL, "replicas" integer NOT NULL, "desired_state" text NOT NULL,
  "runtime" text NOT NULL, "requirements" jsonb NOT NULL, "runtime_config" jsonb DEFAULT '{}'::jsonb NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "deployments_application_idx" ON "deployments" USING btree ("application_id", "created_at");
CREATE TABLE "workloads" (
  "id" text PRIMARY KEY NOT NULL, "deployment_id" text NOT NULL REFERENCES "deployments"("id") ON DELETE cascade,
  "node_id" text REFERENCES "nodes"("id") ON DELETE set null, "runtime_id" text, "scheduling_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL, "desired_state" text NOT NULL,
  "actual_state" text DEFAULT 'pending' NOT NULL, "restart_count" integer DEFAULT 0 NOT NULL,
  "last_reported_at" timestamp, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "workloads_deployment_idx" ON "workloads" USING btree ("deployment_id");
CREATE INDEX "workloads_node_idx" ON "workloads" USING btree ("node_id");
CREATE TABLE "agent_commands" (
  "id" text PRIMARY KEY NOT NULL, "node_id" text NOT NULL REFERENCES "nodes"("id") ON DELETE cascade,
  "type" text NOT NULL, "resource_id" text NOT NULL, "payload" jsonb NOT NULL, "deadline_at" timestamp,
  "status" text DEFAULT 'pending' NOT NULL, "result" jsonb, "created_at" timestamp DEFAULT now() NOT NULL, "completed_at" timestamp
);
CREATE INDEX "agent_commands_node_status_idx" ON "agent_commands" USING btree ("node_id", "status");
ALTER TABLE "game_servers" ADD COLUMN "project_id" text REFERENCES "projects"("id") ON DELETE set null;
ALTER TABLE "game_servers" ADD COLUMN "application_id" text REFERENCES "applications"("id") ON DELETE set null;
ALTER TABLE "game_servers" ADD COLUMN "deployment_id" text;
ALTER TABLE "game_servers" ADD COLUMN "runtime_port" integer;
CREATE UNIQUE INDEX "game_servers_application_id_uidx" ON "game_servers" USING btree ("application_id");
CREATE INDEX "game_servers_project_idx" ON "game_servers" USING btree ("project_id");
