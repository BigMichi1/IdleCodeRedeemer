import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { backfillManager } from '../database/backfillManager';
import { backfillChannelHistory } from '../handlers/backfillHandler';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('backfill')
  .setDescription('Backfill message history to find and redeem missed codes')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('The channel to backfill (defaults to current channel)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logger.info(`[BACKFILL CMD] Started by ${interaction.user.tag}`);

    // Check permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Permission Denied')
        .setDescription('You need the "Manage Messages" permission to run backfill.');

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    // Check if backfill is already in progress
    if (backfillManager.isBackfillInProgress()) {
      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('⚠️ Backfill In Progress')
        .setDescription(
          'A backfill operation is already running. Please wait for it to complete.'
        );

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    // Check rate limiting
    const canInitiate = await backfillManager.canUserInitiateBackfill(interaction.user.id);
    if (!canInitiate) {
      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('⏱️ Rate Limited')
        .setDescription(
          'You can only initiate a backfill once per hour. Please try again later.'
        );

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    // Get the target channel
    let targetChannel: any = interaction.options.getChannel('channel');
    if (!targetChannel) {
      targetChannel = interaction.channel;
    }

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Invalid channel - must be a text channel in this server.');

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    // Defer the reply (backfill can take a while)
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Start the backfill operation
    const operationId = await backfillManager.startBackfill(interaction.user.id);
    logger.info(`[BACKFILL CMD] Operation ${operationId} started for channel ${targetChannel.name}`);

    // Create progress tracker
    let progressMessage = '';
    const updateProgress = (message: string) => {
      progressMessage = message;
      logger.info(`[BACKFILL] ${message}`);
    };

    // Run the backfill
    const stats = await backfillChannelHistory(targetChannel, updateProgress);

    // Update operation status
    await backfillManager.updateBackfill(
      operationId,
      stats.codesFound,
      stats.codesRedeemed,
      stats.errors.length === 0 ? 'completed' : 'failed'
    );

    // Create result embed
    const embed = new EmbedBuilder()
      .setColor(stats.errors.length === 0 ? 0x00aa00 : 0xffaa00)
      .setTitle('✅ Backfill Complete')
      .setDescription(
        [
          `**Codes Found:** ${stats.codesFound}`,
          `**Codes Redeemed:** ${stats.codesRedeemed}`,
          `**Pending Codes:** ${stats.pendingCodes}`,
        ].join('\n')
      );

    if (stats.errors.length > 0) {
      embed.addFields({
        name: '⚠️ Errors',
        value: stats.errors.slice(0, 5).join('\n'), // Show first 5 errors
      });
    }

    embed.setFooter({
      text: `Operation ID: ${operationId}`,
    });

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      `[BACKFILL CMD] Operation ${operationId} completed: found=${stats.codesFound}, redeemed=${stats.codesRedeemed}`
    );
  } catch (error) {
    logger.error('[BACKFILL CMD] Command error:', error);

    try {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription(
          `An error occurred during backfill: ${error instanceof Error ? error.message : String(error)}`
        );

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      logger.error('[BACKFILL CMD] Failed to send error reply:', replyError);
    }
  }
}
