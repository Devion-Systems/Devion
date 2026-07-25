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

export const system_feature = pgTable("system_feature", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar().notNull().unique(),
  description: text(),
  tier: varchar().notNull().default("standard"), // Steuert das Lizenz-Paket
  
  // Lokal vom Kunden umschaltbar (z.B. um ein Feature zu deaktivieren, das er nicht nutzen will)
  isActive: boolean().notNull().default(false), 
  
  // Kryptografischer Schutz gegen Manipulation durch den Kunden
  licenseSignature: text("license_signature"), 
  
   ...timestamps
});

export const system_feature_log = pgTable("system_feature_log", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  featureId: integer()
    .notNull()
    .references(() => system_feature.id, { onDelete: "cascade" }),
  action: varchar().notNull(), // "activated" oder "deactivated"
  ...timestamps
});




export const buildQueue = pgTable("build_queue", {
  id: text("id").primaryKey(),
  imageName: text("image_name").notNull(),
  zipBase64: text("zip_base64").notNull(), // Zip-Datei direkt in der DB (oder Pfad/S3)
  dockerfile: text("dockerfile").default("Dockerfile").notNull(),
  status: text("status", { enum: ["PENDING", "PROCESSING"] }).default("PENDING").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const buildHistory = pgTable("build_history", {
  id: text("id").primaryKey(),
  imageName: text("image_name").notNull(),
  status: text("status", { enum: ["SUCCESS", "FAILED"] }).notNull(),
  logs: text("logs").notNull(),
  durationMs: integer("duration_ms").notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});