import { getTableName } from 'drizzle-orm';
import { db } from '../bot/database/db';
import {
  auditLog,
  backfillOperations,
  lootTotals,
  pendingCodes,
  redeemedCodes,
  users,
} from '../bot/database/schema/index';

/** Every application table, children before `users` (the FK parent). */
const TABLES_IN_DELETE_ORDER = [
  auditLog,
  pendingCodes,
  redeemedCodes,
  lootTotals,
  backfillOperations,
  users,
] as const;

/** SQL names of the tables resetDatabase() empties; checked against the schema. */
export const RESET_TABLE_NAMES = TABLES_IN_DELETE_ORDER.map((t) => getTableName(t));

/**
 * Empties every table, children before `users`.
 *
 * Bun runs test files in one process against a shared in-memory database, in
 * an order that differs between machines. A suite that wiped only the tables it
 * wrote to (e.g. audit_log and users) failed with "FOREIGN KEY constraint
 * failed" whenever an earlier file had left redeemed_codes or pending_codes
 * rows behind: it passed locally and on the PR, then failed on main.
 */
export function resetDatabase(): void {
  for (const table of TABLES_IN_DELETE_ORDER) db.delete(table).run();
}
