import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const lootTotals = sqliteTable(
  'loot_totals',
  {
    lootKey: text().notNull(),
    lootType: text().notNull(), // 'chest' or 'item'
    scope: text().notNull(), // discordId or '__server__' for server-wide aggregate
    totalCount: integer().notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.lootKey, table.scope] })]
);
