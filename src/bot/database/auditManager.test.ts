import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { db, initializeDatabase } from './db';
import { auditManager } from './auditManager';
import { users, redeemedCodes, pendingCodes, auditLog } from './schema/index';

const USER_A = 'audit-user-a';
const USER_B = 'audit-user-b';

beforeAll(() => {
  initializeDatabase();
});

beforeEach(() => {
  // Clear in FK-safe order
  db.delete(pendingCodes).run();
  db.delete(auditLog).run();
  db.delete(redeemedCodes).run();
  db.delete(users).run();
  // Seed users required by FK on audit_log.discord_id
  db.insert(users)
    .values([
      { discordId: USER_A, userId: '111', userHash: 'hash-a' },
      { discordId: USER_B, userId: '222', userHash: 'hash-b' },
    ])
    .run();
});

// ---------------------------------------------------------------------------
// logAction
// ---------------------------------------------------------------------------
describe('logAction', () => {
  test('inserts an audit log entry for a user', async () => {
    await auditManager.logAction(USER_A, 'TEST_ACTION');
    const rows = db.select().from(auditLog).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.discordId).toBe(USER_A);
    expect(rows[0]!.action).toBe('TEST_ACTION');
    expect(rows[0]!.details).toBeNull();
  });

  test('stores JSON-serialised details', async () => {
    await auditManager.logAction(USER_A, 'REDEEM', { code: 'ABCD1234EFGH', status: 'Success' });
    const rows = db.select().from(auditLog).all();
    expect(rows[0]!.details).toBe(JSON.stringify({ code: 'ABCD1234EFGH', status: 'Success' }));
  });

  test('accepts null discordId for system-level actions', async () => {
    await auditManager.logAction(null, 'SYSTEM_START');
    const rows = db.select().from(auditLog).all();
    expect(rows[0]!.discordId).toBeNull();
    expect(rows[0]!.action).toBe('SYSTEM_START');
  });

  test('inserts multiple entries independently', async () => {
    await auditManager.logAction(USER_A, 'ACTION_1');
    await auditManager.logAction(USER_A, 'ACTION_2');
    await auditManager.logAction(USER_B, 'ACTION_3');
    expect(db.select().from(auditLog).all()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// getUserAuditLog
// ---------------------------------------------------------------------------
describe('getUserAuditLog', () => {
  test('returns empty array when user has no log entries', async () => {
    expect(await auditManager.getUserAuditLog(USER_A)).toEqual([]);
  });

  test('returns only entries for the specified user', async () => {
    await auditManager.logAction(USER_A, 'ACTION_A');
    await auditManager.logAction(USER_B, 'ACTION_B');
    const log = await auditManager.getUserAuditLog(USER_A);
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('ACTION_A');
  });

  test('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await auditManager.logAction(USER_A, `ACTION_${i}`);
    }
    const log = await auditManager.getUserAuditLog(USER_A, 3);
    expect(log).toHaveLength(3);
  });

  test('returns both entries when two actions are logged', async () => {
    await auditManager.logAction(USER_A, 'FIRST');
    await auditManager.logAction(USER_A, 'SECOND');
    const log = await auditManager.getUserAuditLog(USER_A);
    expect(log).toHaveLength(2);
    const actions = log.map((e) => e.action);
    expect(actions).toContain('FIRST');
    expect(actions).toContain('SECOND');
  });
});

// ---------------------------------------------------------------------------
// getAllAuditLog
// ---------------------------------------------------------------------------
describe('getAllAuditLog', () => {
  test('returns empty array when no entries exist', async () => {
    expect(await auditManager.getAllAuditLog()).toEqual([]);
  });

  test('returns entries from all users', async () => {
    await auditManager.logAction(USER_A, 'ACTION_A');
    await auditManager.logAction(USER_B, 'ACTION_B');
    await auditManager.logAction(null, 'SYSTEM');
    const log = await auditManager.getAllAuditLog();
    expect(log).toHaveLength(3);
  });

  test('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await auditManager.logAction(USER_A, `ACTION_${i}`);
    }
    const log = await auditManager.getAllAuditLog(2);
    expect(log).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getAuditLogSince
// ---------------------------------------------------------------------------
describe('getAuditLogSince', () => {
  test('returns empty array when no entries exist', async () => {
    expect(await auditManager.getAuditLogSince('2000-01-01 00:00:00')).toEqual([]);
  });

  test('returns entries at or after the given timestamp', async () => {
    await auditManager.logAction(USER_A, 'RECENT_ACTION');
    const log = await auditManager.getAuditLogSince('2000-01-01 00:00:00');
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('RECENT_ACTION');
  });

  test('excludes entries before the given timestamp', async () => {
    await auditManager.logAction(USER_A, 'OLD_ACTION');
    // A future timestamp means nothing should be returned
    const log = await auditManager.getAuditLogSince('2099-01-01 00:00:00');
    expect(log).toHaveLength(0);
  });

  test('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await auditManager.logAction(USER_A, `ACTION_${i}`);
    }
    const log = await auditManager.getAuditLogSince('2000-01-01 00:00:00', 2);
    expect(log).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getAuditLogByAction
// ---------------------------------------------------------------------------
describe('getAuditLogByAction', () => {
  test('returns empty array when no matching entries exist', async () => {
    await auditManager.logAction(USER_A, 'OTHER_ACTION');
    expect(await auditManager.getAuditLogByAction('REDEEM')).toEqual([]);
  });

  test('returns only entries with the specified action', async () => {
    await auditManager.logAction(USER_A, 'REDEEM');
    await auditManager.logAction(USER_B, 'REDEEM');
    await auditManager.logAction(USER_A, 'VIEWED_CODES');
    const log = await auditManager.getAuditLogByAction('REDEEM');
    expect(log).toHaveLength(2);
    expect(log.every((e) => e.action === 'REDEEM')).toBe(true);
  });

  test('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await auditManager.logAction(USER_A, 'REDEEM');
    }
    const log = await auditManager.getAuditLogByAction('REDEEM', 3);
    expect(log).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// deleteUserAuditLog
// ---------------------------------------------------------------------------
describe('deleteUserAuditLog', () => {
  test('is a no-op when the user has no log entries', async () => {
    await auditManager.deleteUserAuditLog(USER_A);
    expect(db.select().from(auditLog).all()).toHaveLength(0);
  });

  test('removes all audit log entries for the specified user', async () => {
    await auditManager.logAction(USER_A, 'ACTION_1');
    await auditManager.logAction(USER_A, 'ACTION_2');
    await auditManager.deleteUserAuditLog(USER_A);
    expect(db.select().from(auditLog).all()).toHaveLength(0);
  });

  test('only removes entries belonging to the specified user', async () => {
    await auditManager.logAction(USER_A, 'ACTION_A');
    await auditManager.logAction(USER_B, 'ACTION_B');
    await auditManager.deleteUserAuditLog(USER_A);
    const remaining = db.select().from(auditLog).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.discordId).toBe(USER_B);
  });

  test('does not delete system-level (null discordId) entries', async () => {
    await auditManager.logAction(null, 'SYSTEM_ACTION');
    await auditManager.logAction(USER_A, 'USER_ACTION');
    await auditManager.deleteUserAuditLog(USER_A);
    const remaining = db.select().from(auditLog).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.discordId).toBeNull();
  });

  test('after deletion getUserAuditLog returns empty for that user', async () => {
    await auditManager.logAction(USER_A, 'ACTION_1');
    await auditManager.deleteUserAuditLog(USER_A);
    expect(await auditManager.getUserAuditLog(USER_A)).toEqual([]);
  });
});
