import type { Channel, TextChannel } from 'discord.js';
import { ChannelType } from 'discord.js';
import { scanMessageForCodes, extractCodesFromText } from './codeScanner';
import { codeManager } from '../database/codeManager';
import { userManager } from '../database/userManager';
import IdleChampionsApi from '../api/idleChampionsApi';
import logger from '../utils/logger';

interface BackfillStats {
  codesFound: number;
  codesRedeemed: number;
  pendingCodes: number;
  errors: string[];
}

/**
 * Backfill message history for codes
 * @param channel The Discord channel to backfill
 * @param onProgress Optional callback to report progress
 * @returns Statistics about the backfill operation
 */
export async function backfillChannelHistory(
  channel: any,
  onProgress?: (message: string) => void
): Promise<BackfillStats> {
  const stats: BackfillStats = {
    codesFound: 0,
    codesRedeemed: 0,
    pendingCodes: 0,
    errors: [],
  };

  // Validate channel type
  if (!channel || channel.type !== ChannelType.GuildText) {
    stats.errors.push('Invalid channel type - must be a text channel');
    return stats;
  }

  const textChannel = channel as TextChannel;
  onProgress?.(`Starting backfill of channel #${textChannel.name}...`);

  try {
    let messageCount = 0;
    let beforeId: string | undefined;
    const allCodes = new Set<string>();

    // Fetch messages in batches (Discord API limit is 100)
    while (true) {
      try {
        onProgress?.(`Fetching messages (batch starting from ${beforeId ? 'messageId ' + beforeId : 'latest'})...`);

        const messages = await textChannel.messages.fetch({
          limit: 100,
          ...(beforeId && { before: beforeId }),
        });

        if (messages.size === 0) {
          break; // No more messages to fetch
        }

        messageCount += messages.size;

        // Process each message for codes
        for (const [, message] of messages) {
          // Skip bot messages
          if (message.author.bot || message.webhookId) {
            continue;
          }

          // Extract codes from message using the existing scanner
          const codes = await scanMessageForCodes(message);

          for (const code of codes) {
            if (!allCodes.has(code)) {
              allCodes.add(code);
              stats.codesFound++;
            }
          }
        }

        // Set the ID for the next batch (oldest message ID)
        beforeId = messages.last()?.id;

        // Discord rate limit - wait a bit between batches
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        const errorMsg = `Error fetching message batch: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(`[BACKFILL] ${errorMsg}`);
        stats.errors.push(errorMsg);
        break; // Exit the loop on fetch error
      }
    }

    onProgress?.(`Found ${stats.codesFound} codes in ${messageCount} messages. Now attempting to redeem...`);

    // Now attempt to redeem found codes for each user with credentials
    const users = await userManager.getAllUsers();

    for (const user of users) {
      try {
        let server = user.server;
        if (!server) {
          server = await IdleChampionsApi.getServer();
          if (!server) {
            logger.warn(`[BACKFILL] Could not determine server for user ${user.discordId}`);
            continue;
          }
          await userManager.updateServer(user.discordId, server);
        }

        // Try to redeem each code for this user
        for (const code of Array.from(allCodes)) {
          // Skip if already redeemed
          const isRedeemed = await codeManager.isCodeRedeemed(code);
          if (isRedeemed) {
            continue;
          }

          try {
            // Fetch fresh instance ID before redeeming
            const userDetailsResponse = await IdleChampionsApi.getUserDetails({
              server,
              user_id: user.userId,
              hash: user.userHash,
            });

            // Check if response is PlayerData (successful)
            if (!(userDetailsResponse instanceof Object && 'success' in userDetailsResponse)) {
              logger.warn(
                `[BACKFILL] Failed to get user details for ${user.discordId}: not a valid response`
              );
              continue;
            }

            const playerData = userDetailsResponse as any;
            const instanceId = playerData.details?.instance_id || '';

            const response = await IdleChampionsApi.submitCode({
              server,
              code,
              user_id: user.userId,
              hash: user.userHash,
              instanceId,
            });

            // Type guard: check if response has codeStatus
            if (response instanceof Object && 'codeStatus' in response) {
              const codeResponse = response as any;
              await codeManager.addRedeemedCode(
                code,
                user.discordId,
                codeResponse.codeStatus.toString(),
                codeResponse.lootDetail
              );
              stats.codesRedeemed++;
              logger.info(
                `[BACKFILL] Successfully redeemed code ${code} for user ${user.discordId}`
              );
            }
          } catch (error) {
            // Log error but continue with other codes
            logger.warn(
              `[BACKFILL] Failed to redeem code ${code} for user ${user.discordId}: ${error instanceof Error ? error.message : String(error)}`
            );
          }

          // Small delay between redemption attempts
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        const errorMsg = `Error processing user ${user.discordId}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(`[BACKFILL] ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    // Store any remaining codes as pending (for users without credentials)
    for (const code of allCodes) {
      const isRedeemed = await codeManager.isCodeRedeemed(code);
      if (!isRedeemed) {
        // This code wasn't redeemed - it might be a pending code
        stats.pendingCodes++;
      }
    }

    onProgress?.(
      `✅ Backfill complete! Found: ${stats.codesFound}, Redeemed: ${stats.codesRedeemed}, Pending: ${stats.pendingCodes}`
    );
  } catch (error) {
    const errorMsg = `Backfill error: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(`[BACKFILL] ${errorMsg}`);
    stats.errors.push(errorMsg);
  }

  return stats;
}
