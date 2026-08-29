-- Agent retries reuse the sample timestamp. Preserve the first accepted point
-- so a transport timeout cannot duplicate counters in an aggregate.
DELETE FROM "workload_metrics" AS duplicate
USING "workload_metrics" AS retained
WHERE duplicate."workload_id" = retained."workload_id"
  AND duplicate."recorded_at" = retained."recorded_at"
  AND duplicate."id" > retained."id";

CREATE UNIQUE INDEX IF NOT EXISTS "workload_metrics_workload_recorded_uidx"
  ON "workload_metrics" ("workload_id", "recorded_at");
