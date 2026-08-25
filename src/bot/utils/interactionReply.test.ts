import { describe, test, expect } from 'bun:test';
import { replyWithError } from './interactionReply';

// ---------------------------------------------------------------------------
// Commands previously called interaction.editReply() directly inside catch. If
// the original failure WAS the deferReply(), editReply rejects too, the catch
// throws a second time, and an unhandled rejection escapes an async listener
// while the user sees "The application did not respond".
// ---------------------------------------------------------------------------

type Call = { method: string; payload: any };

function fakeInteraction(opts: {
  deferred?: boolean;
  replied?: boolean;
  editReplyThrows?: boolean;
  replyThrows?: boolean;
}) {
  const calls: Call[] = [];
  return {
    calls,
    interaction: {
      deferred: opts.deferred ?? false,
      replied: opts.replied ?? false,
      isChatInputCommand: () => true,
      commandName: 'redeem',
      async editReply(payload: any) {
        calls.push({ method: 'editReply', payload });
        if (opts.editReplyThrows) throw new Error('Unknown interaction');
        return {};
      },
      async reply(payload: any) {
        calls.push({ method: 'reply', payload });
        if (opts.replyThrows) throw new Error('Unknown interaction');
        return {};
      },
    } as any,
  };
}

describe('replyWithError', () => {
  test('uses editReply when the interaction was deferred', async () => {
    const { calls, interaction } = fakeInteraction({ deferred: true });
    await replyWithError(interaction, '❌ Error', 'Could not determine game server.');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('editReply');
  });

  test('uses editReply when the interaction was already replied to', async () => {
    const { calls, interaction } = fakeInteraction({ replied: true });
    await replyWithError(interaction, '❌ Error', 'boom');
    expect(calls[0]!.method).toBe('editReply');
  });

  test('uses reply when the interaction is untouched', async () => {
    // This is the case that used to throw: editReply on a never-deferred
    // interaction rejects.
    const { calls, interaction } = fakeInteraction({});
    await replyWithError(interaction, '❌ Error', 'boom');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('reply');
  });

  test('does not throw when the interaction token has expired', async () => {
    const { interaction } = fakeInteraction({ deferred: true, editReplyThrows: true });
    // The whole point: a failure to deliver the error report must not become a
    // second exception escaping the command's catch block.
    await expect(replyWithError(interaction, '❌ Error', 'boom')).resolves.toBeUndefined();
  });

  test('does not throw when a fresh reply also fails', async () => {
    const { interaction } = fakeInteraction({ replyThrows: true });
    await expect(replyWithError(interaction, '❌ Error', 'boom')).resolves.toBeUndefined();
  });

  test('sends the given title and description in a red embed', async () => {
    const { calls, interaction } = fakeInteraction({ deferred: true });
    await replyWithError(interaction, '❌ Could Not Open Chests', 'The game server rejected it.');

    const embed = calls[0]!.payload.embeds[0];
    expect(embed.data.title).toBe('❌ Could Not Open Chests');
    expect(embed.data.description).toBe('The game server rejected it.');
    expect(embed.data.color).toBe(0xff0000);
  });
});
