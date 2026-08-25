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
  .setName('setup')
  .setDescription('Save your Idle Champions credentials securely')
  .addStringOption((option) =>
    option.setName('user_id').setDescription('Your Idle Champions User ID').setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('user_hash').setDescription('Your Idle Champions User Hash').setRequired(true)
  );

/**
 * Mask a credential for display, keeping only the first and last 4 characters.
 * Short values are masked entirely rather than leaking overlapping halves.
 */
function maskCredential(value: string): string {
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.substring(0, 4)}***${value.substring(value.length - 4)}`;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.options.getString('user_id', true);
    const userHash = interaction.options.getString('user_hash', true);

    // NEVER log userId/userHash. They are the auth pair for the user's game
    // account; encrypting them at rest is pointless if they also sit in
    // logs/combined.log and container stdout.
    await userManager.saveCredentials({
      discordId: interaction.user.id,
      userId,
      userHash,
    });

    // Audit the event, not the credential: the discordId already identifies the
    // row, and audit_log is stored unencrypted alongside the encrypted users table.
    await auditManager.logAction(interaction.user.id, 'USER_SETUP');

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Credentials Saved')
      .setDescription('Your Idle Champions credentials have been saved securely.')
      .addFields(
        { name: 'User ID', value: maskCredential(userId), inline: true },
        { name: 'Hash', value: maskCredential(userHash), inline: true }
      )
      .setFooter({ text: 'Your credentials are stored securely in our database.' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[SETUP COMMAND] Error:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: '❌ An error occurred while saving your credentials.',
      });
    }
  }
}
