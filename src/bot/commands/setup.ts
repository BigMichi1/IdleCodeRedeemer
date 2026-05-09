import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { userManager } from '../database/userManager';
import { codeManager } from '../database/codeManager';
import IdleChampionsApi from '../api/idleChampionsApi';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Save your Idle Champions credentials securely')
  .addStringOption((option) =>
    option
      .setName('user_id')
      .setDescription('Your Idle Champions User ID')
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName('user_hash')
      .setDescription('Your Idle Champions User Hash')
      .setRequired(true),
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
        },
      )
      .setFooter({ text: 'Your credentials are stored securely in our database.' });

    // Try to auto-redeem public codes
    console.log('[SETUP] Checking for public codes to auto-redeem...');
    try {
      const publicCodes = await codeManager.getPublicUnexpiredCodes();

      if (publicCodes.length > 0) {
        console.log(`[SETUP] Found ${publicCodes.length} public codes, attempting redemption...`);

        // Get server
        const server = await IdleChampionsApi.getServer();
        if (!server) {
          console.warn('[SETUP] Could not get server for auto-redemption');
        } else {
          await userManager.updateServer(interaction.user.id, server);

          // Get user details to get instance_id
          const userResult = await IdleChampionsApi.getUserDetails({
            server,
            user_id: userId,
            hash: userHash,
          });

          const userData = userResult as any;
          if (userData && userData.details) {
            let successCount = 0;
            const failedCodes: string[] = [];

            // Try to redeem each public code
            for (const publicCode of publicCodes) {
              try {
                const result = await IdleChampionsApi.submitCode({
                  server,
                  code: publicCode.code,
                  user_id: userId,
                  hash: userHash,
                  instanceId: userData.details.instance_id,
                });

                const redeemResult = result as any;

                // Check if success (CodeSubmitResponse with codeStatus = 0, or success field)
                const isSuccess =
                  (redeemResult.codeStatus !== undefined && redeemResult.codeStatus === 0) ||
                  (redeemResult.success && redeemResult.okay) ||
                  (redeemResult.status !== 1 && !redeemResult.codeStatus);

                if (isSuccess) {
                  // Success - get loot details
                  const lootDetails = redeemResult.lootDetails || redeemResult.loot_detail;
                  await codeManager.addRedeemedCode(
                    publicCode.code,
                    interaction.user.id,
                    'success',
                    lootDetails,
                    false, // Mark as private for this user
                  );
                  successCount++;
                  console.log(`[SETUP] Successfully redeemed public code: ${publicCode.code}`);
                } else {
                  // Failed
                  const statusMsg = redeemResult?.message || (redeemResult?.codeStatus !== undefined ? `Status ${redeemResult.codeStatus}` : 'Unknown error');
                  if (statusMsg.toLowerCase().includes('expired')) {
                    await codeManager.markCodeAsExpired(publicCode.code);
                  }
                  failedCodes.push(publicCode.code);
                  console.log(`[SETUP] Failed to redeem public code ${publicCode.code}: ${statusMsg}`);
                }
              } catch (err) {
                console.error(`[SETUP] Error redeeming public code ${publicCode.code}:`, err);
                failedCodes.push(publicCode.code);
              }
            }

            if (successCount > 0) {
              embed.addFields({
                name: '🎁 Auto-Redeemed Public Codes',
                value: `Successfully redeemed ${successCount} public code${successCount === 1 ? '' : 's'}!`,
                inline: false,
              });
            }

            if (failedCodes.length > 0) {
              embed.addFields({
                name: '⚠️ Could Not Redeem',
                value: `${failedCodes.length} code${failedCodes.length === 1 ? '' : 's'} could not be redeemed (expired or already used).`,
                inline: false,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[SETUP] Error during auto-redemption:', err);
      // Don't fail the setup if auto-redemption fails
    }

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
