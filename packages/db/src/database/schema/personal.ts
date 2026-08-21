import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
export const auditLogs = pgTable("audit_logs", { id: text("id").primaryKey(), actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }), action: text("action").notNull(), targetType: text("target_type").notNull(), targetId: text("target_id"), metadata: text("metadata"), ipAddress: text("ip_address"), createdAt: timestamp("created_at").defaultNow().notNull() });
