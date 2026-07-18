import { integer, pgTable, varchar, timestamp, text, boolean } from "drizzle-orm/pg-core";


export const timestamps = {
  updated_at: timestamp(),
  created_at: timestamp().defaultNow().notNull(),
  deleted_at: timestamp(),
}

export const projects = pgTable("projects", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar().notNull(),
    ...timestamps
});

export const ipBlacklist = pgTable("ip_blacklist", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ip: varchar({ length: 45 }).notNull().unique(), 
  reason: varchar(),
  ...timestamps
});

// Multi-tenant / auth related tables
export const tenants = pgTable("tenants", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar().notNull(),
  slug: varchar().notNull().unique(),
  metadata: text(),
  ...timestamps,
});

export const organizations = pgTable("organizations", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  tenant_id: integer().notNull(),
  name: varchar().notNull(),
  slug: varchar().notNull(),
  metadata: text(),
  ...timestamps,
});

export const org_memberships = pgTable("org_memberships", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  org_id: integer().notNull(),
  user_id: varchar().notNull(), // better-auth user id (string/uuid)
  role: varchar().default("member"),
  is_owner: boolean().default(false),
  ...timestamps,
});

export const api_keys = pgTable("api_keys", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  org_id: integer(),
  user_id: varchar(),
  name: varchar().notNull(),
  key_hash: varchar().notNull(),
  revoked: boolean().default(false),
  scopes: text(),
  ...timestamps,
});

export const refresh_tokens = pgTable("refresh_tokens", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  user_id: varchar().notNull(),
  token_hash: varchar().notNull(),
  revoked: boolean().default(false),
  expires_at: timestamp(),
  ...timestamps,
});

export const builder_jobs = pgTable("builder_jobs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  owner_user_id: varchar().notNull(),
  org_id: integer(),
  project_id: integer(),
  status: varchar().default("pending"),
  logs: text(),
  started_at: timestamp(),
  finished_at: timestamp(),
  ...timestamps,
});
