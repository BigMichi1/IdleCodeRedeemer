import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { codeManager } from '../database/codeManager';
import { auditManager } from '../database/auditManager';

export const PAGE_SIZE = 5;

export const data = new SlashCommandBuilder()
  .setName('codes')
  .setDescription('Show your redeemed codes history');

export async function buildCodesPage(
  discordId: string,
  page: number
): Promise<{ embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] }> {
  const total = await codeManager.getRedeemedCodeCount(discordId);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const offset = safePage * PAGE_SIZE;

  if (total === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('📝 Redeemed Codes History')
      .setDescription("You haven't redeemed any codes yet.");
    return { embeds: [embed], components: [] };
  }

  const redeemedCodes = await codeManager.getRedeemedCodeDetails(discordId, PAGE_SIZE, offset);

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('📝 Your Redeemed Codes')
    .setFooter({ text: `Page ${safePage + 1} of ${totalPages} · ${total} total` });

  redeemedCodes.forEach((codeRow, index) => {
    const statusLower = (codeRow.status || 'unknown').toLowerCase();
    const statusEmoji =
      {
        success: '✅',
        'code expired': '❌',
        error: '⚠️',
      }[statusLower] || '❓';

    const dateStr = codeRow.redeemedAt
      ? new Date(codeRow.redeemedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Unknown';

    const publicBadge = codeRow.isPublic ? ' 🌐' : '';

    let fieldValue = `**Status:** ${statusEmoji} ${statusLower}\n`;
    fieldValue += `**Redeemed:** ${dateStr}\n`;

    if (codeRow.lootDetail) {
      try {
        const loot = JSON.parse(codeRow.lootDetail);
        if (loot && typeof loot === 'object') {
          const lootParts = [];
          if (loot.gold) lootParts.push(`Gold: ${loot.gold}`);
          if (loot.rubies) lootParts.push(`Rubies: ${loot.rubies}`);
          if (loot.equipment) lootParts.push(`Equipment: ${loot.equipment}`);
          if (lootParts.length > 0) {
            fieldValue += `**Rewards:** ${lootParts.join(', ')}\n`;
          }
        }
      } catch {
        // Skip if loot detail is not valid JSON
      }
    }

    embed.addFields({
      name: `${offset + index + 1}. ${codeRow.code}${publicBadge}`,
      value: fieldValue,
      inline: false,
    });
  });

  const prevButton = new ButtonBuilder()
    .setCustomId(`codes:${discordId}:${safePage - 1}`)
    .setLabel('◀ Prev')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(safePage === 0);

  const nextButton = new ButtonBuilder()
    .setCustomId(`codes:${discordId}:${safePage + 1}`)
    .setLabel('Next ▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(safePage >= totalPages - 1);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

  return { embeds: [embed], components: [row] };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await auditManager.logAction(interaction.user.id, 'VIEWED_CODES', {});

    const { embeds, components } = await buildCodesPage(interaction.user.id, 0);
    await interaction.editReply({ embeds, components });
  } catch (error) {
    console.error('[CODES] Error:', error);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('Failed to retrieve redeemed codes.');

    await interaction.editReply({ embeds: [embed] });
  }
}
