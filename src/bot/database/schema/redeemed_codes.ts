import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const redeemedCodes = sqliteTable('redeemed_codes', {
  id: integer().primaryKey({ autoIncrement: true }),
  code: text().notNull().unique(),
  discordId: text().references(() => users.discordId),
  redeemedAt: text().default(sql`CURRENT_TIMESTAMP`),
  status: text(),
  lootDetail: text(),
  isPublic: integer().default(0),
  expiresAt: text(),
});

export type RedeemedCode = typeof redeemedCodes.$inferSelect;
export type NewRedeemedCode = typeof redeemedCodes.$inferInsert;
