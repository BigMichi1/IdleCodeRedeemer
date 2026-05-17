import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import { db, initializeDatabase } from './db';
import { backfillOperations } from './schema/index';
import { backfillManager } from './backfillManager';

const USER_A = 'discord-backfill-a';
const USER_B = 'discord-backfill-b';

beforeAll(() => {
  initializeDatabase();
});

beforeEach(() => {
  db.delete(backfillOperations).run();
  // Reset the in-memory lock by force if any test left it set.
  // We do this by exploiting the fact that updateBackfill resets backfillInProgress.
  // If the flag is stuck, insert a dummy row and complete it.
  if (backfillManager.isBackfillInProgress()) {
    const row = db
      .insert(backfillOperations)
      .values({ initiatedBy: '__reset__', status: 'in_progress' })
      .returning({ id: backfillOperations.id })
      .get();
    if (row) {
      backfillManager.updateBackfill(row.id, 0, 0, 'completed');
    }
    db.delete(backfillOperations).run();
  }
});

afterAll(() => {
  db.delete(backfillOperations).run();
});

// ---------------------------------------------------------------------------
// isBackfillInProgress
// ---------------------------------------------------------------------------
describe('isBackfillInProgress', () => {
  test('returns false when no backfill is running', () => {
    expect(backfillManager.isBackfillInProgress()).toBe(false);
  });

  test('returns true after startBackfill is called', async () => {
    await backfillManager.startBackfill(USER_A);
    expect(backfillManager.isBackfillInProgress()).toBe(true);
    // Clean up the flag
    const rows = db.select().from(backfillOperations).all();
    await backfillManager.updateBackfill(rows[0]!.id, 0, 0, 'completed');
  });

  test('returns false after updateBackfill completes', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id, 5, 3, 'completed');
    expect(backfillManager.isBackfillInProgress()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// startBackfill
// ---------------------------------------------------------------------------
describe('startBackfill', () => {
  test('inserts an in_progress row and returns its id', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    expect(id).toBeGreaterThan(0);
    const rows = db.select().from(backfillOperations).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.initiatedBy).toBe(USER_A);
    expect(rows[0]!.status).toBe('in_progress');
    await backfillManager.updateBackfill(id, 0, 0, 'completed');
  });

  test('throws when a backfill is already in progress', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    await expect(backfillManager.startBackfill(USER_B)).rejects.toThrow(
      'A backfill operation is already in progress'
    );
    await backfillManager.updateBackfill(id, 0, 0, 'completed');
  });
});

// ---------------------------------------------------------------------------
// updateBackfill
// ---------------------------------------------------------------------------
describe('updateBackfill', () => {
  test('updates row with codesFound and codesRedeemed', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id, 10, 7, 'completed');
    const row = db.select().from(backfillOperations).get();
    expect(row?.codesFound).toBe(10);
    expect(row?.codesRedeemed).toBe(7);
    expect(row?.status).toBe('completed');
  });

  test('marks status as failed', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id, 0, 0, 'failed');
    const row = db.select().from(backfillOperations).get();
    expect(row?.status).toBe('failed');
  });

  test('resets backfillInProgress flag', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    expect(backfillManager.isBackfillInProgress()).toBe(true);
    await backfillManager.updateBackfill(id, 0, 0, 'completed');
    expect(backfillManager.isBackfillInProgress()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getBackfillById
// ---------------------------------------------------------------------------
describe('getBackfillById', () => {
  test('returns undefined for non-existent id', async () => {
    const result = await backfillManager.getBackfillById(9999);
    expect(result).toBeUndefined();
  });

  test('returns the row with the matching id', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id, 3, 2, 'completed');
    const row = await backfillManager.getBackfillById(id);
    expect(row).toBeDefined();
    expect(row!.id).toBe(id);
    expect(row!.initiatedBy).toBe(USER_A);
    expect(row!.codesFound).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getLastBackfill
// ---------------------------------------------------------------------------
describe('getLastBackfill', () => {
  test('returns undefined when no completed backfills exist', async () => {
    expect(await backfillManager.getLastBackfill()).toBeUndefined();
  });

  test('returns undefined when only in_progress operations exist', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    expect(await backfillManager.getLastBackfill()).toBeUndefined();
    await backfillManager.updateBackfill(id, 0, 0, 'completed');
  });

  test('returns a completed backfill when one exists', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id, 5, 3, 'completed');
    const last = await backfillManager.getLastBackfill();
    expect(last).toBeDefined();
    expect(last!.status).toBe('completed');
    expect(last!.codesFound).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// canUserInitiateBackfill
// ---------------------------------------------------------------------------
describe('canUserInitiateBackfill', () => {
  test('returns true when user has no previous backfills', async () => {
    expect(await backfillManager.canUserInitiateBackfill(USER_A)).toBe(true);
  });

  test('returns false immediately after a completed backfill (within 1-hour window)', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id, 0, 0, 'completed');
    // completedAt is CURRENT_TIMESTAMP — definitely within 1 hour
    expect(await backfillManager.canUserInitiateBackfill(USER_A)).toBe(false);
  });

  test('returns true for a different user even if USER_A is within cooldown', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id, 0, 0, 'completed');
    expect(await backfillManager.canUserInitiateBackfill(USER_B)).toBe(true);
  });

  test('returns true when user only has in_progress or failed operations', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id, 0, 0, 'failed');
    expect(await backfillManager.canUserInitiateBackfill(USER_A)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldRunStartupBackfill
// ---------------------------------------------------------------------------
describe('shouldRunStartupBackfill', () => {
  test('returns true when no backfills have ever run', async () => {
    expect(await backfillManager.shouldRunStartupBackfill()).toBe(true);
  });

  test('returns false immediately after a recent completed backfill (within 6-hour window)', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id, 0, 0, 'completed');
    expect(await backfillManager.shouldRunStartupBackfill()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasUserBackfillOperations
// ---------------------------------------------------------------------------
describe('hasUserBackfillOperations', () => {
  test('returns false when user has no backfill operations', async () => {
    expect(await backfillManager.hasUserBackfillOperations(USER_A)).toBe(false);
  });

  test('returns true when user has at least one operation', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    expect(await backfillManager.hasUserBackfillOperations(USER_A)).toBe(true);
    await backfillManager.updateBackfill(id, 0, 0, 'completed');
  });

  test('returns false for a different user', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    expect(await backfillManager.hasUserBackfillOperations(USER_B)).toBe(false);
    await backfillManager.updateBackfill(id, 0, 0, 'completed');
  });
});

// ---------------------------------------------------------------------------
// hasUserActiveBackfill
// ---------------------------------------------------------------------------
describe('hasUserActiveBackfill', () => {
  test('returns false when no active backfill exists for user', async () => {
    expect(await backfillManager.hasUserActiveBackfill(USER_A)).toBe(false);
  });

  test('returns true when user has an in_progress backfill', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    expect(await backfillManager.hasUserActiveBackfill(USER_A)).toBe(true);
    await backfillManager.updateBackfill(id, 0, 0, 'completed');
  });

  test('returns false after the backfill completes', async () => {
    const id = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id, 0, 0, 'completed');
    expect(await backfillManager.hasUserActiveBackfill(USER_A)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deleteUserBackfillOperations
// ---------------------------------------------------------------------------
describe('deleteUserBackfillOperations', () => {
  test('returns 0 when user has no operations', async () => {
    const count = await backfillManager.deleteUserBackfillOperations(USER_A);
    expect(count).toBe(0);
  });

  test('deletes all operations for the user and returns the count', async () => {
    const id1 = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id1, 1, 1, 'completed');
    const id2 = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(id2, 2, 2, 'completed');
    const count = await backfillManager.deleteUserBackfillOperations(USER_A);
    expect(count).toBe(2);
    expect(db.select().from(backfillOperations).all()).toHaveLength(0);
  });

  test('does not delete operations belonging to another user', async () => {
    const idA = await backfillManager.startBackfill(USER_A);
    await backfillManager.updateBackfill(idA, 0, 0, 'completed');
    const idB = await backfillManager.startBackfill(USER_B);
    await backfillManager.updateBackfill(idB, 0, 0, 'completed');
    await backfillManager.deleteUserBackfillOperations(USER_A);
    const remaining = db.select().from(backfillOperations).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.initiatedBy).toBe(USER_B);
  });
});
