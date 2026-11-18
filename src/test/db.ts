import { db } from '../bot/database/db';
import {
  auditLog,
  backfillOperations,
  lootTotals,
  pendingCodes,
  redeemedCodes,
  users,
} from '../bot/database/schema/index';

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
  db.delete(auditLog).run();
  db.delete(pendingCodes).run();
  db.delete(redeemedCodes).run();
  db.delete(lootTotals).run();
  db.delete(backfillOperations).run();
  db.delete(users).run();
}
