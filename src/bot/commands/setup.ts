import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { userManager } from '../database/userManager';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Save your Idle Champions credentials securely')
  .addStringOption((option) =>
    option
      .setName('user_id')
      .setDescription('Your Idle Champions User ID')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('user_hash')
      .setDescription('Your Idle Champions User Hash')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    console.log('[SETUP] Deferring reply...');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    console.log('[SETUP] Reply deferred');

    const userId = interaction.options.getString('user_id', true);
    const userHash = interaction.options.getString('user_hash', true);
    console.log('[SETUP] Got credentials from options:', { userId, userHash });

    // Save credentials
    console.log('[SETUP] Saving credentials...');
    await userManager.saveCredentials({
      discordId: interaction.user.id,
      userId,
      userHash,
    });
    console.log('[SETUP] Credentials saved');

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Credentials Saved')
      .setDescription('Your Idle Champions credentials have been saved securely.')
      .addFields(
        {
          name: 'User ID',
          value: userId.substring(0, 4) + '***' + userId.substring(userId.length - 4),
          inline: true,
        },
        {
          name: 'Hash',
          value: userHash.substring(0, 4) + '***' + userHash.substring(userHash.length - 4),
          inline: true,
        }
      )
      .setFooter({ text: 'Your credentials are stored securely in our database.' });

    console.log('[SETUP] Sending reply...');
    await interaction.editReply({ embeds: [embed] });
    console.log('[SETUP] Reply sent');
  } catch (error) {
    console.error('[SETUP COMMAND] Error:', error);
    await interaction.editReply({
      content: '❌ An error occurred while saving your credentials.',
    });
  }
}
