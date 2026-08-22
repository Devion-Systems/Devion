CREATE TABLE "game_server_access" (
  "id" text PRIMARY KEY NOT NULL,
  "game_server_id" text NOT NULL REFERENCES "game_servers"("id") ON DELETE cascade,
  "subject_type" text NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE cascade,
  "team_id" text REFERENCES "team"("id") ON DELETE cascade,
  "role" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "game_server_access_subject_check" CHECK (
    ("subject_type" = 'user' AND "user_id" IS NOT NULL AND "team_id" IS NULL)
    OR ("subject_type" = 'team' AND "team_id" IS NOT NULL AND "user_id" IS NULL)
  )
);
CREATE UNIQUE INDEX "game_server_access_user_unique" ON "game_server_access" ("game_server_id", "user_id") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "game_server_access_team_unique" ON "game_server_access" ("game_server_id", "team_id") WHERE "team_id" IS NOT NULL;
CREATE INDEX "game_server_access_server_idx" ON "game_server_access" ("game_server_id");
CREATE INDEX "game_server_access_user_idx" ON "game_server_access" ("user_id");
CREATE INDEX "game_server_access_team_idx" ON "game_server_access" ("team_id");
