import { describe, test, expect, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { db, initializeDatabase } from '../bot/database/db';
import { userManager } from '../bot/database/userManager';
import { codeManager } from '../bot/database/codeManager';
import { auditManager } from '../bot/database/auditManager';
import { RESET_TABLE_NAMES, resetDatabase } from './db';

// resetDatabase() lists its tables by hand. A table it misses (say a new one
// with a foreign key to users) brings back the order-dependent "FOREIGN KEY
// constraint failed" it exists to prevent, so check it against the real schema.

beforeAll(() => {
  initializeDatabase();
});

function appTables(): string[] {
  return db
    .all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'`
    )
    .map((r) => r.name);
}

describe('resetDatabase', () => {
  test('covers exactly the tables the migrations create', () => {
    // Fails when a migration adds a table: add it to TABLES_IN_DELETE_ORDER,
    // after its children and before any table it references.
    expect(([...RESET_TABLE_NAMES] as string[]).sort()).toEqual(appTables().sort());
  });

  test('empties every application table, child rows included', async () => {
    await userManager.saveCredentials({ discordId: 'reset-user', userId: '1', userHash: 'h' });
    await codeManager.addRedeemedCode('RESETCODE123', 'reset-user', 'Success');
    await codeManager.addPendingCode('RESETCODE456');
    await auditManager.logAction('reset-user', 'VIEWED_INVENTORY', {});

    resetDatabase();

    const tables = appTables();
    for (const name of tables) {
      const [row] = db.all<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM "${name}"`));
      expect({ table: name, rows: row!.n }).toEqual({ table: name, rows: 0 });
    }
  });
});
