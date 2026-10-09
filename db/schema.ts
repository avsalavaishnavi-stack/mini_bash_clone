import { index, integer, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Workspace } from "../lib/terminal.js";

export const terminalWorkspaces = pgTable("terminal_workspaces", {
    id: uuid("id").primaryKey(),
    state: jsonb("state").$type<Workspace>().notNull(),
    version: integer("version").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
}, (table) => [index("terminal_workspaces_expires_at_idx").on(table.expiresAt)]);
