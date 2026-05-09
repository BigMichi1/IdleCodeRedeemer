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
  .setName('redeempublic')
  .setDescription('Redeem public codes shared by other users')
  .addStringOption((option) =>
    option
      .setName('code')
      .setDescription('The public code to redeem (leave empty to see available codes)')
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Check if user has credentials
    const credentials = await userManager.getCredentials(interaction.user.id);
    if (!credentials) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Credentials Found')
        .setDescription('Please set up your Idle Champions credentials first using `/setup`');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const code = interaction.options.getString('code', false)?.toUpperCase().replaceAll('-', '');

    if (!code) {
      // Show available public codes
      const publicCodes = await codeManager.getPublicUnexpiredCodes();

      if (publicCodes.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle('🌐 Public Codes')
          .setDescription('No public codes are currently available.');

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00aa00)
        .setTitle('🌐 Available Public Codes')
        .setDescription('Here are the public codes you can redeem:\n\nUse `/redeempublic code:<code>` to redeem one');

      let codeList = '';
      publicCodes.slice(0, 20).forEach((codeRow, idx) => {
        const redeemerName = codeRow.discord_id ? `by <@${codeRow.discord_id}>` : 'by unknown';
        codeList += `${idx + 1}. \`${codeRow.code}\` ${redeemerName}\n`;
      });

      embed.addFields({
        name: 'Available Codes',
        value: codeList || 'None',
        inline: false,
      });

      if (publicCodes.length > 20) {
        embed.setFooter({ text: `Showing 20 of ${publicCodes.length} available codes` });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Check if user already redeemed this code
    const userCodes = await codeManager.getRedeemedCodes(interaction.user.id);
    if (userCodes.includes(code)) {
      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('⚠️ Already Redeemed')
        .setDescription(`You have already redeemed the code \`${code}\`.`);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Check if code exists in public codes
    const publicCodes = await codeManager.getPublicUnexpiredCodes();
    const codeExists = publicCodes.some(c => c.code === code);

    if (!codeExists) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Code Not Found')
        .setDescription(`The code \`${code}\` is not available as a public code or has expired.`);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get server
    let server = credentials.server;
    if (!server) {
      server = await IdleChampionsApi.getServer();
      if (!server) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Error')
          .setDescription('Could not determine game server.');

        await interaction.editReply({ embeds: [embed] });
        return;
      }
      await userManager.updateServer(interaction.user.id, server);
    }

    // Get fresh user details to get current instance ID
    let userResult = await IdleChampionsApi.getUserDetails({
      server,
      user_id: credentials.userId,
      hash: credentials.userHash,
    });

    // Handle server switch
    if (userResult instanceof Object && 'status' in userResult && (userResult as any).status === 4) {
      server = (userResult as any).newServer;
      if (!server) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Error')
          .setDescription('Server switch failed.');

        await interaction.editReply({ embeds: [embed] });
        return;
      }
      await userManager.updateServer(interaction.user.id, server);

      userResult = await IdleChampionsApi.getUserDetails({
        server,
        user_id: credentials.userId,
        hash: credentials.userHash,
      });
    }

    const userData = userResult as any;
    if (!userData || !userData.details) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Could not retrieve user data.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Redeem the code
    const result = await IdleChampionsApi.submitCode({
      server,
      code,
      user_id: credentials.userId,
      hash: credentials.userHash,
      instanceId: userData.details.instance_id,
    });

    const redeemResult = result as any;

    if (!redeemResult) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Failed to redeem code. Please try again.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Check for errors (status 1 = error in generic response)
    if (redeemResult.status === 1) {
      // Error response
      const errorMsg = redeemResult.message || 'Unknown error';

      // Check if it's an expiration error
      if (errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('no longer')) {
        await codeManager.markCodeAsExpired(code);
      }

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Redemption Failed')
        .setDescription(`**Error:** ${errorMsg}`);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Check for CodeSubmitResponse status
    if (redeemResult.codeStatus !== undefined && redeemResult.codeStatus !== 0) {
      const statusName = getCodeStatusName(redeemResult.codeStatus);

      if (statusName === 'expired') {
        await codeManager.markCodeAsExpired(code);
      }

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Redemption Failed')
        .setDescription(`**Status:** ${statusName}`);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Success - store the redeemed code
    const lootDetails = redeemResult.lootDetails || redeemResult.loot_detail;
    await codeManager.addRedeemedCode(code, interaction.user.id, 'success', lootDetails, false);

    // Build response embed
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Code Redeemed Successfully')
      .setDescription(`The code \`${code}\` has been redeemed!`);

    if (lootDetails) {
      if (typeof lootDetails === 'string') {
        try {
          const parsed = JSON.parse(lootDetails);
          if (parsed.gold) {
            embed.addFields({ name: '🪙 Gold', value: parsed.gold.toString(), inline: true });
          }
          if (parsed.rubies) {
            embed.addFields({ name: '💎 Rubies', value: parsed.rubies.toString(), inline: true });
          }
          if (parsed.equipment) {
            embed.addFields({ name: '⚔️ Equipment', value: parsed.equipment.toString(), inline: true });
          }
        } catch {
          // Ignore parse errors
        }
      } else {
        if (lootDetails.gold) {
          embed.addFields({ name: '🪙 Gold', value: lootDetails.gold.toString(), inline: true });
        }
        if (lootDetails.rubies) {
          embed.addFields({ name: '💎 Rubies', value: lootDetails.rubies.toString(), inline: true });
        }
        if (lootDetails.equipment) {
          embed.addFields({ name: '⚔️ Equipment', value: lootDetails.equipment.toString(), inline: true });
        }
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[REDEEMPUBLIC] Error:', error);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('An error occurred while redeeming the code.');

    await interaction.editReply({ embeds: [embed] });
  }
}

function getCodeStatusName(status: number): string {
  const statusMap: { [key: number]: string } = {
    0: 'success',
    1: 'already_redeemed',
    2: 'expired',
    3: 'not_valid_combo',
    4: 'invalid_parameters',
    5: 'cannot_redeem',
  };
  return statusMap[status] || 'unknown';
}
