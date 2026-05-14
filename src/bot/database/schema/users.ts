import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  discordId: text().primaryKey(),
  userId: text().notNull(),
  userHash: text().notNull(),
  server: text(),
  instanceId: text(),
  autoRedeem: integer({ mode: 'boolean' }).notNull().default(true),
  createdAt: text().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text().default(sql`CURRENT_TIMESTAMP`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
