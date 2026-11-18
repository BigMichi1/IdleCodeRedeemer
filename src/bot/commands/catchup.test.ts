import { describe, test, expect, beforeAll, beforeEach, afterAll, spyOn } from 'bun:test';
import { db, initializeDatabase } from '../database/db';
import { users, redeemedCodes, pendingCodes, auditLog } from '../database/schema/index';
import { userManager } from '../database/userManager';
import { codeManager } from '../database/codeManager';
import IdleChampionsApi, { ResponseStatus } from '../api/idleChampionsApi';
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

beforeAll(() => {
  initializeDatabase();
});

beforeEach(async () => {
  db.delete(auditLog).run();
  db.delete(pendingCodes).run();
  db.delete(redeemedCodes).run();
  db.delete(users).run();
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
  getUserDetailsSpy.mockRestore();
  submitCodeSpy.mockRestore();
  getServerSpy.mockRestore();
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
});
