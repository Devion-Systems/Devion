CREATE TABLE IF NOT EXISTS "device_code" (
  "id" text PRIMARY KEY NOT NULL,
  "device_code" text NOT NULL,
  "user_code" text NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE cascade,
  "client_id" text,
  "scope" text,
  "status" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "last_polled_at" timestamp,
  "polling_interval" integer
);
CREATE UNIQUE INDEX IF NOT EXISTS "device_code_device_code_unique" ON "device_code" ("device_code");
CREATE UNIQUE INDEX IF NOT EXISTS "device_code_user_code_unique" ON "device_code" ("user_code");
CREATE INDEX IF NOT EXISTS "deviceCode_userId_idx" ON "device_code" ("user_id");
