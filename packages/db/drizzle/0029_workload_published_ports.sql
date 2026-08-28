ALTER TABLE "workloads" ADD COLUMN IF NOT EXISTS "published_ports" jsonb NOT NULL DEFAULT '{}'::jsonb;
