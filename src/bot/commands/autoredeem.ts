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
  .setName('autoredeem')
  .setDescription('Toggle automatic redemption of new codes when they appear in the channel')
  .addStringOption((option) =>
    option
      .setName('enabled')
      .setDescription('Turn auto-redeem on or off')
      .setRequired(true)
      .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' })
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

    const enabled = interaction.options.getString('enabled', true) === 'on';
    await userManager.setAutoRedeem(interaction.user.id, enabled);

    await auditManager.logAction(interaction.user.id, 'AUTO_REDEEM_TOGGLED', { enabled });

    logger.info(`[AUTOREDEEM] User ${interaction.user.tag} set auto-redeem to ${enabled}`);

    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x00ff00 : 0xffaa00)
      .setTitle(enabled ? '✅ Auto-Redeem Enabled' : '⏸️ Auto-Redeem Disabled')
      .setDescription(
        enabled
          ? 'New codes posted in the channel will be automatically redeemed for you.'
          : 'New codes will **not** be automatically redeemed. Use `/redeem` or the backfill mechanism to redeem codes manually.'
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[AUTOREDEEM] Error:', error);
    await interaction.editReply({
      content: '❌ An error occurred while updating your auto-redeem setting.',
    });
  }
}
