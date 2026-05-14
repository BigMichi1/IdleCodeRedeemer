import { userManager, type UserCredentials } from '../database/userManager';
import { codeManager, normalizeCodeStatus } from '../database/codeManager';
import { auditManager } from '../database/auditManager';
import IdleChampionsApi from '../api/idleChampionsApi';
import logger from '../utils/logger';

const MIN_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5_000;

// Serial queue: ensures only one auto-redeem run executes at a time.
// Each enqueued job is chained onto the tail so runs never overlap.
let redeemQueue: Promise<void> = Promise.resolve();

/**
 * Enqueue a set of codes for auto-redemption. Runs are serialized —
 * the new job starts only after any currently running job finishes.
 */
export function enqueueAutoRedeem(codes: string[]): void {
  redeemQueue = redeemQueue
    .then(() => autoRedeemForAllUsers(codes))
    .catch((error) => logger.error('[AUTO REDEEMER] Unhandled error during auto-redeem:', error));
}

function randomDelay(): Promise<void> {
  const ms = MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  logger.debug(`[AUTO REDEEMER] Waiting ${ms}ms before next user`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempts to redeem a single code for a single user.
 * Skips silently if the code was already redeemed or is known-expired.
 */
async function redeemCodeForUser(code: string, credentials: UserCredentials): Promise<void> {
  const { discordId } = credentials;

  // Skip if already redeemed by this user
  const alreadyRedeemed = await codeManager.isCodeRedeemedByUser(code, discordId);
  if (alreadyRedeemed) {
    logger.debug(`[AUTO REDEEMER] Code ${code} already redeemed by ${discordId}, skipping`);
    return;
  }

  // Skip if code is known-expired
  const isExpired = await codeManager.isCodeExpired(code);
  if (isExpired) {
    logger.debug(`[AUTO REDEEMER] Code ${code} is expired, skipping user ${discordId}`);
    return;
  }

  let server = credentials.server;
  if (!server) {
    server = await IdleChampionsApi.getServer();
    if (!server) {
      logger.error(`[AUTO REDEEMER] Could not determine server for user ${discordId}`);
      return;
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
      return;
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
    return;
  }

  let instanceId = userData.details.instance_id || '0';
  if (!instanceId || instanceId === '0') {
    logger.error(`[AUTO REDEEMER] Invalid instance_id for user ${discordId}`);
    return;
  }

  let submitResponse = await IdleChampionsApi.submitCode({
    server,
    code,
    user_id: credentials.userId,
    hash: credentials.userHash,
    instanceId,
  });

  // Handle GenericResponse from submitCode:
  //   status 4 = SwitchServer  → update server and retry once
  //   status 1 = OutdatedInstanceId → refresh instance_id and retry once
  if (submitResponse instanceof Object && 'status' in submitResponse) {
    const generic = submitResponse as any;

    if (generic.status === 4 && generic.newServer) {
      // Server switched mid-session
      server = generic.newServer;
      await userManager.updateServer(discordId, server);
      logger.info(`[AUTO REDEEMER] Server switched for user ${discordId}, retrying submitCode`);
      submitResponse = await IdleChampionsApi.submitCode({
        server,
        code,
        user_id: credentials.userId,
        hash: credentials.userHash,
        instanceId,
      });
    } else if (generic.status === 1) {
      // Stale instance_id — fetch fresh user details to get current one
      logger.info(`[AUTO REDEEMER] Outdated instance_id for user ${discordId}, refreshing`);
      const refreshResult = await IdleChampionsApi.getUserDetails({
        server,
        user_id: credentials.userId,
        hash: credentials.userHash,
      });
      const refreshed = refreshResult as any;
      const refreshedInstanceId = refreshed?.details?.instance_id || '0';
      if (!refreshedInstanceId || refreshedInstanceId === '0') {
        logger.error(`[AUTO REDEEMER] Could not refresh instance_id for user ${discordId}`);
        return;
      }
      instanceId = refreshedInstanceId;
      submitResponse = await IdleChampionsApi.submitCode({
        server,
        code,
        user_id: credentials.userId,
        hash: credentials.userHash,
        instanceId,
      });
    } else {
      logger.error(
        `[AUTO REDEEMER] submitCode returned GenericResponse status=${generic.status} for code ${code}, user ${discordId}`
      );
      return;
    }
  }

  if (!(submitResponse instanceof Object && 'codeStatus' in submitResponse)) {
    logger.error(`[AUTO REDEEMER] Unexpected response for code ${code}, user ${discordId}`);
    return;
  }

  const codeResponse = submitResponse as any;
  const statusName = normalizeCodeStatus(codeResponse.codeStatus);
  const isSuccess = codeResponse.codeStatus === 0;
  const isAlreadyRedeemed = codeResponse.codeStatus === 1;
  const isExpiredStatus = codeResponse.codeStatus === 4;

  logger.info(
    `[AUTO REDEEMER] Code ${code} → ${statusName} for user ${discordId}`
  );

  if (isAlreadyRedeemed) {
    // Persist so isCodeRedeemedByUser() short-circuits on future runs
    await codeManager.addRedeemedCode(code, discordId, statusName);
    return;
  }

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
}

/**
 * Redeems a list of codes for every registered user, sequentially,
 * with a random delay between each redemption attempt and between codes.
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

  for (let c = 0; c < codes.length; c++) {
    const code = codes[c];
    logger.info(`[AUTO REDEEMER] Processing code: ${code}`);

    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      try {
        await redeemCodeForUser(code, user);
      } catch (error) {
        logger.error(
          `[AUTO REDEEMER] Error redeeming code ${code} for user ${user.discordId}:`,
          error
        );
      }

      // Wait between users (but not after the last user of the last code)
      if (i < allUsers.length - 1 || c < codes.length - 1) {
        await randomDelay();
      }
    }

    // Code has been processed for all users — remove from pending_codes so it
    // no longer shows up in /catchup (redeemed_codes now tracks it instead).
    await codeManager.removePendingCode(code);
  }

  logger.info(`[AUTO REDEEMER] Finished auto-redeem for ${codes.length} code(s)`);
}
