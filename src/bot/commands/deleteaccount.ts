import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import { userManager } from '../database/userManager';
import { codeManager } from '../database/codeManager';
import { auditManager } from '../database/auditManager';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('deleteaccount')
  .setDescription('Permanently delete all your data from this bot (credentials, code history, audit log)');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const hasCredentials = await userManager.hasCredentials(interaction.user.id);

    if (!hasCredentials) {
      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('⚠️ No Account Found')
        .setDescription('You have no stored data in this bot — nothing to delete.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⚠️ Delete Account — Are you sure?')
      .setDescription(
        'This will **permanently and irreversibly** delete all of your data:\n\n' +
          '• Your Idle Champions credentials\n' +
          '• Your full code redemption history\n' +
          '• Your audit log entries\n\n' +
          'You will need to run `/setup` again to use the bot after this.'
      )
      .setFooter({ text: 'This action cannot be undone. Confirmation expires in 30 seconds.' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('deleteaccount_confirm')
        .setLabel('Yes, delete everything')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('deleteaccount_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const reply = await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

    let buttonInteraction;
    try {
      buttonInteraction = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 30_000,
      });
    } catch {
      // Timed out — disable the buttons
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('deleteaccount_confirm')
          .setLabel('Yes, delete everything')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('deleteaccount_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x888888)
            .setTitle('⏱️ Confirmation Timed Out')
            .setDescription('No response received within 30 seconds. Account deletion cancelled.'),
        ],
        components: [disabledRow],
      });
      return;
    }

    await buttonInteraction.deferUpdate();

    if (buttonInteraction.customId === 'deleteaccount_cancel') {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00aa00)
            .setTitle('✅ Cancelled')
            .setDescription('Account deletion cancelled. Your data has not been changed.'),
        ],
        components: [],
      });
      return;
    }

    // Perform deletion — order matters for FK constraints:
    // pending_codes.discord_id → users.discord_id (no cascade), so clear it first
    await codeManager.clearPendingCodes(interaction.user.id);
    const deletedCodesCount = await codeManager.deleteUserRedeemedCodes(interaction.user.id);
    await auditManager.deleteUserAuditLog(interaction.user.id);
    await userManager.deleteCredentials(interaction.user.id);

    // Log a non-identifying event — the user's credentials and ID are now gone
    logger.info(
      `[DELETE ACCOUNT] Account deletion completed. Removed ${deletedCodesCount} redeemed code record(s).`
    );

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Account Deleted')
          .setDescription(
            'All your data has been permanently removed:\n\n' +
              `• Credentials deleted\n` +
              `• ${deletedCodesCount} code record(s) deleted\n` +
              '• Audit log entries deleted\n\n' +
              'If you want to use the bot again in the future, simply run `/setup`.'
          ),
      ],
      components: [],
    });
  } catch (error) {
    logger.error('[DELETE ACCOUNT] Error:', error);
    await interaction.editReply({
      content: '❌ An error occurred while deleting your account. Please try again later.',
    });
  }
}
