import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll, spyOn } from 'bun:test';
import { db, initializeDatabase } from '../database/db';
import { users, redeemedCodes, pendingCodes, auditLog } from '../database/schema/index';
import { userManager } from '../database/userManager';
import { codeManager } from '../database/codeManager';
import IdleChampionsApi from '../api/idleChampionsApi';
import { autoRedeemForAllUsers, setDiscordClient } from './autoRedeemer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A = 'user-auto-a';
const USER_B = 'user-auto-b';
const CODE = 'AUTOCODE1234';
const CODE_2 = 'AUTOCODE5678';

const MOCK_SERVER = 'test.idlechampions.com';
const MOCK_INSTANCE_ID = 'inst-abc123';

/** Returns a mock getUserDetails response that looks like a successful PlayerData */
function makeUserDetails(instanceId = MOCK_INSTANCE_ID): object {
  return { details: { instance_id: instanceId } };
}

/** CodeSubmitResponse shape */
function makeSubmitResponse(codeStatus: number, lootDetail?: string): object {
  return { codeStatus, ...(lootDetail ? { lootDetail } : {}) };
}

/** GenericResponse shape */
function makeGenericResponse(status: number, newServer?: string): object {
  return { status, ...(newServer ? { newServer } : {}) };
}

// ---------------------------------------------------------------------------
// Spy setup — created once, reset before every test so call counts are fresh
// ---------------------------------------------------------------------------

const getUserDetailsSpy = spyOn(IdleChampionsApi, 'getUserDetails');
const submitCodeSpy = spyOn(IdleChampionsApi, 'submitCode');

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let setTimeoutSpy: ReturnType<typeof spyOn>;

beforeAll(() => {
  initializeDatabase();
  // Make randomDelay a no-op so tests don't wait 2–5 s per transition.
  setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(
    ((fn: (...args: unknown[]) => void) => {
      if (typeof fn === 'function') fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout
  );
});

beforeEach(() => {
  // Wipe all tables in FK-safe order before each test.
  db.delete(auditLog).run();
  db.delete(pendingCodes).run();
  db.delete(redeemedCodes).run();
  db.delete(users).run();

  // Reset spy call counts and set default happy-path implementations.
  getUserDetailsSpy.mockReset();
  submitCodeSpy.mockReset();
  getUserDetailsSpy.mockResolvedValue(makeUserDetails() as any);
  submitCodeSpy.mockResolvedValue(makeSubmitResponse(0) as any);
});

afterAll(() => {
  // Restore real setTimeout so subsequent test files aren't affected.
  setTimeoutSpy.mockRestore();
  // Ensure the DB is clean for subsequent test files (codeManager, userManager, etc.)
  // that delete users without first deleting auditLog rows.
  db.delete(auditLog).run();
  db.delete(pendingCodes).run();
  db.delete(redeemedCodes).run();
  db.delete(users).run();
});

// ---------------------------------------------------------------------------
// Helper: register a user with auto-redeem enabled (default)
// ---------------------------------------------------------------------------
async function addUser(discordId: string, autoRedeem = true): Promise<void> {
  await userManager.saveCredentials({
    discordId,
    userId: `uid-${discordId}`,
    userHash: `hash-${discordId}`,
    server: MOCK_SERVER,
  });
  if (!autoRedeem) {
    await userManager.setAutoRedeem(discordId, false);
  }
}

// ---------------------------------------------------------------------------
// Guard: empty inputs
// ---------------------------------------------------------------------------
describe('autoRedeemForAllUsers – empty inputs', () => {
  test('returns immediately when codes array is empty', async () => {
    await autoRedeemForAllUsers([]);
    expect(getUserDetailsSpy).not.toHaveBeenCalled();
  });

  test('returns early when no users have auto-redeem enabled', async () => {
    await addUser(USER_A, false);
    await codeManager.addPendingCode(CODE);

    await autoRedeemForAllUsers([CODE]);

    expect(getUserDetailsSpy).not.toHaveBeenCalled();
    // Code must remain pending since nothing was processed
    expect(await codeManager.getPendingCodes()).toContain(CODE);
  });
});

// ---------------------------------------------------------------------------
// Per-user skip conditions
// ---------------------------------------------------------------------------
describe('autoRedeemForAllUsers – skip conditions', () => {
  test('skips code already redeemed by the user', async () => {
    await addUser(USER_A);
    await codeManager.addRedeemedCode(CODE, USER_A, 'Success');

    await autoRedeemForAllUsers([CODE]);

    expect(getUserDetailsSpy).not.toHaveBeenCalled();
  });

  test('skips code that is known-expired', async () => {
    await addUser(USER_A);
    // Mark code as expired for some other user so isCodeExpired() returns true
    await userManager.saveCredentials({ discordId: USER_B, userId: 'uid-b', userHash: 'hash-b' });
    await codeManager.addRedeemedCode(CODE, USER_B, 'Code Expired');

    await autoRedeemForAllUsers([CODE]);

    expect(getUserDetailsSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Successful redemption
// ---------------------------------------------------------------------------
describe('autoRedeemForAllUsers – successful redemption', () => {
  test('persists Success and removes code from pending_codes', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);
    submitCodeSpy.mockResolvedValue(makeSubmitResponse(0, 'some loot') as any);

    await autoRedeemForAllUsers([CODE]);

    // Persisted as Success
    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_A)).toBe(true);
    // Removed from pending
    expect(await codeManager.getPendingCodes()).not.toContain(CODE);
  });

  test('processes multiple codes for one user in a single run', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);
    await codeManager.addPendingCode(CODE_2);

    await autoRedeemForAllUsers([CODE, CODE_2]);

    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_A)).toBe(true);
    expect(await codeManager.isCodeRedeemedByUser(CODE_2, USER_A)).toBe(true);
    expect(await codeManager.getPendingCodes()).toEqual([]);
  });

  test('processes one code for multiple users', async () => {
    await addUser(USER_A);
    await addUser(USER_B);
    await codeManager.addPendingCode(CODE);

    await autoRedeemForAllUsers([CODE]);

    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_A)).toBe(true);
    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_B)).toBe(true);
    expect(await codeManager.getPendingCodes()).not.toContain(CODE);
  });
});

// ---------------------------------------------------------------------------
// Already Redeemed
// ---------------------------------------------------------------------------
describe('autoRedeemForAllUsers – Already Redeemed', () => {
  test('persists Already Redeemed row so future runs skip the user', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);
    submitCodeSpy.mockResolvedValue(makeSubmitResponse(1) as any);

    await autoRedeemForAllUsers([CODE]);

    // isCodeRedeemedByUser includes Already Redeemed
    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_A)).toBe(true);
    // But isCodeRedeemed (Success/Expired only) returns false → stays pending
    expect(await codeManager.getPendingCodes()).toContain(CODE);
  });
});

// ---------------------------------------------------------------------------
// Code Expired response
// ---------------------------------------------------------------------------
describe('autoRedeemForAllUsers – Code Expired', () => {
  test('persists Code Expired and removes from pending_codes', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);
    submitCodeSpy.mockResolvedValue(makeSubmitResponse(4) as any);

    await autoRedeemForAllUsers([CODE]);

    expect(await codeManager.isCodeExpired(CODE)).toBe(true);
    expect(await codeManager.getPendingCodes()).not.toContain(CODE);
  });
});

// ---------------------------------------------------------------------------
// Non-terminal failures (code stays pending)
// ---------------------------------------------------------------------------
describe('autoRedeemForAllUsers – non-terminal failure', () => {
  test('leaves code pending when submitCode returns a non-persisted status', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);
    // codeStatus 2 = InvalidParameters — logged but not persisted
    submitCodeSpy.mockResolvedValue(makeSubmitResponse(2) as any);

    await autoRedeemForAllUsers([CODE]);

    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_A)).toBe(false);
    expect(await codeManager.getPendingCodes()).toContain(CODE);
  });

  test('leaves code pending when submitCode returns a GenericResponse(Failed)', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);
    submitCodeSpy.mockResolvedValue(makeGenericResponse(2) as any);

    await autoRedeemForAllUsers([CODE]);

    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_A)).toBe(false);
    expect(await codeManager.getPendingCodes()).toContain(CODE);
  });

  test('leaves code pending when getUserDetails returns no instance_id', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);
    getUserDetailsSpy.mockResolvedValue({ details: null } as any);

    await autoRedeemForAllUsers([CODE]);

    expect(await codeManager.getPendingCodes()).toContain(CODE);
  });
});

// ---------------------------------------------------------------------------
// GenericResponse: SwitchServer
// ---------------------------------------------------------------------------
describe('autoRedeemForAllUsers – SwitchServer retry', () => {
  test('switches server and retries submitCode once on status 4', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);

    const newServer = 'new.idlechampions.com';
    submitCodeSpy
      .mockResolvedValueOnce(makeGenericResponse(4, newServer) as any) // first: SwitchServer
      .mockResolvedValueOnce(makeSubmitResponse(0) as any); // retry: Success

    await autoRedeemForAllUsers([CODE]);

    expect(submitCodeSpy).toHaveBeenCalledTimes(2);
    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_A)).toBe(true);
    // Verify server was updated in DB
    const creds = await userManager.getCredentials(USER_A);
    expect(creds?.server).toBe(newServer);
  });

  test('leaves code pending when SwitchServer retry also fails', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);
    submitCodeSpy
      .mockResolvedValueOnce(makeGenericResponse(4, 'new.server.com') as any)
      .mockResolvedValueOnce(makeGenericResponse(2) as any); // retry also fails

    await autoRedeemForAllUsers([CODE]);

    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_A)).toBe(false);
    expect(await codeManager.getPendingCodes()).toContain(CODE);
  });
});

// ---------------------------------------------------------------------------
// GenericResponse: OutdatedInstanceId
// ---------------------------------------------------------------------------
describe('autoRedeemForAllUsers – OutdatedInstanceId retry', () => {
  test('refreshes instance_id via getUserDetails and retries submitCode on status 1', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);

    const freshInstanceId = 'fresh-inst-999';
    getUserDetailsSpy
      .mockResolvedValueOnce(makeUserDetails(MOCK_INSTANCE_ID) as any) // initial call
      .mockResolvedValueOnce(makeUserDetails(freshInstanceId) as any); // refresh call
    submitCodeSpy
      .mockResolvedValueOnce(makeGenericResponse(1) as any) // OutdatedInstanceId
      .mockResolvedValueOnce(makeSubmitResponse(0) as any); // retry with fresh id

    await autoRedeemForAllUsers([CODE]);

    expect(getUserDetailsSpy).toHaveBeenCalledTimes(2);
    expect(submitCodeSpy).toHaveBeenCalledTimes(2);
    // Second submitCode call must use the fresh instance_id
    expect(submitCodeSpy.mock.calls[1]![0]).toMatchObject({ instanceId: freshInstanceId });
    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_A)).toBe(true);
  });

  test('leaves code pending when instance_id refresh also fails', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);
    getUserDetailsSpy
      .mockResolvedValueOnce(makeUserDetails() as any)
      .mockResolvedValueOnce({ details: null } as any); // refresh returns no details
    submitCodeSpy.mockResolvedValueOnce(makeGenericResponse(1) as any);

    await autoRedeemForAllUsers([CODE]);

    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_A)).toBe(false);
    expect(await codeManager.getPendingCodes()).toContain(CODE);
  });
});

// ---------------------------------------------------------------------------
// getUserDetails: SwitchServer
// ---------------------------------------------------------------------------
describe('autoRedeemForAllUsers – getUserDetails SwitchServer', () => {
  test('updates server and retries getUserDetails on status 4', async () => {
    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);

    const newServer = 'switched.idlechampions.com';
    getUserDetailsSpy
      .mockResolvedValueOnce(makeGenericResponse(4, newServer) as any) // switch
      .mockResolvedValueOnce(makeUserDetails() as any); // retry succeeds

    await autoRedeemForAllUsers([CODE]);

    expect(await codeManager.isCodeRedeemedByUser(CODE, USER_A)).toBe(true);
    const creds = await userManager.getCredentials(USER_A);
    expect(creds?.server).toBe(newServer);
  });
});

// ---------------------------------------------------------------------------
// DM notifications
// ---------------------------------------------------------------------------

/** Build a minimal mock Discord client with a tracked send spy. */
function makeMockClient() {
  const sendSpy = spyOn({ send: async (_msg: string) => {} }, 'send');
  const mockUser = { send: sendSpy };
  const mockClient = {
    users: {
      fetch: async (_id: string) => mockUser,
    },
  } as any;
  return { mockClient, sendSpy };
}

describe('autoRedeemForAllUsers – dmOnSuccess', () => {
  afterEach(() => { setDiscordClient(null); });

  test('sends DM on success when dmOnSuccess is true (default)', async () => {
    const { mockClient, sendSpy } = makeMockClient();
    setDiscordClient(mockClient);

    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);
    submitCodeSpy.mockResolvedValue(makeSubmitResponse(0) as any);

    await autoRedeemForAllUsers([CODE]);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0]![0]).toContain(CODE);
  });

  test('does not send DM on success when dmOnSuccess is false', async () => {
    const { mockClient, sendSpy } = makeMockClient();
    setDiscordClient(mockClient);

    await addUser(USER_A);
    await userManager.setNotificationPreferences(USER_A, { dmOnSuccess: false });
    await codeManager.addPendingCode(CODE);
    submitCodeSpy.mockResolvedValue(makeSubmitResponse(0) as any);

    await autoRedeemForAllUsers([CODE]);

    expect(sendSpy).not.toHaveBeenCalled();
  });
});

describe('autoRedeemForAllUsers – dmOnFailure', () => {
  afterEach(() => { setDiscordClient(null); });

  test('sends failure DM when dmOnFailure is true', async () => {
    const { mockClient, sendSpy } = makeMockClient();
    setDiscordClient(mockClient);

    await addUser(USER_A);
    await userManager.setNotificationPreferences(USER_A, { dmOnFailure: true });
    await codeManager.addPendingCode(CODE);
    // codeStatus 2 = InvalidParameters — not persisted, triggers failure branch
    submitCodeSpy.mockResolvedValue(makeSubmitResponse(2) as any);

    await autoRedeemForAllUsers([CODE]);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0]![0]).toContain(CODE);
  });

  test('does not send failure DM when dmOnFailure is false (default)', async () => {
    const { mockClient, sendSpy } = makeMockClient();
    setDiscordClient(mockClient);

    await addUser(USER_A);
    await codeManager.addPendingCode(CODE);
    submitCodeSpy.mockResolvedValue(makeSubmitResponse(2) as any);

    await autoRedeemForAllUsers([CODE]);

    expect(sendSpy).not.toHaveBeenCalled();
  });
});
