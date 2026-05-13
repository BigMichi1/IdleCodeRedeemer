import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { userManager } from '../database/userManager';
import { codeManager, normalizeCodeStatus } from '../database/codeManager';
import { auditManager } from '../database/auditManager';
import IdleChampionsApi from '../api/idleChampionsApi';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('catchup')
  .setDescription('Redeem all known valid codes you have not yet claimed');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logger.info(`[CATCHUP] Command started by ${interaction.user.tag}`);
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

    // Collect all known valid codes: successful redeems + pending codes
    const [validCodes, pendingCodes] = await Promise.all([
      codeManager.getAllValidCodes(),
      codeManager.getPendingCodes(),
    ]);

    // Deduplicate
    const allCodes = Array.from(new Set([...validCodes, ...pendingCodes]));

    if (allCodes.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('ℹ️ No Codes Available')
        .setDescription('There are no known valid codes to redeem at this time.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Resolve server
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

    // Fetch fresh user details once to get instance_id (refreshed per batch below)
    let userResult = await IdleChampionsApi.getUserDetails({
      server,
      user_id: credentials.userId,
      hash: credentials.userHash,
    });

    // Handle server switch
    if (
      userResult instanceof Object &&
      'status' in userResult &&
      (userResult as any).status === 4
    ) {
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
    if (!userData?.details) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Could not retrieve user data from the game server.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    let instanceId = userData.details.instance_id !== null && userData.details.instance_id !== undefined
      ? String(userData.details.instance_id).trim()
      : '';
    if (!instanceId || instanceId === '0') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Could not determine your game instance. Please open the game and try again later.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Attempt to redeem each code
    let redeemed = 0;
    let alreadyHad = 0;
    let expired = 0;
    let failed = 0;
    let apiCallCount = 0; // tracks actual submitCode API calls for refresh cadence

    for (const code of allCodes) {
      // Skip codes we already know are expired
      const isExpired = await codeManager.isCodeExpired(code);
      if (isExpired) {
        expired++;
        continue;
      }

      // Skip codes this user has already successfully redeemed (no API call needed)
      const alreadyRedeemed = await codeManager.isCodeRedeemedByUser(code, interaction.user.id);
      if (alreadyRedeemed) {
        alreadyHad++;
        continue;
      }

      try {
        // Refresh instance_id every 10 real API submissions to avoid stale sessions
        if (apiCallCount > 0 && apiCallCount % 10 === 0) {
          const refreshResult = await IdleChampionsApi.getUserDetails({
            server: server!,
            user_id: credentials.userId,
            hash: credentials.userHash,
          });
          const refreshed = refreshResult as any;
          const refreshedInstanceId = refreshed?.details?.instance_id !== null && refreshed?.details?.instance_id !== undefined
            ? String(refreshed.details.instance_id).trim()
            : '';
          if (refreshedInstanceId && refreshedInstanceId !== '0') {
            instanceId = refreshedInstanceId;
          }
        }

        const response = await IdleChampionsApi.submitCode({
          server: server!,
          code,
          user_id: credentials.userId,
          hash: credentials.userHash,
          instanceId,
        });

        apiCallCount++;

        if (!(response instanceof Object && 'codeStatus' in response)) {
          failed++;
          continue;
        }

        const codeResponse = response as any;
        const codeStatus: number = codeResponse.codeStatus;

        if (codeStatus === 0) {
          // Success
          const wasRedeemedByOther = await codeManager.isCodeSuccessfullyRedeemedByOther(
            code,
            interaction.user.id
          );
          await codeManager.addRedeemedCode(
            code,
            interaction.user.id,
            'Success',
            codeResponse.lootDetail,
            wasRedeemedByOther // auto-public if a second user succeeds
          );
          redeemed++;
          logger.info(`[CATCHUP] Redeemed code ${code} for ${interaction.user.tag}`);
          await auditManager.logAction(interaction.user.id, 'CATCHUP_REDEEM_SUCCESS', { code });
        } else if (codeStatus === 1) {
          // Already redeemed by this user — persist so future /catchup runs skip the API call
          await codeManager.addRedeemedCode(code, interaction.user.id, 'Already Redeemed');
          alreadyHad++;
        } else if (codeStatus === 4) {
          // Expired - update DB
          await codeManager.markCodeAsExpired(code);
          expired++;
          await auditManager.logAction(interaction.user.id, 'CATCHUP_REDEEM_FAILED', {
            code,
            status: 'Code Expired',
          });
        } else {
          failed++;
          await auditManager.logAction(interaction.user.id, 'CATCHUP_REDEEM_FAILED', {
            code,
            status: normalizeCodeStatus(codeStatus),
          });
        }

        // Small delay to avoid hammering the API
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (err) {
        logger.warn(
          `[CATCHUP] Failed to redeem code ${code} for ${interaction.user.tag}: ${err instanceof Error ? err.message : String(err)}`
        );
        failed++;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(redeemed > 0 ? 0x00aa00 : 0x0099ff)
      .setTitle('🔄 Catch-up Complete')
      .setDescription(
        [
          `Checked **${allCodes.length}** known code(s):`,
          `✅ **Newly redeemed:** ${redeemed}`,
          `☑️ **Already had:** ${alreadyHad}`,
          `⏰ **Expired:** ${expired}`,
          failed > 0 ? `❌ **Failed:** ${failed}` : null,
        ]
          .filter(Boolean)
          .join('\n')
      );

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      `[CATCHUP] ${interaction.user.tag} — redeemed=${redeemed}, alreadyHad=${alreadyHad}, expired=${expired}, failed=${failed}`
    );
  } catch (error) {
    logger.error('[CATCHUP] Command error:', error);

    try {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription(
          `An error occurred: ${error instanceof Error ? error.message : String(error)}`
        );

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      logger.error('[CATCHUP] Failed to send error reply:', replyError);
    }
  }
}
