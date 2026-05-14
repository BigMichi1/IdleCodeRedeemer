import { userManager } from '../database/userManager';
import { codeManager, normalizeCodeStatus } from '../database/codeManager';
import { auditManager } from '../database/auditManager';
import IdleChampionsApi from '../api/idleChampionsApi';
import logger from '../utils/logger';

const MIN_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5_000;

function randomDelay(): Promise<void> {
  const ms = MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  logger.debug(`[AUTO REDEEMER] Waiting ${ms}ms before next user`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempts to redeem a single code for a single user.
 * Returns true if the redemption was attempted (regardless of outcome), false if skipped.
 */
async function redeemCodeForUser(code: string, discordId: string): Promise<boolean> {
  // Skip if already redeemed by this user
  const alreadyRedeemed = await codeManager.isCodeRedeemedByUser(code, discordId);
  if (alreadyRedeemed) {
    logger.debug(`[AUTO REDEEMER] Code ${code} already redeemed by ${discordId}, skipping`);
    return false;
  }

  // Skip if code is known-expired
  const isExpired = await codeManager.isCodeExpired(code);
  if (isExpired) {
    logger.debug(`[AUTO REDEEMER] Code ${code} is expired, skipping user ${discordId}`);
    return false;
  }

  const credentials = await userManager.getCredentials(discordId);
  if (!credentials) {
    return false;
  }

  let server = credentials.server;
  if (!server) {
    server = await IdleChampionsApi.getServer();
    if (!server) {
      logger.error(`[AUTO REDEEMER] Could not determine server for user ${discordId}`);
      return true;
    }
    await userManager.updateServer(discordId, server);
  }

  // Fetch fresh user details to get current instance_id
  let userResult = await IdleChampionsApi.getUserDetails({
    server,
    user_id: credentials.userId,
    hash: credentials.userHash,
  });

  // Handle server switch (status 4)
  if (
    userResult instanceof Object &&
    'status' in userResult &&
    (userResult as any).status === 4
  ) {
    const newServer = (userResult as any).newServer;
    if (!newServer) {
      logger.error(`[AUTO REDEEMER] Server switch failed for user ${discordId}`);
      return true;
    }
    server = newServer;
    await userManager.updateServer(discordId, server);
    userResult = await IdleChampionsApi.getUserDetails({
      server,
      user_id: credentials.userId,
      hash: credentials.userHash,
    });
  }

  const userData = userResult as any;
  if (!userData?.details) {
    logger.error(`[AUTO REDEEMER] Could not retrieve user data for ${discordId}`);
    return true;
  }

  const instanceId = userData.details.instance_id || '0';
  if (!instanceId || instanceId === '0') {
    logger.error(`[AUTO REDEEMER] Invalid instance_id for user ${discordId}`);
    return true;
  }

  const response = await IdleChampionsApi.submitCode({
    server,
    code,
    user_id: credentials.userId,
    hash: credentials.userHash,
    instanceId,
  });

  if (!(response instanceof Object && 'codeStatus' in response)) {
    logger.error(`[AUTO REDEEMER] Unexpected response for code ${code}, user ${discordId}`);
    return true;
  }

  const codeResponse = response as any;
  const statusName = normalizeCodeStatus(codeResponse.codeStatus);
  const isSuccess = codeResponse.codeStatus === 0;
  const isExpiredStatus = codeResponse.codeStatus === 4;

  logger.info(
    `[AUTO REDEEMER] Code ${code} → ${statusName} for user ${discordId}`
  );

  if (isSuccess || isExpiredStatus) {
    let shouldBePublic = false;

    if (isSuccess) {
      const wasRedeemedByOther = await codeManager.isCodeSuccessfullyRedeemedByOther(
        code,
        discordId
      );
      if (wasRedeemedByOther) {
        shouldBePublic = true;
      }
    }

    await codeManager.addRedeemedCode(
      code,
      discordId,
      statusName,
      codeResponse.lootDetail,
      shouldBePublic
    );

    await auditManager.logAction(discordId, 'CODE_REDEEMED', {
      code,
      status: statusName,
      source: 'auto',
      autoPublic: shouldBePublic,
    });
  } else {
    await auditManager.logAction(discordId, 'CODE_REDEEM_FAILED', {
      code,
      reason: statusName,
      source: 'auto',
    });
  }

  return true;
}

/**
 * Redeems a list of codes for every registered user, sequentially,
 * with a random delay between each redemption attempt.
 */
export async function autoRedeemForAllUsers(codes: string[]): Promise<void> {
  if (codes.length === 0) return;

  const allUsers = await userManager.getAllUsersWithAutoRedeem();
  if (allUsers.length === 0) {
    logger.debug('[AUTO REDEEMER] No users with auto-redeem enabled, skipping');
    return;
  }

  logger.info(
    `[AUTO REDEEMER] Starting auto-redeem of ${codes.length} code(s) for ${allUsers.length} user(s)`
  );

  for (const code of codes) {
    logger.info(`[AUTO REDEEMER] Processing code: ${code}`);

    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      try {
        await redeemCodeForUser(code, user.discordId);
      } catch (error) {
        logger.error(
          `[AUTO REDEEMER] Error redeeming code ${code} for user ${user.discordId}:`,
          error
        );
      }

      // Wait between users (but not after the last one)
      if (i < allUsers.length - 1) {
        await randomDelay();
      }
    }
  }

  logger.info(`[AUTO REDEEMER] Finished auto-redeem for ${codes.length} code(s)`);
}
