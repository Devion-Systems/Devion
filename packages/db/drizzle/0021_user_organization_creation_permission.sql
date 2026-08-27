ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "can_create_organizations" boolean DEFAULT false NOT NULL;
