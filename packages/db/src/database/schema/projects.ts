import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organization, team, user } from "./auth.js";

/** Projects are always scoped to an organization and can optionally belong to a team. */
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => team.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    sourceType: text("source_type", { enum: ["git", "docker", "blank"] }).notNull(),
    gitUrl: text("git_url"),
    branch: text("branch").default("main").notNull(),
    // Set only by the deployment runtime; never accept this from dashboard users.
    routingTargetUrl: text("routing_target_url"),
    status: text("status", { enum: ["healthy", "degraded", "failing", "idle"] })
      .default("idle")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("projects_organization_slug_uidx").on(table.organizationId, table.slug),
    index("projects_organization_idx").on(table.organizationId),
    index("projects_team_idx").on(table.teamId),
  ],
);

/** Custom hostnames assigned to a project environment. */
export const projectDomains = pgTable(
  "project_domains",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    environment: text("environment").default("production").notNull(),
    status: text("status", { enum: ["pending", "active", "failed"] })
      .default("pending")
      .notNull(),
    sslExpiresAt: timestamp("ssl_expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_domains_project_hostname_uidx").on(table.projectId, table.hostname),
    index("project_domains_organization_idx").on(table.organizationId),
    index("project_domains_project_idx").on(table.projectId),
  ],
);
