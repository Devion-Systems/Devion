import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organization, user } from "./auth.js";

export const managedDatabases = pgTable(
  "managed_databases",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    engine: text("engine", { enum: ["postgresql", "mysql", "redis"] }).notNull(),
    version: text("version").notNull(),
    plan: text("plan", { enum: ["starter", "standard", "performance"] })
      .default("starter")
      .notNull(),
    status: text("status", { enum: ["provisioning", "ready", "failed", "stopped"] })
      .default("provisioning")
      .notNull(),
    region: text("region").default("local").notNull(),
    maintenanceWindow: text("maintenance_window").default("Sunday 02:00 UTC").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("managed_databases_organization_name_uidx").on(table.organizationId, table.name),
    index("managed_databases_organization_idx").on(table.organizationId),
  ],
);
