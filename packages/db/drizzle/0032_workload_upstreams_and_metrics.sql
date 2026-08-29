ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "advertised_address" text;

ALTER TABLE "project_domains"
  ADD COLUMN IF NOT EXISTS "application_id" text REFERENCES "applications"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "deployment_id" text,
  ADD COLUMN IF NOT EXISTS "target_port" integer,
  ADD COLUMN IF NOT EXISTS "upstream_protocol" text;

ALTER TABLE "project_domains"
  ADD CONSTRAINT "project_domains_upstream_protocol_check"
  CHECK ("upstream_protocol" IS NULL OR "upstream_protocol" IN ('http', 'https'));

CREATE INDEX IF NOT EXISTS "project_domains_application_idx" ON "project_domains" ("application_id");
CREATE INDEX IF NOT EXISTS "project_domains_deployment_idx" ON "project_domains" ("deployment_id");

CREATE TABLE IF NOT EXISTS "workload_metrics" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "workload_id" text NOT NULL REFERENCES "workloads"("id") ON DELETE CASCADE,
  "node_id" text NOT NULL REFERENCES "nodes"("id") ON DELETE CASCADE,
  "recorded_at" timestamp NOT NULL,
  "cpu_usage_percent" real,
  "memory_usage_bytes" bigint NOT NULL,
  "memory_limit_bytes" bigint,
  "network_rx_bytes" bigint NOT NULL,
  "network_tx_bytes" bigint NOT NULL,
  "disk_read_bytes" bigint NOT NULL,
  "disk_write_bytes" bigint NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "workload_metrics_workload_recorded_idx" ON "workload_metrics" ("workload_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "workload_metrics_node_recorded_idx" ON "workload_metrics" ("node_id", "recorded_at");
