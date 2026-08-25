import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { userManager } from '../database/userManager';
import { codeManager, normalizeCodeStatus, CHEST_TYPE_NAMES } from '../database/codeManager';
import { auditManager } from '../database/auditManager';
import IdleChampionsApi, { CodeSubmitStatus } from '../api/idleChampionsApi';
import { resolveGameSession } from './gameSession';
import { replyWithError } from '../utils/interactionReply';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('redeem')
  .setDescription('Redeem an Idle Champions code')
  .addStringOption((option) =>
    option.setName('code').setDescription('The code to redeem').setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logger.info(`[REDEEM] Command started by ${interaction.user.tag}`);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Check if user has credentials
    const credentials = await userManager.getCredentials(interaction.user.id);
    if (!credentials) {
      logger.warn(`[REDEEM] No credentials found for ${interaction.user.tag}`);
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Credentials Found')
        .setDescription('Please set up your Idle Champions credentials first using `/setup`');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const code = interaction.options.getString('code', true).toUpperCase().replaceAll('-', '');
    logger.info(`[REDEEM] Redeeming code: ${code} for user ${interaction.user.tag}`);

    // Check if this user has already redeemed this code
    const isRedeemed = await codeManager.isCodeRedeemedByUser(code, interaction.user.id);
    if (isRedeemed) {
      logger.info(`[REDEEM] Code ${code} already redeemed`);
      await auditManager.logAction(interaction.user.id, 'CODE_REDEEM_FAILED', {
        code,
        reason: 'Already Redeemed',
      });
      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('⚠️ Code Already Redeemed')
        .setDescription(`The code \`${code}\` has already been redeemed.`);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Check if code is expired
    const isExpired = await codeManager.isCodeExpired(code);
    if (isExpired) {
      logger.warn(`[REDEEM] Code ${code} is expired - rejecting without API call`);
      await auditManager.logAction(interaction.user.id, 'CODE_REDEEM_FAILED', {
        code,
        reason: 'Code Expired',
      });
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Code Expired')
        .setDescription(`The code \`${code}\` has expired and can no longer be redeemed.`);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const session = await resolveGameSession(interaction.user.id, credentials);
    if (!session.ok) {
      await replyWithError(interaction, session.title, session.description);
      return;
    }
    const { server, instanceId } = session;

    // Submit code
    const response = await IdleChampionsApi.submitCode({
      server,
      code,
      user_id: credentials.userId,
      hash: credentials.userHash,
      instanceId,
    });

    // Type guard: check if response has codeStatus (CodeSubmitResponse)
    if (!(response instanceof Object && 'codeStatus' in response)) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Failed to redeem code.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const codeResponse = response as any;
    const statusName = normalizeCodeStatus(codeResponse.codeStatus);
    const isSuccess = codeResponse.codeStatus === CodeSubmitStatus.Success;
    const isExpiredStatus = codeResponse.codeStatus === CodeSubmitStatus.Expired;

    logger.info(
      `[REDEEM] Code ${code} redeemed with status: ${statusName} for user ${interaction.user.tag}`
    );

    // Only store successful or expired redeems
    if (isSuccess || isExpiredStatus) {
      let shouldBePublic = false;

      // If successful, check if another user already successfully redeemed it
      if (isSuccess) {
        const wasRedeemedByOther = await codeManager.isCodeSuccessfullyRedeemedByOther(
          code,
          interaction.user.id
        );
        if (wasRedeemedByOther) {
          // Second user redeeming successfully - make it public
          shouldBePublic = true;
          logger.info(`[REDEEM] Code ${code} will be auto-made public (second successful redeem)`);
        }
      }

      await codeManager.addRedeemedCode(
        code,
        interaction.user.id,
        statusName,
        codeResponse.lootDetail,
        shouldBePublic // Private by default, public if second user redeems successfully
      );

      // Log successful redeem
      await auditManager.logAction(interaction.user.id, 'CODE_REDEEMED', {
        code,
        status: statusName,
        autoPublic: shouldBePublic,
      });
    } else {
      // Demote a shared code only when the API says it is genuinely bad.
      // "Already Redeemed" (1) is a normal outcome for a code that works fine
      // for everyone else, and must not un-share it. Only 2 (Invalid
      // Parameters), 3 (Not a Valid Code) and 5 (Cannot Redeem) qualify.
      const isInvalidStatus = [2, 3, 5].includes(codeResponse.codeStatus);
      const codeWasPublic = isInvalidStatus && (await codeManager.isCodePublic(code));

      if (codeWasPublic) {
        logger.warn(
          `[REDEEM] Code ${code} was public but is now invalid - switching back to private`
        );
        // Scoped to this user's row: one user's failure must not un-share
        // another user's working code.
        await codeManager.markCodeAsPrivate(code, interaction.user.id);
      }

      // Log failed redeem
      await auditManager.logAction(interaction.user.id, 'CODE_REDEEM_FAILED', {
        code,
        reason: statusName,
      });
    }

    // Build response embed
    const embed = new EmbedBuilder()
      .setColor(isSuccess ? 0x00ff00 : 0xffaa00)
      .setTitle(isSuccess ? '✅ Code Redeemed!' : `⚠️ ${statusName}`)
      .addFields({ name: 'Code', value: `\`${code}\``, inline: false });

    // Format loot nicely
    if (
      codeResponse.lootDetail &&
      Array.isArray(codeResponse.lootDetail) &&
      codeResponse.lootDetail.length > 0
    ) {
      const lootLines = codeResponse.lootDetail
        .map((loot: any) => {
          if (loot.chest_type_id !== undefined) {
            const chestName = CHEST_TYPE_NAMES[loot.chest_type_id] ?? `Chest ${loot.chest_type_id}`;
            return `• ${chestName}: ${loot.before} → ${loot.after} (+${loot.count})`;
          } else if (loot.loot_item) {
            return `• ${loot.loot_item.replace(/_/g, ' ')}: x${loot.count}`;
          }
          return `• ${JSON.stringify(loot)}`;
        })
        .join('\n');

      embed.addFields({
        name: '📦 Loot Received',
        value: lootLines || 'Unknown loot',
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[REDEEM COMMAND] Error:', error);
    await interaction.editReply({
      content: '❌ An error occurred while redeeming the code.',
    });
  }
}

