CREATE TABLE IF NOT EXISTS builder_runs (
  id uuid PRIMARY KEY,
  workflow jsonb NOT NULL,
  source jsonb NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  secrets jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{"exposedPorts":[],"detectedDockerfiles":{}}'::jsonb,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  attempt integer NOT NULL DEFAULT 0,
  worker_id text,
  lease_expires_at timestamptz,
  cancel_requested boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
ALTER TABLE builder_runs ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{"exposedPorts":[],"detectedDockerfiles":{}}'::jsonb;
ALTER TABLE builder_runs ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE builder_runs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
UPDATE builder_runs SET idempotency_key = id::text WHERE idempotency_key IS NULL;
ALTER TABLE builder_runs ALTER COLUMN idempotency_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS builder_runs_idempotency_uq ON builder_runs (idempotency_key);
CREATE INDEX IF NOT EXISTS builder_runs_queue_idx ON builder_runs (status, created_at) WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS builder_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES builder_runs(id) ON DELETE CASCADE,
  step_id text,
  stream text NOT NULL CHECK (stream IN ('system','stdout','stderr')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS builder_logs_run_idx ON builder_logs (run_id, id);
