import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { codeManager, type LootSummary } from '../database/codeManager';
import { userManager } from '../database/userManager';
import { auditManager } from '../database/auditManager';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Show server-wide redemption statistics');

const DISCORD_FIELD_MAX = 1024;

function formatLootSummary(loot: LootSummary): string {
  const parts: string[] = [];
  for (const [name, count] of Object.entries(loot.chests)) {
    if (count > 0) parts.push(`${name}: ${count.toLocaleString()}`);
  }
  for (const [name, count] of Object.entries(loot.items)) {
    if (count > 0) parts.push(`${name}: ${count.toLocaleString()}`);
  }
  if (parts.length === 0) return 'No loot data available';
  let result = '';
  for (const part of parts) {
    const next = result ? `${result}\n${part}` : part;
    if (next.length > DISCORD_FIELD_MAX - 2) {
      result += '\n…';
      break;
    }
    result = next;
  }
  return result;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // /stats is a public command; discordId is not required in the users table
    await auditManager.logAction(null, 'VIEWED_STATS', { discordId: interaction.user.id });

    const [codeStats, userCount, loot] = await Promise.all([
      codeManager.getServerCodeStats(),
      userManager.getUserCount(),
      codeManager.getAggregateLoot(),
    ]);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📊 Server Stats')
      .addFields(
        {
          name: '🎟️ Unique Codes Redeemed',
          value: codeStats.totalCodes.toLocaleString(),
          inline: true,
        },
        {
          name: '✅ Total Redemptions',
          value: codeStats.totalRedemptions.toLocaleString(),
          inline: true,
        },
        {
          name: '👥 Registered Users',
          value: userCount.toLocaleString(),
          inline: true,
        },
        {
          name: '📦 Total Loot Earned',
          value: formatLootSummary(loot),
          inline: false,
        }
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[STATS] Error:', error);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('Failed to retrieve server stats.');

    await interaction.editReply({ embeds: [embed] });
  }
}
