ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "registry_credential_reference" text;
