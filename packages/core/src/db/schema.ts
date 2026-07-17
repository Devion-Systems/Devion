import { integer, pgTable, varchar, timestamp } from "drizzle-orm/pg-core";


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