import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { codeManager } from '../database/codeManager';
import { auditManager } from '../database/auditManager';

export const data = new SlashCommandBuilder()
  .setName('codes')
  .setDescription('Show your redeemed codes history (last 10)')
  .addNumberOption((option) =>
    option
      .setName('count')
      .setDescription('Number of codes to show (1-20)')
      .setMinValue(1)
      .setMaxValue(20)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const count = interaction.options.getNumber('count', false) || 10;

    // Log action
    await auditManager.logAction(interaction.user.id, 'VIEWED_CODES', { count });

    const redeemedCodes = await codeManager.getRedeemedCodeDetails(interaction.user.id, count);

    if (redeemedCodes.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('📝 Redeemed Codes History')
        .setDescription("You haven't redeemed any codes yet.");

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📝 Your Redeemed Codes')
      .setDescription(`Showing your last ${redeemedCodes.length} redeemed codes`)
      .setFooter({ text: `Total shown: ${redeemedCodes.length}` });

    redeemedCodes.forEach((codeRow, index) => {
      const statusLower = (codeRow.status || 'unknown').toLowerCase();
      const statusEmoji =
        {
          success: '✅',
          expired: '❌',
          error: '⚠️',
        }[statusLower] || '❓';

      const dateStr = new Date(codeRow.redeemed_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      const publicBadge = codeRow.is_public ? ' 🌐 (Public)' : '';

      let fieldValue = `**Status:** ${statusEmoji} ${statusLower}\n`;
      fieldValue += `**Redeemed:** ${dateStr}\n`;

      if (codeRow.loot_detail) {
        try {
          const loot = JSON.parse(codeRow.loot_detail);
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
        name: `${index + 1}. ${codeRow.code}${publicBadge}`,
        value: fieldValue,
        inline: false,
      });
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[CODES] Error:', error);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('Failed to retrieve redeemed codes.');

    await interaction.editReply({ embeds: [embed] });
  }
}
