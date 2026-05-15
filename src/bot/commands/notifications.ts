import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { userManager } from '../database/userManager';
import { auditManager } from '../database/auditManager';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('notifications')
  .setDescription('Configure your DM notification preferences')
  .addBooleanOption((option) =>
    option
      .setName('dm_on_code')
      .setDescription(
        'DM on new code detection. Tip: enabling dm_on_success too sends two DMs per code.'
      )
      .setRequired(false)
  )
  .addBooleanOption((option) =>
    option
      .setName('dm_on_success')
      .setDescription('DM when auto-redeem successfully redeems a code for you')
      .setRequired(false)
  )
  .addBooleanOption((option) =>
    option
      .setName('dm_on_failure')
      .setDescription('DM when auto-redeem fails to redeem a code for you')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const credentials = await userManager.getCredentials(interaction.user.id);
    if (!credentials) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Credentials Found')
        .setDescription('Please set up your Idle Champions credentials first using `/setup`');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const dmOnCode = interaction.options.getBoolean('dm_on_code');
    const dmOnSuccess = interaction.options.getBoolean('dm_on_success');
    const dmOnFailure = interaction.options.getBoolean('dm_on_failure');

    // If no options were provided, show current settings
    if (dmOnCode === null && dmOnSuccess === null && dmOnFailure === null) {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🔔 Notification Preferences')
        .setDescription('Your current DM notification settings:')
        .addFields(
          {
            name: '📣 DM on code detected',
            value: credentials.dmOnCode ? '✅ On' : '❌ Off',
            inline: true,
          },
          {
            name: '✅ DM on successful redeem',
            value: credentials.dmOnSuccess ? '✅ On' : '❌ Off',
            inline: true,
          },
          {
            name: '⚠️ DM on failed redeem',
            value: credentials.dmOnFailure ? '✅ On' : '❌ Off',
            inline: true,
          }
        )
        .setFooter({ text: 'Use /notifications with options to change these settings' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const updates: { dmOnCode?: boolean; dmOnSuccess?: boolean; dmOnFailure?: boolean } = {};
    if (dmOnCode !== null) updates.dmOnCode = dmOnCode;
    if (dmOnSuccess !== null) updates.dmOnSuccess = dmOnSuccess;
    if (dmOnFailure !== null) updates.dmOnFailure = dmOnFailure;

    const updated = await userManager.setNotificationPreferences(interaction.user.id, updates);
    if (!updated) {
      await interaction.editReply({ content: '⚠️ Could not update preferences — your account may no longer exist.' });
      return;
    }
    await auditManager.logAction(interaction.user.id, 'NOTIFICATION_PREFS_UPDATED', updates);

    logger.info(`[NOTIFICATIONS] User ${interaction.user.tag} updated notification prefs: ${JSON.stringify(updates)}`);

    // Merge updates into current values for display
    const current = {
      dmOnCode: updates.dmOnCode ?? credentials.dmOnCode,
      dmOnSuccess: updates.dmOnSuccess ?? credentials.dmOnSuccess,
      dmOnFailure: updates.dmOnFailure ?? credentials.dmOnFailure,
    };

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Notification Preferences Updated')
      .addFields(
        {
          name: '📣 DM on code detected',
          value: current.dmOnCode ? '✅ On' : '❌ Off',
          inline: true,
        },
        {
          name: '✅ DM on successful redeem',
          value: current.dmOnSuccess ? '✅ On' : '❌ Off',
          inline: true,
        },
        {
          name: '⚠️ DM on failed redeem',
          value: current.dmOnFailure ? '✅ On' : '❌ Off',
          inline: true,
        }
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[NOTIFICATIONS] Error:', error);
    const msg = { content: '❌ An error occurred while handling your notification preferences.' };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ ...msg, flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      logger.error('[NOTIFICATIONS] Failed to send error response:', replyError);
    }
  }
}
