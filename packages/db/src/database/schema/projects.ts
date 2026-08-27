import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, team, user } from "./auth.js";

/** Projects are always scoped to exactly one organization. */
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Legacy single-team assignment. New access rules use projectTeams; retain
    // this column during the compatibility migration so existing installs keep
    // their assignments until they have been copied.
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
    status: text("status", { enum: ["active", "archived"] })
      .default("active")
      .notNull(),
    accessMode: text("access_mode", { enum: ["organization", "team"] })
      .default("organization")
      .notNull(),
    archivedAt: timestamp("archived_at"),
    // Kept without a database FK to avoid a circular projects ↔ environments
    // constraint. The API validates it belongs to this project.
    defaultEnvironmentId: text("default_environment_id"),
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

/** Multiple teams may be granted access to a team-scoped project. */
export const projectTeams = pgTable(
  "project_teams",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    assignedByUserId: text("assigned_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_teams_project_team_uidx").on(table.projectId, table.teamId),
    index("project_teams_project_idx").on(table.projectId),
    index("project_teams_team_idx").on(table.teamId),
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

/**
 * An application is a deployable unit inside a project. Runtime state is
 * intentionally only updated by a future deployment service, never by a
 * dashboard request.
 */
export const applications = pgTable(
  "applications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    sourceType: text("source_type", { enum: ["git", "docker"] }).notNull(),
    gitUrl: text("git_url"),
    imageName: text("image_name"),
    containerName: text("container_name").unique(),
    internalPort: integer("internal_port").default(3000).notNull(),
    branch: text("branch").default("main").notNull(),
    repositoryProvider: text("repository_provider").default("generic").notNull(),
    rootDirectory: text("root_directory").default(".").notNull(),
    buildConfiguration: jsonb("build_configuration").$type<Record<string, unknown>>().default({}).notNull(),
    autoDeployEnabled: boolean("auto_deploy_enabled").default(false).notNull(),
    gitCredentialReference: text("git_credential_reference"),
    lastKnownCommit: text("last_known_commit"),
    status: text("status", {
      enum: ["draft", "ready", "deploying", "healthy", "degraded", "failed", "stopped"],
    })
      .default("draft")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("applications_project_slug_uidx").on(table.projectId, table.slug),
    index("applications_organization_idx").on(table.organizationId),
    index("applications_project_idx").on(table.projectId),
  ],
);

/** Immutable lifecycle events emitted by the application runtime. */
export const applicationDeployments = pgTable(
  "application_deployments",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action", { enum: ["deploy", "stop"] }).notNull(),
    status: text("status", { enum: ["succeeded", "failed"] }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("application_deployments_application_idx").on(table.applicationId, table.createdAt),
  ],
);

/** Whitelisted game-server workloads; arbitrary images are deliberately not accepted. */
export const gameServers = pgTable(
  "game_servers",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    applicationId: text("application_id")
      .references(() => applications.id, { onDelete: "set null" })
      .unique(),
    deploymentId: text("deployment_id"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    game: text("game", { enum: ["minecraft-java"] }).notNull(),
    version: text("version").default("LATEST").notNull(),
    memoryMib: integer("memory_mib").default(2048).notNull(),
    containerName: text("container_name").notNull().unique(),
    runtimePort: integer("runtime_port"),
    status: text("status", { enum: ["provisioning", "running", "stopped", "failed"] })
      .default("provisioning")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("game_servers_organization_idx").on(table.organizationId),
    index("game_servers_project_idx").on(table.projectId),
  ],
);

/** Per-server RBAC grants can target one person or an entire organization team. */
export const gameServerAccess = pgTable(
  "game_server_access",
  {
    id: text("id").primaryKey(),
    gameServerId: text("game_server_id")
      .notNull()
      .references(() => gameServers.id, { onDelete: "cascade" }),
    subjectType: text("subject_type", { enum: ["user", "team"] }).notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => team.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["viewer", "operator", "admin"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("game_server_access_server_idx").on(table.gameServerId),
    index("game_server_access_user_idx").on(table.userId),
    index("game_server_access_team_idx").on(table.teamId),
  ],
);

/** Persisted deployment configuration. Runtime facts are supplied by agents separately. */
export const projectEnvironments = pgTable(
  "project_environments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    protected: boolean("protected").default(false).notNull(),
    branch: text("branch").default("main").notNull(),
    autoDeployEnabled: boolean("auto_deploy_enabled").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_environments_project_slug_uidx").on(table.projectId, table.slug),
    index("project_environments_organization_idx").on(table.organizationId),
    index("project_environments_project_idx").on(table.projectId),
  ],
);

/** Values are encrypted by the API before persistence; secrets are never returned. */
export const environmentVariables = pgTable(
  "environment_variables",
  {
    id: text("id").primaryKey(),
    environmentId: text("environment_id")
      .notNull()
      .references(() => projectEnvironments.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    valueEncrypted: text("value_encrypted").notNull(),
    isSecret: boolean("is_secret").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("environment_variables_environment_key_uidx").on(table.environmentId, table.key),
    index("environment_variables_environment_idx").on(table.environmentId),
  ],
);
