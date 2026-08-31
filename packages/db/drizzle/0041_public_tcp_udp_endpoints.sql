-- advertised_address remains the Traefik upstream address. Direct L4 public
-- exposure is opt-in and never inferred from a Docker or management address.
ALTER TABLE "nodes"
  ADD COLUMN IF NOT EXISTS "public_networking_enabled" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "public_address" text;
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_public_networking_address_check"
  CHECK ("public_networking_enabled" IN (0, 1) AND ("public_networking_enabled" = 0 OR "public_address" IS NOT NULL));

ALTER TABLE "application_ports"
  ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();

ALTER TABLE "workload_ports"
  ADD COLUMN IF NOT EXISTS "node_id" text REFERENCES "nodes"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "bind_address" text,
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'bound',
  ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
UPDATE "workload_ports" AS port
SET "node_id" = workload."node_id"
FROM "workloads" AS workload
WHERE port."workload_id" = workload."id" AND port."node_id" IS NULL;
ALTER TABLE "workload_ports" ADD CONSTRAINT "workload_ports_status_check"
  CHECK ("status" IN ('reserved', 'bound', 'released'));
CREATE INDEX IF NOT EXISTS "workload_ports_node_status_idx"
  ON "workload_ports" ("node_id", "status");

ALTER TABLE "node_port_reservations"
  ADD COLUMN IF NOT EXISTS "bound_at" timestamp,
  ADD COLUMN IF NOT EXISTS "released_at" timestamp;
