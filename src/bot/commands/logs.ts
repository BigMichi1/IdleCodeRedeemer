import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

const LOG_FILE = path.join(process.cwd(), 'logs', 'combined.log');
const MAX_LINES = 100;
const EMBED_DESCRIPTION_LIMIT = 4096;

// Patterns that must never be shown in Discord (credentials logged by bot.ts command handler)
const SENSITIVE_PATTERN = /\b(user_hash|user_id|hash|token)=\S+/gi;

function redactSensitive(line: string): string {
  return line.replace(SENSITIVE_PATTERN, (_, key: string) => `${key}=[REDACTED]`);
}

function readLastLines(filePath: string, n: number): string[] {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  // trimEnd removes the trailing newline that log files end with; blank lines
  // within the log are preserved so the tail window is not shifted.
  const lines = content.trimEnd().split('\n');
  return lines.slice(-n).map(redactSensitive);
}

export const data = new SlashCommandBuilder()
  .setName('logs')
  .setDescription('Show the last N lines of the bot log (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption((option) =>
    option
      .setName('lines')
      .setDescription(`Number of log lines to show (1-${MAX_LINES}, default 20)`)
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(MAX_LINES)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Permission Denied')
        .setDescription('You need the "Manage Messages" permission to view logs.');
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const n = interaction.options.getInteger('lines') ?? 20;
    logger.debug(`[LOGS CMD] ${interaction.user.tag} requested last ${n} log lines`);

    const lines = readLastLines(LOG_FILE, n);

    if (lines.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('📋 Bot Logs')
        .setDescription('No log entries found.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Escape triple-backticks in log content to prevent breaking the code block
    const safeLines = lines.map((l) => l.replaceAll('```', "'''"));

    // Build the code block and truncate from the start if it exceeds Discord's limit
    const codeBlockOverhead = '```\n'.length + '\n```'.length;
    const maxContent = EMBED_DESCRIPTION_LIMIT - codeBlockOverhead;

    let content = safeLines.join('\n');
    let truncated = false;
    if (content.length > maxContent) {
      content = content.slice(content.length - maxContent);
      // Trim to a clean line boundary
      const firstNewline = content.indexOf('\n');
      if (firstNewline !== -1) content = content.slice(firstNewline + 1);
      truncated = true;
    }

    const displayedLineCount = content.split('\n').length;
    const description = `\`\`\`\n${content}\n\`\`\``;
    const title = truncated
      ? `📋 Bot Logs (showing ${displayedLineCount} of ${lines.length} lines — truncated)`
      : `📋 Bot Logs (last ${lines.length} lines)`;

    const embed = new EmbedBuilder().setColor(0x0099ff).setTitle(title).setDescription(description);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[LOGS CMD] Error:', error);
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('Failed to read log file.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }
}
