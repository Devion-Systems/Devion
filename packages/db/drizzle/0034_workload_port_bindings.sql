CREATE TABLE IF NOT EXISTS "workload_ports" (
  "workload_id" text NOT NULL REFERENCES "workloads"("id") ON DELETE CASCADE,
  "container_port" integer NOT NULL,
  "host_port" integer NOT NULL,
  "protocol" text NOT NULL,
  "exposure" text NOT NULL,
  "observed_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "workload_ports_protocol_check" CHECK ("protocol" IN ('tcp', 'udp')),
  CONSTRAINT "workload_ports_exposure_check" CHECK ("exposure" IN ('private', 'public')),
  CONSTRAINT "workload_ports_port_range_check" CHECK ("container_port" BETWEEN 1 AND 65535 AND "host_port" BETWEEN 1 AND 65535),
  CONSTRAINT "workload_ports_workload_container_protocol_uidx" UNIQUE ("workload_id", "container_port", "protocol")
);
CREATE INDEX IF NOT EXISTS "workload_ports_workload_idx" ON "workload_ports" ("workload_id");
