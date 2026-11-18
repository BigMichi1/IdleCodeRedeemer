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
import {
  users,
  redeemedCodes,
  pendingCodes,
  auditLog,
  backfillOperations,
} from '../database/schema/index';
import { userManager } from '../database/userManager';
import { codeManager } from '../database/codeManager';
import IdleChampionsApi, { ResponseStatus } from '../api/idleChampionsApi';
import { backfillChannelHistory } from './backfillHandler';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CODE_A = 'LATU1234EGIS'; // 12-char code recognised by the scanner
const CODE_B = 'WXYZ5678IJKL';
const USER = 'discord-e2e-user';
const MOCK_SERVER = 'test.idlechampions.com';
const MOCK_INSTANCE = 'inst-e2e-abc';
const TEST_USER_ID = '12345';
const TEST_USER_HASH = 'test-user-hash';

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
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
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
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
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
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
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
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
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
// Scenario 4 — invalid instance_id aborts that user (recorded in stats.errors)
// but stores codes as pending
// ---------------------------------------------------------------------------

describe('Scenario 4: invalid instance_id aborts the user', () => {
  test('codes become pending when instance_id is missing from user details', async () => {
    await userManager.saveCredentials({
      discordId: USER,
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
      server: MOCK_SERVER,
    });

    // details object exists but instance_id is absent → resolveGameSession rejects it
    getUserDetailsSpy.mockResolvedValue({ details: {} } as any);

    const stats = await backfillChannelHistory(makeChannel([CODE_A, CODE_B]));

    expect(stats.codesRedeemed).toBe(0);
    expect(submitCodeSpy).not.toHaveBeenCalled();
    // Per-user, not per-code: one lookup, one recorded error, not one per code.
    expect(getUserDetailsSpy).toHaveBeenCalledTimes(1);
    expect(stats.errors).toHaveLength(1);
    expect(stats.errors[0]).toContain('Could not find an active game session');

    const pending = await codeManager.getPendingCodes();
    expect(pending).toContain(CODE_A);
    expect(pending).toContain(CODE_B);
  });
});

// ---------------------------------------------------------------------------
// Consent and accounting
// ---------------------------------------------------------------------------

describe('backfill respects user preferences and counts honestly', () => {
  test('does not redeem for a user who turned auto-redeem off', async () => {
    // Regression: backfill used getAllUsers(), so a user who ran
    // /autoredeem off still had codes redeemed against their game account on
    // every startup backfill and every admin /backfill.
    await userManager.saveCredentials({
      discordId: USER,
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
      server: MOCK_SERVER,
    });
    await userManager.setAutoRedeem(USER, false);

    const stats = await backfillChannelHistory(makeChannel([CODE_A]));

    expect(submitCodeSpy).not.toHaveBeenCalled();
    expect(stats.codesRedeemed).toBe(0);
    // The code is still captured for later, just not acted on for this user.
    expect(await codeManager.getPendingCodes()).toContain(CODE_A);
  });

  test('still redeems for a user who left auto-redeem on', async () => {
    await userManager.saveCredentials({
      discordId: USER,
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
      server: MOCK_SERVER,
    });

    const stats = await backfillChannelHistory(makeChannel([CODE_A]));

    expect(submitCodeSpy).toHaveBeenCalled();
    expect(stats.codesRedeemed).toBe(1);
  });

  test('does not count a rejected code as redeemed', async () => {
    // Regression: every CodeSubmitResponse carries a codeStatus, so counting
    // them all reported "Codes Redeemed: N" for a run that redeemed nothing.
    await userManager.saveCredentials({
      discordId: USER,
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
      server: MOCK_SERVER,
    });
    submitCodeSpy.mockResolvedValue({ codeStatus: 3 } as any); // Not a Valid Code

    const stats = await backfillChannelHistory(makeChannel([CODE_A]));

    expect(submitCodeSpy).toHaveBeenCalled();
    expect(stats.codesRedeemed).toBe(0);
  });

  test('records an error when the API returns an infrastructure failure', async () => {
    // Regression: GenericResponse fell through with no log and no error, so the
    // operation was written as "completed" despite redeeming nothing.
    await userManager.saveCredentials({
      discordId: USER,
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
      server: MOCK_SERVER,
    });
    submitCodeSpy.mockResolvedValue({ status: 2 } as any); // GenericResponse(Failed)

    const stats = await backfillChannelHistory(makeChannel([CODE_A]));

    expect(stats.codesRedeemed).toBe(0);
    expect(stats.errors.length).toBeGreaterThan(0);
  });
});

describe('backfill follows a play-server switch', () => {
  // Regression: backfill read getUserDetails itself and only checked for
  // `details`, so a SwitchServer redirect was logged as "invalid credentials
  // or API failure" and every registered user was skipped.
  const NEW_SERVER = 'https://pslt1.idlechampions.com/~idledragons/post.php';

  test('redeems on the new server and persists it', async () => {
    await userManager.saveCredentials({
      discordId: USER,
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
      server: MOCK_SERVER,
    });
    getUserDetailsSpy
      .mockResolvedValueOnce({ status: ResponseStatus.SwitchServer, newServer: NEW_SERVER } as any)
      .mockResolvedValue({ details: { instance_id: MOCK_INSTANCE } } as any);

    const stats = await backfillChannelHistory(makeChannel([CODE_A, CODE_B]));

    expect(stats.errors).toEqual([]);
    expect(stats.codesRedeemed).toBe(2);
    for (const call of submitCodeSpy.mock.calls) {
      expect(call[0].server).toBe(NEW_SERVER);
    }
    expect((await userManager.getCredentials(USER))?.server).toBe(NEW_SERVER);
  });

  test('each user keeps their own server when only one was moved', async () => {
    // `server` is per-user state; hoisting it out of the user loop would send
    // the second user's codes to the first user's new server.
    const OTHER = 'discord-e2e-other';
    await userManager.saveCredentials({
      discordId: USER,
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
      server: MOCK_SERVER,
    });
    await userManager.saveCredentials({
      discordId: OTHER,
      userId: '67890',
      userHash: 'other-user-hash',
      server: MOCK_SERVER,
    });
    getUserDetailsSpy.mockImplementation((async (opts: any) =>
      opts.user_id === TEST_USER_ID && opts.server === MOCK_SERVER
        ? { status: ResponseStatus.SwitchServer, newServer: NEW_SERVER }
        : { details: { instance_id: MOCK_INSTANCE } }) as any);

    await backfillChannelHistory(makeChannel([CODE_A]));

    const serverFor = (userId: string) =>
      submitCodeSpy.mock.calls.find((c) => c[0].user_id === userId)?.[0].server;
    expect(serverFor(TEST_USER_ID)).toBe(NEW_SERVER);
    expect(serverFor('67890')).toBe(MOCK_SERVER);
  });
});

describe('backfill session failures', () => {
  test('looks a missing server up once and carries it across codes', async () => {
    await userManager.saveCredentials({
      discordId: USER,
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
    });

    const stats = await backfillChannelHistory(makeChannel([CODE_A, CODE_B]));

    expect(getServerSpy).toHaveBeenCalledTimes(1);
    expect(stats.codesRedeemed).toBe(2);
    expect((await userManager.getCredentials(USER))?.server).toBe(MOCK_SERVER);
  });

  test('records an error when no server can be determined', async () => {
    await userManager.saveCredentials({
      discordId: USER,
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
    });
    getServerSpy.mockResolvedValue(undefined as any);

    const stats = await backfillChannelHistory(makeChannel([CODE_A, CODE_B]));

    expect(getServerSpy).toHaveBeenCalledTimes(1);
    expect(submitCodeSpy).not.toHaveBeenCalled();
    expect(stats.errors).toHaveLength(1);
  });

  test('a thrown session error is recorded once per user, not retried per code', async () => {
    // Regression guard: resolving inside the per-code try turned a DB failure
    // while persisting a new server into a per-code warning, retried for every
    // code, with stats.errors left empty.
    await userManager.saveCredentials({
      discordId: USER,
      userId: TEST_USER_ID,
      userHash: TEST_USER_HASH,
      server: MOCK_SERVER,
    });
    getUserDetailsSpy.mockResolvedValue({
      status: ResponseStatus.SwitchServer,
      newServer: 'https://moved.example.com/post.php',
    } as any);
    const updateServerSpy = spyOn(userManager, 'updateServer').mockRejectedValue(
      new Error('database is locked')
    );

    try {
      const stats = await backfillChannelHistory(makeChannel([CODE_A, CODE_B]));

      expect(updateServerSpy).toHaveBeenCalledTimes(1);
      expect(submitCodeSpy).not.toHaveBeenCalled();
      expect(stats.errors).toHaveLength(1);
      expect(stats.errors[0]).toContain('database is locked');
    } finally {
      updateServerSpy.mockRestore();
    }
  });
});
