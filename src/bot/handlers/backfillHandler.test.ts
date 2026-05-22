/**
 * End-to-end scenario: startup backfill → user setup → /catchup
 *
 * Reproduces the bug observed in the production logs (2026-05-22):
 *
 *   1. Bot starts with an empty database.
 *   2. Startup backfill runs, finds N codes, but has no registered users to
 *      redeem for → codes should be stored in pending_codes so they survive
 *      until a user registers.
 *   3. User runs /setup (registers credentials).
 *   4. User runs /catchup → expects to see codes available, NOT "No Codes
 *      Available".
 *
 * Secondary scenario: backfill runs after a user is registered but the API
 * returns an error for that user → unredeemed codes must still be persisted
 * as pending so /catchup can pick them up.
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll, spyOn } from 'bun:test';
import { ChannelType } from 'discord.js';
import { db, initializeDatabase } from '../database/db';
import { users, redeemedCodes, pendingCodes, auditLog, backfillOperations } from '../database/schema/index';
import { userManager } from '../database/userManager';
import { codeManager } from '../database/codeManager';
import IdleChampionsApi from '../api/idleChampionsApi';
import { backfillChannelHistory } from './backfillHandler';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CODE_A = 'LATU1234EGIS'; // 12-char code recognised by the scanner
const CODE_B = 'WXYZ5678IJKL';
const USER = 'discord-e2e-user';
const MOCK_SERVER = 'test.idlechampions.com';
const MOCK_INSTANCE = 'inst-e2e-abc';

// ---------------------------------------------------------------------------
// Fake Discord channel
//
// backfillChannelHistory() calls channel.messages.fetch({ limit, before? }).
// The first call returns messages; subsequent calls return an empty collection
// to stop the pagination loop.
//
// If DISCORD_CODE_AUTHOR_ID is set (loaded from .env by Bun), the handler
// only scans messages whose author.id matches. Our fake messages must use
// that ID so they are treated as code candidates.
// ---------------------------------------------------------------------------

const CODE_AUTHOR_ID = process.env.DISCORD_CODE_AUTHOR_ID || 'fake-code-poster';

function makeChannel(codes: string[]): any {
  let fetched = false;

  return {
    type: ChannelType.GuildText,
    name: 'idlecode',
    messages: {
      async fetch(_opts: unknown) {
        if (fetched) {
          // Terminate the pagination loop
          return makeCollection([]);
        }
        fetched = true;
        return makeCollection(
          codes.map((code, i) => ({
            id: String(1_000_000 + i),
            content: code,
            author: { id: CODE_AUTHOR_ID, tag: 'Poster#0001', bot: false },
            webhookId: null,
            createdAt: new Date(),
          }))
        );
      },
    },
  };
}

/** Minimal Map that also exposes `last()` and `size`, matching discord.js Collection. */
function makeCollection(messages: Array<{ id: string; [key: string]: unknown }>) {
  const map = new Map(messages.map((m) => [m.id, m]));
  (map as any).last = () => {
    const vals = [...map.values()];
    return vals[vals.length - 1];
  };
  return map;
}

// ---------------------------------------------------------------------------
// API spies
// ---------------------------------------------------------------------------

const getUserDetailsSpy = spyOn(IdleChampionsApi, 'getUserDetails');
const submitCodeSpy = spyOn(IdleChampionsApi, 'submitCode');
const getServerSpy = spyOn(IdleChampionsApi, 'getServer');

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  initializeDatabase();
});

beforeEach(() => {
  // Wipe tables in FK-safe order.
  db.delete(auditLog).run();
  db.delete(backfillOperations).run();
  db.delete(pendingCodes).run();
  db.delete(redeemedCodes).run();
  db.delete(users).run();

  // Default spy behaviour (override per test as needed).
  getUserDetailsSpy.mockReset();
  submitCodeSpy.mockReset();
  getServerSpy.mockReset();

  getUserDetailsSpy.mockResolvedValue({ details: { instance_id: MOCK_INSTANCE } } as any);
  submitCodeSpy.mockResolvedValue({ codeStatus: 0 } as any);
  getServerSpy.mockResolvedValue(MOCK_SERVER as any);
});

afterAll(() => {
  getUserDetailsSpy.mockRestore();
  submitCodeSpy.mockRestore();
  getServerSpy.mockRestore();
  db.delete(auditLog).run();
  db.delete(backfillOperations).run();
  db.delete(pendingCodes).run();
  db.delete(redeemedCodes).run();
  db.delete(users).run();
});

// ---------------------------------------------------------------------------
// Scenario 1 — startup backfill with NO registered users
// ---------------------------------------------------------------------------

describe('Scenario 1: startup backfill with no users → setup → catchup', () => {
  test('backfill stores unredeemed codes as pending when no users exist', async () => {
    const stats = await backfillChannelHistory(makeChannel([CODE_A, CODE_B]));

    expect(stats.codesFound).toBe(2);
    expect(stats.codesRedeemed).toBe(0);

    // Core assertion: codes must be persisted so /catchup can find them later.
    const stored = await codeManager.getPendingCodes();
    expect(stored).toContain(CODE_A);
    expect(stored).toContain(CODE_B);
  });

  test('codes stored by startup backfill are visible to catchup after user setup', async () => {
    // Phase 1 — startup backfill (no users).
    await backfillChannelHistory(makeChannel([CODE_A, CODE_B]));

    // Phase 2 — user registers (/setup).
    await userManager.saveCredentials({
      discordId: USER,
      userId: '316463',
      userHash: 'f4e6d3dbc34173d23e7d198e4a8fc773',
      server: MOCK_SERVER,
    });

    // Phase 3 — /catchup queries: what codes are available?
    const [validCodes, pending] = await Promise.all([
      codeManager.getAllValidCodes(),
      codeManager.getPendingCodes(),
    ]);

    // No one has successfully redeemed yet → validCodes empty.
    expect(validCodes).toHaveLength(0);

    // The pending codes stored by backfill must be here.
    expect(pending).toContain(CODE_A);
    expect(pending).toContain(CODE_B);

    // Combined (mirrors the dedup logic in catchup.ts).
    const allCodes = Array.from(new Set([...validCodes, ...pending]));
    expect(allCodes).toHaveLength(2);
  });

  test('after user setup the next backfill redeems codes immediately (no pending leftover)', async () => {
    // User is already registered before the backfill this time.
    await userManager.saveCredentials({
      discordId: USER,
      userId: '316463',
      userHash: 'f4e6d3dbc34173d23e7d198e4a8fc773',
      server: MOCK_SERVER,
    });

    const stats = await backfillChannelHistory(makeChannel([CODE_A, CODE_B]));

    expect(stats.codesFound).toBe(2);
    expect(stats.codesRedeemed).toBe(2);

    // Codes were redeemed → isCodeRedeemed returns true → they are NOT stored
    // in pending_codes.
    const pending = await codeManager.getPendingCodes();
    expect(pending).not.toContain(CODE_A);
    expect(pending).not.toContain(CODE_B);

    // They should be in redeemed_codes with Success status.
    expect(await codeManager.isCodeRedeemedByUser(CODE_A, USER)).toBe(true);
    expect(await codeManager.isCodeRedeemedByUser(CODE_B, USER)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — backfill runs after setup but API rejects user details
// (mirrors the "Failed to get user details" warnings in the log)
// ---------------------------------------------------------------------------

describe('Scenario 2: backfill with API failure → codes stay pending for catchup', () => {
  test('stores codes as pending when getUserDetails returns an invalid response', async () => {
    await userManager.saveCredentials({
      discordId: USER,
      userId: '316463',
      userHash: 'f4e6d3dbc34173d23e7d198e4a8fc773',
      server: MOCK_SERVER,
    });

    // Simulate the "not a valid response" warning seen in the logs.
    getUserDetailsSpy.mockResolvedValue({ status: 1 } as any);

    const stats = await backfillChannelHistory(makeChannel([CODE_A, CODE_B]));

    expect(stats.codesFound).toBe(2);
    expect(stats.codesRedeemed).toBe(0);

    // Despite the API failure, codes must be stored so /catchup can retry.
    const pending = await codeManager.getPendingCodes();
    expect(pending).toContain(CODE_A);
    expect(pending).toContain(CODE_B);
  });

  test('/catchup sees codes pending from a failed backfill and can redeem them', async () => {
    await userManager.saveCredentials({
      discordId: USER,
      userId: '316463',
      userHash: 'f4e6d3dbc34173d23e7d198e4a8fc773',
      server: MOCK_SERVER,
    });

    // Backfill fails → codes become pending.
    getUserDetailsSpy.mockResolvedValue({ status: 1 } as any);
    await backfillChannelHistory(makeChannel([CODE_A, CODE_B]));

    // Restore the API for the catchup phase.
    getUserDetailsSpy.mockResolvedValue({ details: { instance_id: MOCK_INSTANCE } } as any);

    // /catchup collects codes the same way the command does.
    const [validCodes, pending] = await Promise.all([
      codeManager.getAllValidCodes(),
      codeManager.getPendingCodes(),
    ]);
    const allCodes = Array.from(new Set([...validCodes, ...pending]));

    // Must NOT be empty — that was the reported bug.
    expect(allCodes.length).toBeGreaterThan(0);
    expect(allCodes).toContain(CODE_A);
    expect(allCodes).toContain(CODE_B);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — idempotency: running backfill twice does not duplicate pending
// ---------------------------------------------------------------------------

describe('Scenario 3: duplicate backfill runs do not create duplicate pending codes', () => {
  test('second backfill run does not insert the same pending code twice', async () => {
    const channel1 = makeChannel([CODE_A]);
    const channel2 = makeChannel([CODE_A]);

    await backfillChannelHistory(channel1);
    await backfillChannelHistory(channel2);

    const pending = await codeManager.getPendingCodes();
    const hits = pending.filter((c) => c === CODE_A);
    expect(hits).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4 — invalid instance_id skips submission but stores codes as pending
// ---------------------------------------------------------------------------

describe('Scenario 4: invalid instance_id skips code submission', () => {
  test('codes become pending when instance_id is missing from user details', async () => {
    await userManager.saveCredentials({
      discordId: USER,
      userId: '316463',
      userHash: 'f4e6d3dbc34173d23e7d198e4a8fc773',
      server: MOCK_SERVER,
    });

    // details object exists but instance_id is absent (falsy → treated as '0')
    getUserDetailsSpy.mockResolvedValue({ details: {} } as any);

    const stats = await backfillChannelHistory(makeChannel([CODE_A, CODE_B]));

    expect(stats.codesRedeemed).toBe(0);
    expect(submitCodeSpy).not.toHaveBeenCalled();

    const pending = await codeManager.getPendingCodes();
    expect(pending).toContain(CODE_A);
    expect(pending).toContain(CODE_B);
  });
});

