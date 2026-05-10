import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const auditLog = sqliteTable('audit_log', {
  id: integer().primaryKey({ autoIncrement: true }),
  discordId: text().references(() => users.discordId),
  action: text().notNull(),
  details: text(),
  createdAt: text().default(sql`CURRENT_TIMESTAMP`),
});

export type AuditLogEntry = typeof auditLog.$inferSelect;
