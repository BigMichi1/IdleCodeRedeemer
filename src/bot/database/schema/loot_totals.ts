import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

/** The two kinds of loot a code can award. */
export const LOOT_TYPES = ['chest', 'item'] as const;
export type LootType = (typeof LOOT_TYPES)[number];

export const lootTotals = sqliteTable(
  'loot_totals',
  {
    lootKey: text().notNull(),
    lootType: text({ enum: LOOT_TYPES }).notNull(),
    /** A discordId, or SERVER_SCOPE for the anonymised server-wide aggregate. */
    scope: text().notNull(),
    totalCount: integer().notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.lootKey, table.scope] })]
);

export type LootTotal = typeof lootTotals.$inferSelect;
