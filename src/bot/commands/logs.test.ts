import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { MessageFlags } from 'discord.js';
import fs from 'fs';
import { execute } from './logs';

// ---------------------------------------------------------------------------
// Interaction mock helpers
// ---------------------------------------------------------------------------

function makeInteraction(opts: { hasPermission?: boolean; lines?: number | null } = {}) {
  const { hasPermission = true, lines = null } = opts;

  const editReplySpy = spyOn({ editReply: async (_: unknown) => {} }, 'editReply');
  const replySpy = spyOn({ reply: async (_: unknown) => {} }, 'reply');

  const interaction = {
    user: { id: 'admin-1', tag: 'admin#0001' },
    deferred: false,
    replied: false,
    memberPermissions: hasPermission ? { has: () => true } : null,
    deferReply: async () => {
      (interaction as any).deferred = true;
    },
    editReply: editReplySpy,
    reply: replySpy,
    options: {
      getInteger: (name: string) => (name === 'lines' ? lines : null),
    },
  } as any;

  return { interaction, editReplySpy, replySpy };
}

// Sample log lines used across multiple tests
const SAMPLE_LINES = Array.from(
  { length: 50 },
  (_, i) => `2026-05-24 12:00:${String(i).padStart(2, '0')} [INFO]: Log message ${i}`
);
const SAMPLE_CONTENT = SAMPLE_LINES.join('\n');

// ---------------------------------------------------------------------------
// Permission denied
// ---------------------------------------------------------------------------

describe('/logs – permission denied', () => {
  test('replies ephemerally with "Permission Denied" when user lacks ManageMessages', async () => {
    const { interaction, replySpy } = makeInteraction({ hasPermission: false });

    await execute(interaction);

    expect(replySpy).toHaveBeenCalledTimes(1);
    const reply = replySpy.mock.calls[0]![0] as any;
    expect(reply.embeds[0].data.title).toContain('Permission Denied');
    expect(reply.flags).toBe(MessageFlags.Ephemeral);
    expect(interaction.deferred).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Log file missing
// ---------------------------------------------------------------------------

describe('/logs – log file missing', () => {
  let existsSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    existsSpy = spyOn(fs, 'existsSync').mockReturnValue(false);
  });

  afterEach(() => {
    existsSpy.mockRestore();
  });

  test('defers reply and shows "No log entries found" when combined.log does not exist', async () => {
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(interaction.deferred).toBe(true);
    expect(editReplySpy).toHaveBeenCalledTimes(1);
    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    expect(embed.description).toContain('No log entries found');
  });
});

// ---------------------------------------------------------------------------
// Reading log lines
// ---------------------------------------------------------------------------

describe('/logs – reading log lines', () => {
  let existsSpy: ReturnType<typeof spyOn>;
  let readSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    existsSpy = spyOn(fs, 'existsSync').mockReturnValue(true);
    readSpy = spyOn(fs, 'readFileSync').mockReturnValue(SAMPLE_CONTENT);
  });

  afterEach(() => {
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  test('defers reply', async () => {
    const { interaction } = makeInteraction({ lines: 5 });

    await execute(interaction);

    expect(interaction.deferred).toBe(true);
  });

  test('defaults to 20 lines when no lines param is provided', async () => {
    const { interaction, editReplySpy } = makeInteraction({ lines: null });

    await execute(interaction);

    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    expect(embed.title).toContain('last 20 lines');
    const lastTwenty = SAMPLE_LINES.slice(-20);
    expect(embed.description).toContain(lastTwenty[0]);
    expect(embed.description).toContain(lastTwenty[19]);
  });

  test('respects custom lines parameter', async () => {
    const { interaction, editReplySpy } = makeInteraction({ lines: 5 });

    await execute(interaction);

    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    expect(embed.title).toContain('last 5 lines');
    const lastFive = SAMPLE_LINES.slice(-5);
    for (const line of lastFive) {
      expect(embed.description).toContain(line);
    }
    // Lines outside the requested range must not appear
    expect(embed.description).not.toContain(SAMPLE_LINES[0]);
  });

  test('wraps output in a code block', async () => {
    const { interaction, editReplySpy } = makeInteraction({ lines: 3 });

    await execute(interaction);

    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    expect(embed.description).toMatch(/^```\n/);
    expect(embed.description).toMatch(/\n```$/);
  });

  test('title includes the actual number of lines returned', async () => {
    const { interaction, editReplySpy } = makeInteraction({ lines: 10 });

    await execute(interaction);

    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    expect(embed.title).toContain('10 lines');
  });

  test('redacts sensitive credential fields from log lines', async () => {
    const sensitiveContent = [
      '2026-05-24 12:00:01 [INFO]: [CMD] admin#0001 used /setup: user_id=123456 user_hash=supersecret',
      '2026-05-24 12:00:02 [INFO]: [CMD] admin#0001 used /redeem: code=ABC-123',
      '2026-05-24 12:00:03 [INFO]: token=mytoken hash=myhash normal log line',
    ].join('\n');

    readSpy.mockReturnValue(sensitiveContent);
    const { interaction, editReplySpy } = makeInteraction({ lines: 10 });

    await execute(interaction);

    const desc = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data.description;
    expect(desc).not.toContain('supersecret');
    expect(desc).not.toContain('mytoken');
    expect(desc).not.toContain('myhash');
    expect(desc).toContain('user_hash=[REDACTED]');
    expect(desc).toContain('user_id=[REDACTED]');
    expect(desc).toContain('token=[REDACTED]');
    expect(desc).toContain('hash=[REDACTED]');
    // Non-sensitive fields must not be redacted
    expect(desc).toContain('code=ABC-123');
  });

  test('preserves blank lines within the log (only trailing newline is stripped)', async () => {
    const contentWithBlanks = 'line-a\n\nline-b\n\nline-c\n';
    readSpy.mockReturnValue(contentWithBlanks);
    const { interaction, editReplySpy } = makeInteraction({ lines: 10 });

    await execute(interaction);

    const desc = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data.description;
    // All five lines (including the two blank ones) must be present
    expect(desc).toContain('line-a');
    expect(desc).toContain('line-b');
    expect(desc).toContain('line-c');
    // The title should report 5 lines (line-a, blank, line-b, blank, line-c)
    expect((editReplySpy.mock.calls[0]![0] as any).embeds[0].data.title).toContain('5 lines');
  });

  test('escapes triple-backticks in log content to prevent breaking the code block', async () => {
    const contentWithBackticks = '2026-05-24 12:00:01 [INFO]: line with ```backticks``` inside';
    readSpy.mockReturnValue(contentWithBackticks);
    const { interaction, editReplySpy } = makeInteraction({ lines: 5 });

    await execute(interaction);

    const desc = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data.description;
    // The injected triple-backticks must be replaced
    expect(desc).toContain("'''backticks'''");
    // Overall structure must still be a valid code block
    expect(desc).toMatch(/^```\n/);
    expect(desc).toMatch(/\n```$/);
  });
});

// ---------------------------------------------------------------------------
// Truncation
// ---------------------------------------------------------------------------

describe('/logs – truncation', () => {
  let existsSpy: ReturnType<typeof spyOn>;
  let readSpy: ReturnType<typeof spyOn>;

  // Build a log whose content far exceeds the 4096-char embed limit
  const bigLine = 'X'.repeat(80);
  const bigLines = Array.from({ length: 100 }, (_, i) => `${bigLine} line-${i}`);
  const bigContent = bigLines.join('\n');

  beforeEach(() => {
    existsSpy = spyOn(fs, 'existsSync').mockReturnValue(true);
    readSpy = spyOn(fs, 'readFileSync').mockReturnValue(bigContent);
  });

  afterEach(() => {
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  test('embed description stays within the 4096-char limit', async () => {
    const { interaction, editReplySpy } = makeInteraction({ lines: 100 });

    await execute(interaction);

    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    expect(embed.description.length).toBeLessThanOrEqual(4096);
  });

  test('title shows displayed vs requested line count when truncated', async () => {
    const { interaction, editReplySpy } = makeInteraction({ lines: 100 });

    await execute(interaction);

    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    expect(embed.title).toContain('truncated');
    // e.g. "showing 45 of 100 lines — truncated"
    expect(embed.title).toMatch(/showing \d+ of 100 lines/);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('/logs – error handling', () => {
  let existsSpy: ReturnType<typeof spyOn>;
  let readSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    existsSpy = spyOn(fs, 'existsSync').mockReturnValue(true);
    readSpy = spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('disk read error');
    });
  });

  afterEach(() => {
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  test('replies with error embed when log file cannot be read', async () => {
    const { interaction, editReplySpy } = makeInteraction();

    await execute(interaction);

    expect(editReplySpy).toHaveBeenCalledTimes(1);
    const embed = (editReplySpy.mock.calls[0]![0] as any).embeds[0].data;
    expect(embed.title).toContain('Error');
    expect(embed.description).toContain('Failed to read log file');
  });
});
