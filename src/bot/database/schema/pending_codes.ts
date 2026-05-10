import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const pendingCodes = sqliteTable('pending_codes', {
  id: integer().primaryKey({ autoIncrement: true }),
  code: text().notNull(),
  discordId: text().references(() => users.discordId),
  foundAt: text().default(sql`CURRENT_TIMESTAMP`),
});

export type PendingCode = typeof pendingCodes.$inferSelect;
