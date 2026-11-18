import { describe, test, expect, beforeAll, beforeEach, afterAll, spyOn } from 'bun:test';
import { initializeDatabase } from '../database/db';
import { resetDatabase } from '../../test/db';
import { userManager } from '../database/userManager';
import IdleChampionsApi, { GenericResponse, ResponseStatus } from '../api/idleChampionsApi';
import logger from '../utils/logger';
import { execute } from './blacksmith';

// ---------------------------------------------------------------------------
// /blacksmith must not claim success on a GenericResponse, must explain the
// failure in user terms, and logs the status by name (4 is SwitchServer here
// but Expired for a code, so a bare number in the log was easy to misread).
// ---------------------------------------------------------------------------

const USER = 'discord-blacksmith-user';
const SERVER = 'https://cached.example.com/~idledragons/post.php';

const getUserDetailsSpy = spyOn(IdleChampionsApi, 'getUserDetails');
const useBlacksmithSpy = spyOn(IdleChampionsApi, 'useBlacksmith');

function makeInteraction(contractType = '33', heroId = '42', count = 2) {
  const editReplySpy = spyOn({ editReply: async (_: unknown) => {} }, 'editReply');
  const interaction = {
    user: { id: USER, tag: 'user#blacksmith' },
    deferred: false,
    replied: false,
    deferReply: async () => {
      (interaction as any).deferred = true;
    },
    editReply: editReplySpy,
    isChatInputCommand: () => true,
    commandName: 'blacksmith',
    options: {
      getString: (name: string) => (name === 'contract_type' ? contractType : heroId),
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
  useBlacksmithSpy.mockReset();
  getUserDetailsSpy.mockResolvedValue({ details: { instance_id: 'inst-1' } } as any);
  useBlacksmithSpy.mockResolvedValue({ actions: [] } as any);
});

afterAll(() => {
  // Leave nothing behind for the next test file (see src/test/db.ts).
  resetDatabase();
  getUserDetailsSpy.mockRestore();
  useBlacksmithSpy.mockRestore();
});

describe('/blacksmith', () => {
  test('asks for /setup when no credentials are stored', async () => {
    resetDatabase();
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(useBlacksmithSpy).not.toHaveBeenCalled();
    expect(lastReply(editReplySpy).embeds[0].data.title).toContain('No Credentials Found');
  });

  test('reports a session failure without calling useBlacksmith', async () => {
    getUserDetailsSpy.mockResolvedValue({ details: { instance_id: '0' } } as any);
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(useBlacksmithSpy).not.toHaveBeenCalled();
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
      useBlacksmithSpy.mockResolvedValue(new GenericResponse(status) as any);
      const errorSpy = spyOn(logger, 'error');
      try {
        const { interaction, editReplySpy } = makeInteraction();

        await execute(interaction);

        const embed = lastReply(editReplySpy).embeds[0].data;
        expect(embed.title).toContain('Could Not Apply Upgrades');
        expect(embed.description).toContain(reason);
        expect(errorSpy.mock.calls.map((c) => String(c[0]))).toContainEqual(
          `[BLACKSMITH] useBlacksmith failed: ${logName}`
        );
      } finally {
        errorSpy.mockRestore();
      }
    });
  }

  test('summarises the results on success', async () => {
    useBlacksmithSpy.mockResolvedValue({
      actions: [{ action: 'level_up', amount: 3 }, { action: 'level_up' }, { foo: 1 }],
    } as any);
    const { interaction, editReplySpy } = makeInteraction('33', '42', 2);

    await execute(interaction);

    const embed = lastReply(editReplySpy).embeds[0].data;
    expect(embed.title).toContain('Blacksmith Upgrades Applied');
    const fields = Object.fromEntries(
      (embed.fields as Array<{ name: string; value: string }>).map((f) => [f.name, f.value])
    );
    expect(fields['Contract Type']).toBe('Medium Contract');
    expect(fields['Hero']).toBe('42');
    expect(fields['Count']).toBe('2');
    expect(fields['Results']).toBe('• level_up (3)\n• level_up\n• {"foo":1}');
  });

  test('omits the results field when there are no actions', async () => {
    const { interaction, editReplySpy } = makeInteraction('99');

    await execute(interaction);

    const fields = lastReply(editReplySpy).embeds[0].data.fields as Array<{
      name: string;
      value: string;
    }>;
    expect(fields.find((f) => f.name === 'Contract Type')?.value).toBe('Contract 99');
    expect(fields.some((f) => f.name === 'Results')).toBe(false);
  });

  test('reports an unexpected error through replyWithError', async () => {
    useBlacksmithSpy.mockRejectedValue(new Error('boom'));
    // Stubbed: keeps the expected error out of test output.
    const errorSpy = spyOn(logger, 'error').mockImplementation((() => logger) as any);
    try {
      const { interaction, editReplySpy } = makeInteraction();

      await execute(interaction);

      const embed = lastReply(editReplySpy).embeds[0].data;
      expect(embed.title).toBe('❌ Error');
      expect(embed.description).toContain('error occurred while using blacksmith');
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
