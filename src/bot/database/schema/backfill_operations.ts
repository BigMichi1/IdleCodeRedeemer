import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const backfillOperations = sqliteTable('backfill_operations', {
  id: integer().primaryKey({ autoIncrement: true }),
  initiatedBy: text().notNull(),
  startedAt: text().notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text(),
  codesFound: integer().notNull().default(0),
  codesRedeemed: integer().notNull().default(0),
  status: text({ enum: ['in_progress', 'completed', 'failed'] }).notNull().default('in_progress'),
});

export type BackfillOperation = typeof backfillOperations.$inferSelect;
