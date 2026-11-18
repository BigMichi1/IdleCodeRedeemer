import { describe, test, expect, beforeAll, beforeEach, afterAll, spyOn } from 'bun:test';
import { db, initializeDatabase } from '../database/db';
import { users, auditLog } from '../database/schema/index';
import { userManager } from '../database/userManager';
import IdleChampionsApi, { ResponseStatus } from '../api/idleChampionsApi';
import { execute } from './inventory';

// ---------------------------------------------------------------------------
// /inventory reads account state through resolvePlayerData(). It used to call
// getServer() on every run and to persist an undefined server when a switch
// response named none; these tests pin the cached-server path, the redirect,
// and that a missing game session ('0') does not block a read-only command.
// ---------------------------------------------------------------------------

const USER = 'discord-inventory-user';
const SERVER = 'https://cached.example.com/~idledragons/post.php';
const MOVED_SERVER = 'https://moved.example.com/~idledragons/post.php';

const getUserDetailsSpy = spyOn(IdleChampionsApi, 'getUserDetails');
const getServerSpy = spyOn(IdleChampionsApi, 'getServer');

function makeInteraction() {
  const editReplySpy = spyOn({ editReply: async (_: unknown) => {} }, 'editReply');
  const interaction = {
    user: { id: USER, tag: 'user#inventory' },
    deferred: false,
    replied: false,
    deferReply: async () => {
      (interaction as any).deferred = true;
    },
    editReply: editReplySpy,
    isChatInputCommand: () => true,
    commandName: 'inventory',
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
  db.delete(users).run();
  await userManager.saveCredentials({
    discordId: USER,
    userId: '12345',
    userHash: 'test-user-hash',
    server: SERVER,
  });

  getUserDetailsSpy.mockReset();
  getServerSpy.mockReset();
  getUserDetailsSpy.mockResolvedValue({ details: { instance_id: '0', gold: '42' } } as any);
  getServerSpy.mockResolvedValue(SERVER as any);
});

afterAll(() => {
  getUserDetailsSpy.mockRestore();
  getServerSpy.mockRestore();
});

describe('/inventory – session handling', () => {
  test('uses the cached server and is not blocked by a missing game session', async () => {
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(getServerSpy).not.toHaveBeenCalled();
    expect((getUserDetailsSpy.mock.calls[0]![0] as any).server).toBe(SERVER);
    expect(embedOf(editReplySpy).title).toContain('Your Inventory');
  });

  test('follows a server switch and persists it', async () => {
    getUserDetailsSpy
      .mockResolvedValueOnce({
        status: ResponseStatus.SwitchServer,
        newServer: MOVED_SERVER,
      } as any)
      .mockResolvedValueOnce({ details: { gold: '42' } } as any);
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(embedOf(editReplySpy).title).toContain('Your Inventory');
    expect((await userManager.getCredentials(USER))?.server).toBe(MOVED_SERVER);
  });

  test('reports a failed lookup with the credentials hint', async () => {
    getUserDetailsSpy.mockResolvedValue({ status: ResponseStatus.Failed } as any);
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(embedOf(editReplySpy).description).toContain('/setup');
  });
});
