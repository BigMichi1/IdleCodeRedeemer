import { describe, test, expect, beforeAll, beforeEach, afterAll, spyOn } from 'bun:test';
import { initializeDatabase } from '../database/db';
import { resetDatabase } from '../../test/db';
import { userManager } from '../database/userManager';
import IdleChampionsApi, { GenericResponse, ResponseStatus } from '../api/idleChampionsApi';
import logger from '../utils/logger';
import { execute } from './open';

// ---------------------------------------------------------------------------
// /open must not claim success on a GenericResponse, must explain the failure
// in user terms, and logs the status by name (4 is SwitchServer here but
// Expired for a code, so a bare number in the log was easy to misread).
// ---------------------------------------------------------------------------

const USER = 'discord-open-user';
const SERVER = 'https://cached.example.com/~idledragons/post.php';

const getUserDetailsSpy = spyOn(IdleChampionsApi, 'getUserDetails');
const openChestsSpy = spyOn(IdleChampionsApi, 'openChests');

function makeInteraction(chestType = '4', count = 3) {
  const editReplySpy = spyOn({ editReply: async (_: unknown) => {} }, 'editReply');
  const interaction = {
    user: { id: USER, tag: 'user#open' },
    deferred: false,
    replied: false,
    deferReply: async () => {
      (interaction as any).deferred = true;
    },
    editReply: editReplySpy,
    isChatInputCommand: () => true,
    commandName: 'open',
    options: {
      getString: () => chestType,
      getInteger: () => count,
    },
  } as any;
  return { interaction, editReplySpy };
}

function lastReply(spy: ReturnType<typeof makeInteraction>['editReplySpy']) {
  return spy.mock.calls.at(-1)![0] as any;
}

beforeAll(() => {
  initializeDatabase();
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
  openChestsSpy.mockReset();
  getUserDetailsSpy.mockResolvedValue({ details: { instance_id: 'inst-1' } } as any);
  openChestsSpy.mockResolvedValue({ lootDetail: [] } as any);
});

afterAll(() => {
  getUserDetailsSpy.mockRestore();
  openChestsSpy.mockRestore();
});

describe('/open', () => {
  test('asks for /setup when no credentials are stored', async () => {
    resetDatabase();
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(openChestsSpy).not.toHaveBeenCalled();
    expect(lastReply(editReplySpy).embeds[0].data.title).toContain('No Credentials Found');
  });

  test('reports a session failure without calling openChests', async () => {
    getUserDetailsSpy.mockResolvedValue({ details: { instance_id: '0' } } as any);
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(openChestsSpy).not.toHaveBeenCalled();
    expect(lastReply(editReplySpy).embeds[0].data.description).toContain('Open Idle Champions');
  });

  const FAILURES: Array<[ResponseStatus, string, string]> = [
    [ResponseStatus.OutdatedInstanceId, 'session has expired', 'OutdatedInstanceId'],
    [ResponseStatus.SwitchServer, 'moved your account', 'SwitchServer'],
    [ResponseStatus.InsuficcientCurrency, 'not have enough currency', 'InsuficcientCurrency'],
    [ResponseStatus.Failed, 'rejected the request', 'Failed'],
  ];
  for (const [status, reason, logName] of FAILURES) {
    test(`${logName}: user-facing reason, status name in the log`, async () => {
      openChestsSpy.mockResolvedValue(new GenericResponse(status) as any);
      const errorSpy = spyOn(logger, 'error');
      try {
        const { interaction, editReplySpy } = makeInteraction();

        await execute(interaction);

        const embed = lastReply(editReplySpy).embeds[0].data;
        expect(embed.title).toContain('Could Not Open Chests');
        expect(embed.description).toContain(reason);
        expect(errorSpy.mock.calls.map((c) => String(c[0]))).toContainEqual(
          `[OPEN] openChests failed: ${logName}`
        );
      } finally {
        errorSpy.mockRestore();
      }
    });
  }

  test('summarises the loot on success', async () => {
    openChestsSpy.mockResolvedValue({
      lootDetail: [{ loot_action: 'upgrade' }, { loot_action: 'upgrade' }, { foo: 1 }],
    } as any);
    const { interaction, editReplySpy } = makeInteraction('4', 3);

    await execute(interaction);

    const embed = lastReply(editReplySpy).embeds[0].data;
    expect(embed.title).toContain('Chests Opened Successfully');
    const fields = Object.fromEntries(
      (embed.fields as Array<{ name: string; value: string }>).map((f) => [f.name, f.value])
    );
    expect(fields['Chest Type']).toBe('Gold Chest');
    expect(fields['Opened']).toBe('3');
    expect(fields['Equipment Found']).toContain('• upgrade x2');
    expect(fields['Equipment Found']).toContain('{"foo":1}');
  });

  test('says no equipment was found when the loot list is empty or missing', async () => {
    for (const response of [{ lootDetail: [] }, { other: true }]) {
      openChestsSpy.mockResolvedValue(response as any);
      const { interaction, editReplySpy } = makeInteraction('99', 1);

      await execute(interaction);

      const embed = lastReply(editReplySpy).embeds[0].data;
      const fields = embed.fields as Array<{ name: string; value: string }>;
      expect(fields.find((f) => f.name === 'Chest Type')?.value).toBe('Chest 99');
      expect(fields.find((f) => f.name === '📦 Loot')?.value).toContain('No equipment found');
    }
  });

  test('reports an unexpected error through replyWithError', async () => {
    openChestsSpy.mockRejectedValue(new Error('boom'));
    // Stubbed: keeps the expected error out of test output.
    const errorSpy = spyOn(logger, 'error').mockImplementation((() => logger) as any);
    try {
      const { interaction, editReplySpy } = makeInteraction();

      await execute(interaction);

      const embed = lastReply(editReplySpy).embeds[0].data;
      expect(embed.title).toBe('❌ Error');
      expect(embed.description).toContain('error occurred while opening chests');
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
