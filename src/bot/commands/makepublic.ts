import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { codeManager } from '../database/codeManager';

export const data = new SlashCommandBuilder()
  .setName('makepublic')
  .setDescription('Share one of your redeemed codes with other users')
  .addStringOption((option) =>
    option.setName('code').setDescription('The code you want to share').setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const code = interaction.options.getString('code', true).toUpperCase().replaceAll('-', '');

    // Check if user has redeemed this code
    const userCodes = await codeManager.getRedeemedCodes(interaction.user.id);
    if (!userCodes.includes(code)) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Code Not Found')
        .setDescription(
          `You haven't redeemed the code \`${code}\`.\n\nYou can only share codes that you've already redeemed.`
        );

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Mark code as public
    await codeManager.markCodeAsPublic(code);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Code Shared Successfully')
      .setDescription(
        `The code \`${code}\` is now public!\n\nOther users can now redeem it using \`/redeem code:${code}\``
      )
      .setFooter({ text: 'Public codes are shared with all server members' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[MAKEPUBLIC] Error:', error);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('Failed to share the code.');

    await interaction.editReply({ embeds: [embed] });
  }
}
