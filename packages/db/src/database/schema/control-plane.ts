import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organization } from "./auth.js";
import { applications, projects } from "./projects.js";
import { user } from "./auth.js";

/** API-owned immutable build history. Builder runs are execution details only. */
export const builds = pgTable(
  "builds",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    triggeredBy: text("triggered_by").references(() => user.id, { onDelete: "set null" }),
    trigger: text("trigger", { enum: ["build", "deploy", "retry"] }).notNull(),
    retryOfBuildId: text("retry_of_build_id"),
    sourceType: text("source_type").notNull().default("git"),
    repositoryUrl: text("repository_url").notNull(),
    repositoryProvider: text("repository_provider").notNull().default("generic"),
    branch: text("branch").notNull(),
    commitSha: text("commit_sha"),
    status: text("status", { enum: ["created", "queued", "running", "pushing", "succeeded", "failed", "cancelled"] }).notNull().default("created"),
    builderJobId: text("builder_job_id").unique(),
    buildConfiguration: jsonb("build_configuration").notNull(),
    imageRepository: text("image_repository").notNull(),
    imageTag: text("image_tag").notNull(),
    imageDigest: text("image_digest"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    queuedAt: timestamp("queued_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("builds_application_created_idx").on(table.applicationId, table.createdAt),
    index("builds_project_status_idx").on(table.projectId, table.status),
  ],
);

/** Control-plane representation of a machine. Secrets are stored only as hashes. */
export const nodes = pgTable(
  "nodes",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hostname: text("hostname").notNull(),
    status: text("status", {
      enum: ["provisioning", "ready", "draining", "offline", "unhealthy", "decommissioned"],
    })
      .notNull()
      .default("provisioning"),
    architecture: text("architecture").notNull(),
    os: text("os").notNull(),
    agentVersion: text("agent_version").notNull(),
    region: text("region"),
    labels: jsonb("labels").$type<Record<string, string>>().notNull().default({}),
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    runtimes: jsonb("runtimes").$type<Array<"container" | "microvm">>().notNull().default([]),
    resources: jsonb("resources")
      .$type<{
        cpuMilli: { capacity: number; allocatable: number; reserved: number; usage: number };
        memoryMib: { capacity: number; allocatable: number; reserved: number; usage: number };
        storageMib: { capacity: number; allocatable: number; reserved: number; usage: number };
      } | null>()
      .default(null),
    schedulingEnabled: integer("scheduling_enabled").notNull().default(1),
    agentTokenHash: text("agent_token_hash").notNull().unique(),
    lastHeartbeatAt: timestamp("last_heartbeat_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("nodes_organization_idx").on(table.organizationId),
    index("nodes_status_idx").on(table.status),
  ],
);

/** One-time enrollment secrets. The raw value never enters the database. */
export const nodeRegistrationTokens = pgTable(
  "node_registration_tokens",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("node_registration_tokens_organization_idx").on(table.organizationId)],
);

/** Versioned desired state. A deployment is immutable after creation. */
export const deployments = pgTable(
  "deployments",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    image: text("image").notNull(),
    replicas: integer("replicas").notNull(),
    desiredState: text("desired_state", { enum: ["running", "stopped", "deleted"] }).notNull(),
    runtime: text("runtime", { enum: ["container", "microvm"] }).notNull(),
    requirements: jsonb("requirements").notNull(),
    runtimeConfig: jsonb("runtime_config").notNull().default({}),
    buildId: text("build_id").references(() => builds.id, { onDelete: "restrict" }),
    commitSha: text("commit_sha"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("deployments_application_idx").on(table.applicationId, table.createdAt),
    uniqueIndex("deployments_build_uidx").on(table.buildId),
  ],
);

/** Actual state reports belong to agents; control-plane users only set desired state. */
export const workloads = pgTable(
  "workloads",
  {
    id: text("id").primaryKey(),
    deploymentId: text("deployment_id")
      .notNull()
      .references(() => deployments.id, { onDelete: "cascade" }),
    nodeId: text("node_id").references(() => nodes.id, { onDelete: "set null" }),
    runtimeId: text("runtime_id"),
    schedulingReasons: jsonb("scheduling_reasons").$type<string[]>().notNull().default([]),
    desiredState: text("desired_state", { enum: ["running", "stopped", "deleted"] }).notNull(),
    actualState: text("actual_state", {
      enum: ["pending", "starting", "running", "stopped", "failed", "unknown"],
    })
      .notNull()
      .default("pending"),
    restartCount: integer("restart_count").notNull().default(0),
    lastReportedAt: timestamp("last_reported_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workloads_deployment_idx").on(table.deploymentId),
    index("workloads_node_idx").on(table.nodeId),
  ],
);

/** Durable commands make delivery/retry observable and idempotent via command id. */
export const agentCommands = pgTable(
  "agent_commands",
  {
    id: text("id").primaryKey(),
    nodeId: text("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    resourceId: text("resource_id").notNull(),
    payload: jsonb("payload").notNull(),
    deadlineAt: timestamp("deadline_at"),
    status: text("status", { enum: ["pending", "delivered", "succeeded", "failed"] })
      .notNull()
      .default("pending"),
    result: jsonb("result"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("agent_commands_node_status_idx").on(table.nodeId, table.status)],
);
