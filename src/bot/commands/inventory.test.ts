import { describe, test, expect, beforeAll, beforeEach, afterAll, spyOn } from 'bun:test';
import { initializeDatabase } from '../database/db';
import { resetDatabase } from '../../test/db';
import { userManager } from '../database/userManager';
import { auditManager } from '../database/auditManager';
import IdleChampionsApi, { ResponseStatus } from '../api/idleChampionsApi';
import logger from '../utils/logger';
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
  resetDatabase();
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
  // Leave nothing behind for the next test file (see src/test/db.ts).
  resetDatabase();
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

  test('reports a failed lookup with the /setup hint', async () => {
    getUserDetailsSpy.mockResolvedValue({ status: ResponseStatus.Failed } as any);
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(embedOf(editReplySpy).description).toContain('/setup');
  });

  test('an unexpected error is reported through replyWithError', async () => {
    const auditSpy = spyOn(auditManager, 'logAction').mockRejectedValue(new Error('boom'));
    // Stubbed: keeps the expected error out of test output.
    const errorSpy = spyOn(logger, 'error').mockImplementation((() => logger) as any);
    try {
      const { interaction, editReplySpy } = makeInteraction();

      await execute(interaction);

      const embed = embedOf(editReplySpy);
      expect(embed.title).toBe('❌ Error');
      expect(embed.description).toBe('An error occurred while retrieving your inventory.');
    } finally {
      auditSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

describe('/inventory – embed', () => {
  test('asks for /setup when no credentials are stored', async () => {
    resetDatabase();
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(getUserDetailsSpy).not.toHaveBeenCalled();
    expect(embedOf(editReplySpy).title).toContain('No Credentials Found');
  });

  test('renders gold, instances, rubies, heroes, progress and loot', async () => {
    getUserDetailsSpy.mockResolvedValue({
      details: {
        gold: '50000000000',
        red_rubies: 321,
        heroes: [{ hero_id: 1 }, { hero_id: 2 }],
        game_instances: [
          { gold: '2500000', current_adventure_id: 7, current_area: 50, highest_area: 75 },
          { gold: '1500', current_adventure_id: 8, current_area: 5, highest_area: 9 },
          { gold: '12', current_adventure_id: 9, current_area: 1, highest_area: 1 },
        ],
        loot: [{ rarity: 4 }, { rarity: 4 }, { rarity: 1 }, {}],
      },
    } as any);
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    const fields = Object.fromEntries(
      (embedOf(editReplySpy).fields as Array<{ name: string; value: string }>).map((f) => [
        f.name,
        f.value,
      ])
    );
    expect(fields['Total Gold (All Instances)']).toBe('5.00e+10');
    expect(fields['Gold Per Instance']).toContain('Instance 1: 2.5M');
    expect(fields['Gold Per Instance']).toContain('Instance 2: 1.5K');
    expect(fields['Gold Per Instance']).toContain('Instance 3: 12');
    expect(fields['Red Rubies']).toBe('321');
    expect(fields['Heroes Unlocked']).toBe('2');
    expect(fields['Adventure Progress']).toContain('Instance 1 (Adventure 7): Area 50/75');
    expect(fields['Equipment Quality']).toBe('• Legendary: 2\n• Uncommon: 1\n• Common: 1');
  });

  test('formats smaller gold totals', async () => {
    for (const [gold, shown] of [
      ['3000000', '3.0M'],
      ['4200', '4.2K'],
      ['7', '7'],
    ] as const) {
      getUserDetailsSpy.mockResolvedValue({ details: { gold } } as any);
      const { interaction, editReplySpy } = makeInteraction();

      await execute(interaction);

      const field = (embedOf(editReplySpy).fields as Array<{ name: string; value: string }>).find(
        (f) => f.name === 'Total Gold (All Instances)'
      );
      expect(field?.value).toBe(shown);
    }
  });
});
