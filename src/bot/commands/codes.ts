import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { codeManager, CHEST_TYPE_NAMES, type LootSummary } from '../database/codeManager';
import { auditManager } from '../database/auditManager';

export const PAGE_SIZE = 5;

export const data = new SlashCommandBuilder()
  .setName('codes')
  .setDescription('Show your redeemed codes history');

const DISCORD_FIELD_MAX = 1024;

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

  // Fetch page data; aggregate loot only on page 0 to avoid repeated O(N) full-table scans during pagination
  const [redeemedCodes, lootSummary] = await Promise.all([
    codeManager.getRedeemedCodeDetails(discordId, PAGE_SIZE, offset),
    safePage === 0 ? codeManager.getAggregateLoot(discordId) : Promise.resolve<LootSummary>({ chests: {}, items: {} }),
  ]);

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
        if (Array.isArray(loot) && loot.length > 0) {
          const lootParts = loot
            .map((item: any) => {
              const countVal = Number(item.count);
              if (!Number.isFinite(countVal) || countVal <= 0) return null;
              if (item.chest_type_id !== undefined) {
                const name = CHEST_TYPE_NAMES[item.chest_type_id as number] ?? `Chest ${item.chest_type_id}`;
                return `${name}: +${countVal}`;
              } else if (item.loot_item) {
                return `${(item.loot_item as string).replace(/_/g, ' ')}: x${countVal}`;
              }
              return null;
            })
            .filter(Boolean);
          if (lootParts.length > 0) {
            const rewardsStr = `**Rewards:** ${lootParts.join(', ')}`;
            const remaining = DISCORD_FIELD_MAX - fieldValue.length - 1;
            fieldValue += remaining > 0 ? rewardsStr.substring(0, remaining) + '\n' : '';
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

  if (safePage === 0) {
    const lootParts: string[] = [];
    for (const [name, count] of Object.entries(lootSummary.chests)) {
      if (count > 0) lootParts.push(`${name}: ${count.toLocaleString()}`);
    }
    for (const [name, count] of Object.entries(lootSummary.items)) {
      if (count > 0) lootParts.push(`${name}: ${count.toLocaleString()}`);
    }
    if (lootParts.length > 0) {
      let value = lootParts.join(' · ');
      if (value.length > DISCORD_FIELD_MAX) {
        let truncated = '';
        for (const part of lootParts) {
          const next = truncated ? `${truncated} · ${part}` : part;
          if (next.length > DISCORD_FIELD_MAX - 4) break;
          truncated = next;
        }
        value = `${truncated} …`;
      }
      embed.addFields({
        name: '📦 Total Loot Earned (All Codes)',
        value,
        inline: false,
      });
    }
  }

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
