ALTER TABLE "application_ports"
  ADD COLUMN IF NOT EXISTS "requested_host_port" integer;
UPDATE "application_ports"
SET "requested_host_port" = "external_port"
WHERE "requested_host_port" IS NULL AND "external_port" IS NOT NULL;
ALTER TABLE "application_ports" ADD CONSTRAINT "application_ports_requested_host_port_check"
  CHECK ("requested_host_port" IS NULL OR "requested_host_port" BETWEEN 1 AND 65535);

CREATE TABLE IF NOT EXISTS "node_port_reservations" (
  "id" text PRIMARY KEY NOT NULL,
  "node_id" text NOT NULL REFERENCES "nodes"("id") ON DELETE CASCADE,
  "workload_id" text NOT NULL REFERENCES "workloads"("id") ON DELETE CASCADE,
  "container_port" integer NOT NULL,
  "host_port" integer NOT NULL,
  "protocol" text NOT NULL,
  "status" text NOT NULL DEFAULT 'reserved',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "node_port_reservations_protocol_check" CHECK ("protocol" IN ('tcp', 'udp')),
  CONSTRAINT "node_port_reservations_status_check" CHECK ("status" IN ('reserved', 'bound', 'released')),
  CONSTRAINT "node_port_reservations_port_range_check" CHECK ("container_port" BETWEEN 1 AND 65535 AND "host_port" BETWEEN 1 AND 65535),
  CONSTRAINT "node_port_reservations_workload_port_uidx" UNIQUE ("workload_id", "container_port", "protocol")
);
CREATE UNIQUE INDEX IF NOT EXISTS "node_port_reservations_active_node_host_protocol_uidx"
  ON "node_port_reservations" ("node_id", "host_port", "protocol")
  WHERE "status" IN ('reserved', 'bound');
CREATE INDEX IF NOT EXISTS "node_port_reservations_node_status_idx"
  ON "node_port_reservations" ("node_id", "status");
