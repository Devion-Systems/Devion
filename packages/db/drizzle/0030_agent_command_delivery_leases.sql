ALTER TABLE "agent_commands"
  ADD COLUMN IF NOT EXISTS "delivered_at" timestamp,
  ADD COLUMN IF NOT EXISTS "delivery_attempts" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "agent_commands_node_delivery_lease_idx"
  ON "agent_commands" ("node_id", "status", "delivered_at");
