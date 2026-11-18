import { describe, test, expect, beforeAll, beforeEach, afterAll, spyOn } from 'bun:test';
import { initializeDatabase } from '../database/db';
import { resetDatabase } from '../../test/db';
import { userManager } from '../database/userManager';
import { codeManager } from '../database/codeManager';
import IdleChampionsApi, { CodeSubmitStatus, ResponseStatus } from '../api/idleChampionsApi';
import { execute } from './catchup';

// ---------------------------------------------------------------------------
// /catchup resolves one game session up front and refreshes it every 10 real
// submissions. These tests pin how that session handling behaves now that it
// goes through resolveGameSession(): the user-facing failure message, a server
// switch picked up by the periodic refresh, and a failed refresh that keeps
// the run going on the current session.
// ---------------------------------------------------------------------------

const USER = 'discord-catchup-user';
const SERVER = 'https://cached.example.com/~idledragons/post.php';
const MOVED_SERVER = 'https://moved.example.com/~idledragons/post.php';
const INSTANCE = 'inst-1';

// 12 codes: the refresh fires before the 11th submission.
const CODES = Array.from({ length: 12 }, (_, i) => `CATCH${String(i).padStart(4, '0')}UP`);

const getUserDetailsSpy = spyOn(IdleChampionsApi, 'getUserDetails');
const submitCodeSpy = spyOn(IdleChampionsApi, 'submitCode');
const getServerSpy = spyOn(IdleChampionsApi, 'getServer');

function makeInteraction() {
  const editReplySpy = spyOn({ editReply: async (_: unknown) => {} }, 'editReply');
  const interaction = {
    user: { id: USER, tag: 'user#catchup' },
    deferred: false,
    replied: false,
    deferReply: async () => {
      (interaction as any).deferred = true;
    },
    editReply: editReplySpy,
    isChatInputCommand: () => true,
    commandName: 'catchup',
  } as any;
  return { interaction, editReplySpy };
}

function embedOf(spy: ReturnType<typeof makeInteraction>['editReplySpy']) {
  return (spy.mock.calls.at(-1)![0] as any).embeds[0].data;
}

let setTimeoutSpy: ReturnType<typeof spyOn>;

beforeAll(() => {
  initializeDatabase();
  // /catchup sleeps 150 ms after each submission; run timers inline so the 12-code
  // tests stay instant instead of creeping towards bun's 5 s timeout.
  setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(((
    fn: (...args: unknown[]) => void
  ) => {
    if (typeof fn === 'function') fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout);
});

beforeEach(async () => {
  resetDatabase();
  await userManager.saveCredentials({
    discordId: USER,
    userId: '12345',
    userHash: 'test-user-hash',
    server: SERVER,
  });

  getUserDetailsSpy.mockReset();
  submitCodeSpy.mockReset();
  getServerSpy.mockReset();
  getUserDetailsSpy.mockResolvedValue({ details: { instance_id: INSTANCE } } as any);
  submitCodeSpy.mockResolvedValue({ codeStatus: 0 } as any);
  getServerSpy.mockResolvedValue(SERVER as any);
});

afterAll(() => {
  // Leave nothing behind for the next test file (see src/test/db.ts).
  resetDatabase();
  getUserDetailsSpy.mockRestore();
  submitCodeSpy.mockRestore();
  getServerSpy.mockRestore();
  setTimeoutSpy.mockRestore();
});

describe('/catchup – session handling', () => {
  test('tells the user to open the game when there is no session', async () => {
    await codeManager.addNewPendingCodes([CODES[0]!]);
    getUserDetailsSpy.mockResolvedValue({ details: { instance_id: '0' } } as any);
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(submitCodeSpy).not.toHaveBeenCalled();
    expect(embedOf(editReplySpy).description).toContain('Open Idle Champions');
  });

  test('the periodic refresh follows a server switch', async () => {
    await codeManager.addNewPendingCodes(CODES);
    getUserDetailsSpy
      .mockResolvedValueOnce({ details: { instance_id: INSTANCE } } as any) // initial
      .mockResolvedValueOnce({
        status: ResponseStatus.SwitchServer,
        newServer: MOVED_SERVER,
      } as any)
      .mockResolvedValueOnce({ details: { instance_id: 'inst-2' } } as any);
    const { interaction } = makeInteraction();

    await execute(interaction);

    const calls = submitCodeSpy.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(12);
    expect(calls[9]).toMatchObject({ server: SERVER, instanceId: INSTANCE });
    expect(calls[10]).toMatchObject({ server: MOVED_SERVER, instanceId: 'inst-2' });
    expect(calls[11]).toMatchObject({ server: MOVED_SERVER, instanceId: 'inst-2' });
    expect((await userManager.getCredentials(USER))?.server).toBe(MOVED_SERVER);
  });

  test('a failed refresh keeps the current session and finishes the run', async () => {
    await codeManager.addNewPendingCodes(CODES);
    getUserDetailsSpy
      .mockResolvedValueOnce({ details: { instance_id: INSTANCE } } as any) // initial
      .mockResolvedValueOnce({ status: ResponseStatus.Failed } as any); // refresh fails
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    const calls = submitCodeSpy.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(12);
    expect(calls[11]).toMatchObject({ server: SERVER, instanceId: INSTANCE });
    expect(embedOf(editReplySpy).title).toContain('Catch-up Complete');
  });

  test('an unexpected error is reported to the user without a second throw', async () => {
    const pendingSpy = spyOn(codeManager, 'getPendingCodes').mockRejectedValue(
      new Error('database is locked')
    );
    try {
      const { interaction, editReplySpy } = makeInteraction();

      await execute(interaction);

      const embed = embedOf(editReplySpy);
      expect(embed.title).toBe('❌ Error');
      expect(embed.description).toContain('database is locked');
    } finally {
      pendingSpy.mockRestore();
    }
  });

  test('still paces submissions at 150 ms', async () => {
    // The timer fake makes sleeps instant; this keeps the rate-limit pause
    // itself from being deleted unnoticed.
    await codeManager.addNewPendingCodes([CODES[0]!]);
    setTimeoutSpy.mockClear();
    const { interaction } = makeInteraction();

    await execute(interaction);

    expect(setTimeoutSpy.mock.calls.some((c: unknown[]) => c[1] === 150)).toBe(true);
  });

  test('a redirect persisted before a failed refresh is kept for the next run', async () => {
    await codeManager.addNewPendingCodes(CODES);
    getUserDetailsSpy
      .mockResolvedValueOnce({ details: { instance_id: INSTANCE } } as any) // initial
      .mockResolvedValueOnce({
        status: ResponseStatus.SwitchServer,
        newServer: MOVED_SERVER,
      } as any)
      .mockResolvedValueOnce({ status: ResponseStatus.Failed } as any); // re-fetch fails
    const { interaction } = makeInteraction();

    await execute(interaction);

    // This run keeps submitting to the old server; the DB already has the new one.
    expect(submitCodeSpy.mock.calls.at(-1)![0]).toMatchObject({ server: SERVER });
    expect((await userManager.getCredentials(USER))?.server).toBe(MOVED_SERVER);
  });
});

describe('/catchup – results', () => {
  test('asks for /setup when no credentials are stored', async () => {
    resetDatabase();
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(getUserDetailsSpy).not.toHaveBeenCalled();
    expect(embedOf(editReplySpy).title).toContain('No Credentials Found');
  });

  test('says so when there are no codes to redeem', async () => {
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(submitCodeSpy).not.toHaveBeenCalled();
    expect(embedOf(editReplySpy).title).toContain('No Codes Available');
  });

  test('counts every outcome and persists what it learns', async () => {
    const [ok, had, exp, bad, generic, thrown, knownExpired, alreadyMine] = CODES;
    await codeManager.addNewPendingCodes([ok!, had!, exp!, bad!, generic!, thrown!, knownExpired!]);
    // Known-expired (any user) and already-redeemed-by-me are skipped without a call.
    await userManager.saveCredentials({
      discordId: 'other-user',
      userId: '67890',
      userHash: 'other-user-hash',
    });
    await codeManager.addRedeemedCode(knownExpired!, 'other-user', 'Code Expired');
    await codeManager.addRedeemedCode(alreadyMine!, USER, 'Success');

    submitCodeSpy.mockImplementation((async (opts: any) => {
      switch (opts.code) {
        case ok:
          return { codeStatus: CodeSubmitStatus.Success };
        case had:
          return { codeStatus: CodeSubmitStatus.AlreadyRedeemed };
        case exp:
          return { codeStatus: CodeSubmitStatus.Expired };
        case bad:
          return { codeStatus: CodeSubmitStatus.NotValidCombo };
        case generic:
          return { status: ResponseStatus.Failed };
        default:
          throw new Error('network down');
      }
    }) as any);
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    const description: string = embedOf(editReplySpy).description;
    expect(description).toContain('**Newly redeemed:** 1');
    // had + alreadyMine
    expect(description).toContain('**Already had:** 2');
    // exp + knownExpired
    expect(description).toContain('**Expired:** 2');
    // bad + generic + thrown
    expect(description).toContain('**Failed:** 3');
    expect(submitCodeSpy).toHaveBeenCalledTimes(6);
    expect(await codeManager.isCodeRedeemedByUser(ok!, USER)).toBe(true);
  });
});
