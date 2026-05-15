import { describe, test, expect, beforeAll, beforeEach, spyOn } from 'bun:test';
import { MessageFlags } from 'discord.js';
import { db, initializeDatabase } from '../database/db';
import { users, redeemedCodes, pendingCodes, auditLog } from '../database/schema/index';
import { userManager } from '../database/userManager';
import { execute } from './notifications';

// ---------------------------------------------------------------------------
// Interaction mock helpers
// ---------------------------------------------------------------------------

function makeInteraction(
  userId: string,
  options: Record<string, boolean | null> = {}
) {
  const editReplySpy = spyOn({ editReply: async (_: unknown) => {} }, 'editReply');
  const replySpy = spyOn({ reply: async (_: unknown) => {} }, 'reply');

  const interaction = {
    user: { id: userId, tag: `user#${userId}` },
    deferred: false,
    replied: false,
    deferReply: async () => { (interaction as any).deferred = true; },
    editReply: editReplySpy,
    reply: replySpy,
    options: {
      getBoolean: (name: string) => options[name] ?? null,
    },
  } as any;

  return { interaction, editReplySpy, replySpy };
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
  db.delete(users).run();
});

// ---------------------------------------------------------------------------
// No credentials
// ---------------------------------------------------------------------------

describe('/notifications – no credentials', () => {
  test('replies with error embed when user has no credentials', async () => {
    const { interaction, editReplySpy } = makeInteraction('unknown-user');

    await execute(interaction);

    expect(editReplySpy).toHaveBeenCalledTimes(1);
    const reply = editReplySpy.mock.calls[0]![0] as any;
    expect(reply.embeds[0].data.title).toContain('No Credentials Found');
  });
});

// ---------------------------------------------------------------------------
// Show current settings (no options)
// ---------------------------------------------------------------------------

describe('/notifications – show current settings', () => {
  test('shows defaults when no options are provided', async () => {
    await userManager.saveCredentials({ discordId: 'user-1', userId: '111', userHash: 'hash-a' });
    const { interaction, editReplySpy } = makeInteraction('user-1');

    await execute(interaction);

    expect(editReplySpy).toHaveBeenCalledTimes(1);
    const reply = editReplySpy.mock.calls[0]![0] as any;
    const embed = reply.embeds[0].data;
    expect(embed.title).toContain('Notification Preferences');
    const fieldValues = embed.fields.map((f: any) => f.value);
    // dmOnCode default false, dmOnSuccess default true, dmOnFailure default false
    expect(fieldValues[0]).toContain('Off');
    expect(fieldValues[1]).toContain('On');
    expect(fieldValues[2]).toContain('Off');
  });

  test('shows updated values after preferences have been changed', async () => {
    await userManager.saveCredentials({ discordId: 'user-1', userId: '111', userHash: 'hash-a' });
    await userManager.setNotificationPreferences('user-1', {
      dmOnCode: true,
      dmOnSuccess: false,
      dmOnFailure: true,
    });
    const { interaction, editReplySpy } = makeInteraction('user-1');

    await execute(interaction);

    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    const fieldValues = embed.fields.map((f: any) => f.value);
    expect(fieldValues[0]).toContain('On');
    expect(fieldValues[1]).toContain('Off');
    expect(fieldValues[2]).toContain('On');
  });
});

// ---------------------------------------------------------------------------
// Update preferences
// ---------------------------------------------------------------------------

describe('/notifications – update preferences', () => {
  test('enables dmOnCode and reflects it in the reply embed', async () => {
    await userManager.saveCredentials({ discordId: 'user-1', userId: '111', userHash: 'hash-a' });
    const { interaction, editReplySpy } = makeInteraction('user-1', { dm_on_code: true });

    await execute(interaction);

    // Verify DB was updated
    const creds = await userManager.getCredentials('user-1');
    expect(creds?.dmOnCode).toBe(true);

    // Verify reply embed shows correct state
    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    expect(embed.title).toContain('Updated');
    const fieldValues = embed.fields.map((f: any) => f.value);
    expect(fieldValues[0]).toContain('On'); // dmOnCode
    expect(fieldValues[1]).toContain('On'); // dmOnSuccess unchanged (default true)
    expect(fieldValues[2]).toContain('Off'); // dmOnFailure unchanged (default false)
  });

  test('disables dmOnSuccess', async () => {
    await userManager.saveCredentials({ discordId: 'user-1', userId: '111', userHash: 'hash-a' });
    const { interaction, editReplySpy } = makeInteraction('user-1', { dm_on_success: false });

    await execute(interaction);

    const creds = await userManager.getCredentials('user-1');
    expect(creds?.dmOnSuccess).toBe(false);

    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    const fieldValues = embed.fields.map((f: any) => f.value);
    expect(fieldValues[1]).toContain('Off');
  });

  test('enables dmOnFailure', async () => {
    await userManager.saveCredentials({ discordId: 'user-1', userId: '111', userHash: 'hash-a' });
    const { interaction, editReplySpy } = makeInteraction('user-1', { dm_on_failure: true });

    await execute(interaction);

    const creds = await userManager.getCredentials('user-1');
    expect(creds?.dmOnFailure).toBe(true);

    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    const fieldValues = embed.fields.map((f: any) => f.value);
    expect(fieldValues[2]).toContain('On');
  });

  test('updates all three prefs at once', async () => {
    await userManager.saveCredentials({ discordId: 'user-1', userId: '111', userHash: 'hash-a' });
    const { interaction } = makeInteraction('user-1', {
      dm_on_code: true,
      dm_on_success: false,
      dm_on_failure: true,
    });

    await execute(interaction);

    const creds = await userManager.getCredentials('user-1');
    expect(creds?.dmOnCode).toBe(true);
    expect(creds?.dmOnSuccess).toBe(false);
    expect(creds?.dmOnFailure).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Error path
// ---------------------------------------------------------------------------

describe('/notifications – error handling', () => {
  test('uses editReply when already deferred on error', async () => {
    await userManager.saveCredentials({ discordId: 'user-1', userId: '111', userHash: 'hash-a' });

    const { interaction, editReplySpy } = makeInteraction('user-1', { dm_on_code: true });
    // Force an error after deferReply by making setNotificationPreferences throw
    const spy = spyOn(userManager, 'setNotificationPreferences').mockRejectedValueOnce(
      new Error('DB error')
    );

    await execute(interaction);

    expect(editReplySpy).toHaveBeenCalled();
    const reply = editReplySpy.mock.calls[0]![0] as any;
    expect(reply.content).toContain('error');

    spy.mockRestore();
  });

  test('uses reply when not deferred on error', async () => {
    const { interaction, editReplySpy, replySpy } = makeInteraction('user-1', { dm_on_code: true });

    // deferReply throws so deferred stays false, getCredentials is never called
    (interaction as any).deferReply = async () => {
      throw new Error('interaction expired');
    };

    await execute(interaction);

    expect(editReplySpy).not.toHaveBeenCalled();
    expect(replySpy).toHaveBeenCalled();
    const reply = replySpy.mock.calls[0]![0] as any;
    expect(reply.content).toContain('error');
    expect(reply.flags).toBe(MessageFlags.Ephemeral);
  });
});
