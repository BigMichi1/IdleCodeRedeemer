import { describe, test, expect, beforeAll, beforeEach, spyOn } from 'bun:test';
import { db, initializeDatabase } from '../database/db';
import { users, redeemedCodes, pendingCodes, auditLog, lootTotals } from '../database/schema/index';
import { userManager } from '../database/userManager';
import { codeManager } from '../database/codeManager';
import { execute } from './stats';

// ---------------------------------------------------------------------------
// Interaction mock helper
// ---------------------------------------------------------------------------

function makeInteraction(userId: string) {
  const editReplySpy = spyOn({ editReply: async (_: unknown) => {} }, 'editReply');

  const interaction = {
    user: { id: userId, tag: `user#${userId}` },
    deferred: false,
    deferReply: async () => {
      (interaction as any).deferred = true;
    },
    editReply: editReplySpy,
  } as any;

  return { interaction, editReplySpy };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(() => {
  initializeDatabase();
});

beforeEach(() => {
  db.delete(auditLog).run();
  db.delete(pendingCodes).run();
  db.delete(redeemedCodes).run();
  db.delete(lootTotals).run();
  db.delete(users).run();
});

// ---------------------------------------------------------------------------
// Happy path — empty database
// ---------------------------------------------------------------------------

describe('/stats – empty database', () => {
  test('defers reply and returns stats embed', async () => {
    const { interaction, editReplySpy } = makeInteraction('user-1');

    await execute(interaction);

    expect(interaction.deferred).toBe(true);
    expect(editReplySpy).toHaveBeenCalledTimes(1);
    const reply = editReplySpy.mock.calls[0]![0] as any;
    const embed = reply.embeds[0].data;
    expect(embed.title).toContain('Server Stats');
  });

  test('shows zero codes and zero users when database is empty', async () => {
    const { interaction, editReplySpy } = makeInteraction('user-1');

    await execute(interaction);

    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    const fields = embed.fields as Array<{ name: string; value: string }>;
    const codesField = fields.find(f => f.name.includes('Unique Codes'));
    const usersField = fields.find(f => f.name.includes('Registered Users'));
    expect(codesField?.value).toBe('0');
    expect(usersField?.value).toBe('0');
  });

  test('shows "No loot data available" when no codes have been redeemed', async () => {
    const { interaction, editReplySpy } = makeInteraction('user-1');

    await execute(interaction);

    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    const fields = embed.fields as Array<{ name: string; value: string }>;
    const lootField = fields.find(f => f.name.includes('Loot'));
    expect(lootField?.value).toBe('No loot data available');
  });
});

// ---------------------------------------------------------------------------
// Happy path — with data
// ---------------------------------------------------------------------------

describe('/stats – with redeemed codes and users', () => {
  beforeEach(async () => {
    await userManager.saveCredentials({ discordId: 'user-1', userId: '111', userHash: 'aaa' });
    await userManager.saveCredentials({ discordId: 'user-2', userId: '222', userHash: 'bbb' });
    await codeManager.addRedeemedCode('CODE-A', 'user-1', 'Success', [{ chest_type_id: 1, count: 2 }] as any);
    await codeManager.addRedeemedCode('CODE-B', 'user-2', 'Success', [{ chest_type_id: 2, count: 1 }] as any);
    await codeManager.addRedeemedCode('CODE-A', 'user-2', 'Success');
  });

  test('shows correct unique code count', async () => {
    const { interaction, editReplySpy } = makeInteraction('user-1');

    await execute(interaction);

    const fields = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data.fields as Array<{ name: string; value: string }>;
    const codesField = fields.find(f => f.name.includes('Unique Codes'));
    expect(codesField?.value).toBe('2');
  });

  test('shows correct total redemptions count', async () => {
    const { interaction, editReplySpy } = makeInteraction('user-1');

    await execute(interaction);

    const fields = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data.fields as Array<{ name: string; value: string }>;
    const redemptionsField = fields.find(f => f.name.includes('Total Redemptions'));
    expect(redemptionsField?.value).toBe('3');
  });

  test('shows correct registered user count', async () => {
    const { interaction, editReplySpy } = makeInteraction('user-1');

    await execute(interaction);

    const fields = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data.fields as Array<{ name: string; value: string }>;
    const usersField = fields.find(f => f.name.includes('Registered Users'));
    expect(usersField?.value).toBe('2');
  });

  test('aggregates loot across all users and codes', async () => {
    const { interaction, editReplySpy } = makeInteraction('user-1');

    await execute(interaction);

    const fields = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data.fields as Array<{ name: string; value: string }>;
    const lootField = fields.find(f => f.name.includes('Loot'));
    expect(lootField?.value).toContain('Silver Chest: 2');
    expect(lootField?.value).toContain('Gold Chest: 1');
  });

  test('logs VIEWED_STATS to the audit log', async () => {
    const { interaction } = makeInteraction('user-1');

    await execute(interaction);

    const rows = db.select().from(auditLog).all();
    const statsRow = rows.find(r => r.action === 'VIEWED_STATS');
    expect(statsRow).toBeDefined();
    // discordId is null because /stats is public (no user registration required)
    expect(statsRow?.discordId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('/stats – error handling', () => {
  test('replies with error embed when an exception is thrown', async () => {
    const editReplySpy = spyOn({ editReply: async (_: unknown) => {} }, 'editReply');
    const interaction = {
      user: { id: 'user-1', tag: 'user#1' },
      deferred: false,
      deferReply: async () => { throw new Error('network failure'); },
      editReply: editReplySpy,
    } as any;

    await execute(interaction);

    expect(editReplySpy).toHaveBeenCalledTimes(1);
    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    expect(embed.title).toContain('Error');
  });
});
