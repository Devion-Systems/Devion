import { integer, pgTable, varchar, timestamp, text, boolean } from "drizzle-orm/pg-core";
import { timestamps } from "./timestamp";

export const projects = pgTable("projects", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar().notNull(),
  ...timestamps
});

export const project_members = pgTable("project_members", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer()
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: integer().notNull(),
  role: varchar().notNull(),
  ...timestamps
});

export const projects_settings = pgTable("projects_settings", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer()
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  settings: text().notNull(),
  ...timestamps
});

export const projects_logs = pgTable("projects_logs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer()
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  log: text().notNull(),
  ...timestamps
});

export const projects_invitations = pgTable("projects_invitations", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer()
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  email: varchar().notNull(),
  role: varchar().notNull(),
  token: varchar().notNull(),
  expiresAt: timestamp().notNull(),
  accepted: boolean().default(false),
  ...timestamps
});