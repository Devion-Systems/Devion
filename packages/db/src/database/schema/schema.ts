import { boolean, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { organization, user } from "./auth.js";
import { timestamps } from "./timestamp.js";

export * from "./auth.js";
export * from "./control-plane.js";
export * from "./managed-databases.js";
export * from "./personal.js";
export * from "./projects.js";

export const DEVION_DIR = ".devion";
export const ACTION_FILES = [`${DEVION_DIR}/action.yml`, `${DEVION_DIR}/action.yaml`] as const;

export const ipBlacklist = pgTable("ip_blacklist", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ip: varchar({ length: 45 }).notNull().unique(),
  reason: varchar(),
  ...timestamps,
});

export const system_feature = pgTable("system_feature", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar().notNull().unique(),
  description: text(),
  tier: varchar().notNull().default("standard"),
  isActive: boolean().notNull().default(false),
  licenseSignature: text("license_signature"),
  ...timestamps,
});

export const system_feature_log = pgTable("system_feature_log", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  featureId: integer()
    .notNull()
    .references(() => system_feature.id, { onDelete: "cascade" }),
  action: varchar().notNull(),
  ...timestamps,
});

/** Singleton written only by the one-shot company installation flow. */
export const systemInstallation = pgTable("system_installation", {
  id: integer("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "restrict" }),
  administratorId: text("administrator_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  companyName: text("company_name").notNull(),
  primaryDomain: text("primary_domain"),
  ldapEnabled: boolean("ldap_enabled").default(false).notNull(),
  ldapConfigEncrypted: text("ldap_config_encrypted"),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const buildQueue = pgTable("build_queue", {
  id: text("id").primaryKey(),
  imageName: text("image_name").notNull(),
  sourceType: text("source_type", { enum: ["ZIP", "GIT"] }).notNull(),
  zipBase64: text("zip_base64"),
  gitUrl: text("git_url"),
  workflowYaml: text("workflow_yaml"),
  status: text("status", { enum: ["PENDING", "PROCESSING"] })
    .default("PENDING")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const buildHistory = pgTable("build_history", {
  id: text("id").primaryKey(),
  imageName: text("image_name").notNull(),
  status: text("status", { enum: ["SUCCESS", "FAILED", "TIMEOUT"] }).notNull(),
  logs: text("logs").notNull(),
  durationMs: integer("duration_ms").notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

export const hostedApps = pgTable("hosted_apps", {
  id: text("id").primaryKey(),
  imageName: text("image_name").notNull(),
  containerStatus: text("container_status", { enum: ["READY", "RUNNING", "STOPPED"] })
    .default("READY")
    .notNull(),
  deployedAt: timestamp("deployed_at").defaultNow().notNull(),
});

export type BuildJob = typeof buildQueue.$inferSelect;
