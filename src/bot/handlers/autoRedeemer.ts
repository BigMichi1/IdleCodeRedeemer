import type { Client } from 'discord.js';
import { userManager, type UserCredentials } from '../database/userManager';
import { codeManager, normalizeCodeStatus } from '../database/codeManager';
import { auditManager } from '../database/auditManager';
import IdleChampionsApi, { CodeSubmitStatus, ResponseStatus } from '../api/idleChampionsApi';
import logger from '../utils/logger';
import { errorMessage, sleep } from '../utils/async';
import { resolveGameSession, type Failure } from '../api/gameSession';

let discordClient: Client | null = null;

/**
 * Provide the Discord client so auto-redeemer can send DM notifications.
 * Call this once from bot.ts after the client is created.
 * Pass `null` to clear the client.
 */
export function setDiscordClient(client: Client | null): void {
  discordClient = client;
}

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
    .catch((error) => {
      logger.error('[AUTO REDEEMER] Unhandled error during auto-redeem:', error);
    });
}

/**
 * Fire-and-forget DM to notify a user that code(s) could not be redeemed.
 * Called from the GenericResponse failure path, the unexpected-shape guard, the
 * codeStatus else-branch (non-success, non-already-redeemed, non-expired
 * statuses), and once per user and run when a game session cannot be started or
 * refreshed for a reason the user can fix (the game is not running). Other
 * session failures (server lookup, redirects, a failed getuserdetails) may be a
 * game outage, so they are only logged: DMing every user then would be noise.
 */
function sendFailureDm(discordId: string, codes: string[], reason: string): void {
  if (!discordClient) return;
  const list = codes.map((c) => `\`${c}\``).join(', ');
  const label = codes.length === 1 ? 'Code' : 'Codes';
  discordClient.users
    .fetch(discordId)
    // Reasons may be full sentences already; avoid a doubled full stop.
    .then((user) =>
      user.send(`❌ ${label} ${list} could not be redeemed: ${reason.replace(/\.$/, '')}.`)
    )
    // Closed DMs or an unknown user must not fail the redemption run, but leave
    // a trace: this DM is how a user learns auto-redeem is not working.
    .catch((err) =>
      logger.debug(`[AUTO REDEEMER] Failure DM to ${discordId} not delivered: ${errorMessage(err)}`)
    );
}

function randomDelay(): Promise<void> {
  const ms = MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  logger.debug(`[AUTO REDEEMER] Waiting ${ms}ms before next user`);
  return sleep(ms);
}

/**
 * Attempts to redeem a single code for a single user.
 * Skips silently if the code was already redeemed or is known-expired.
 *
 * Returns the session failure when no game session could be started or
 * refreshed. That is per-user, not per-code: the caller stops this user's
 * remaining codes instead of repeating the same failing lookup (and DM) for
 * each of them.
 */
async function redeemCodeForUser(
  code: string,
  credentials: UserCredentials
): Promise<Failure | undefined> {
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

  const session = await resolveGameSession(discordId, credentials);
  if (!session.ok) {
    logger.error(`[AUTO REDEEMER] ${session.description} (user ${discordId})`);
    return session;
  }
  let server = session.server;
  let instanceId = session.instanceId;

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

    if (generic.status === ResponseStatus.SwitchServer && generic.newServer) {
      // Server switched mid-session
      server = generic.newServer as string;
      await userManager.updateServer(discordId, server);
      logger.info(`[AUTO REDEEMER] Server switched for user ${discordId}, retrying submitCode`);
      submitResponse = await IdleChampionsApi.submitCode({
        server,
        code,
        user_id: credentials.userId,
        hash: credentials.userHash,
        instanceId,
      });
    } else if (generic.status === ResponseStatus.OutdatedInstanceId) {
      // Stale instance_id: re-resolve the session. This also follows a
      // SwitchServer redirect, so the server may change too.
      logger.info(`[AUTO REDEEMER] Outdated instance_id for user ${discordId}, refreshing`);
      const refreshed = await resolveGameSession(discordId, { ...credentials, server });
      if (!refreshed.ok) {
        logger.error(
          `[AUTO REDEEMER] Could not refresh instance_id for user ${discordId}: ${refreshed.description}`
        );
        return refreshed;
      }
      server = refreshed.server;
      instanceId = refreshed.instanceId;
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
      if (credentials.dmOnFailure)
        sendFailureDm(discordId, [code], `Server Error (status ${generic.status})`);
      return;
    }
  }

  if (!(submitResponse instanceof Object && 'codeStatus' in submitResponse)) {
    logger.error(`[AUTO REDEEMER] Unexpected response for code ${code}, user ${discordId}`);
    if (credentials.dmOnFailure) sendFailureDm(discordId, [code], 'Unexpected API Response');
    return;
  }

  const codeResponse = submitResponse as any;
  const statusName = normalizeCodeStatus(codeResponse.codeStatus);
  const isSuccess = codeResponse.codeStatus === CodeSubmitStatus.Success;
  const isAlreadyRedeemed = codeResponse.codeStatus === CodeSubmitStatus.AlreadyRedeemed;
  const isExpiredStatus = codeResponse.codeStatus === CodeSubmitStatus.Expired;

  logger.info(`[AUTO REDEEMER] Code ${code} → ${statusName} for user ${discordId}`);

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

    if (isSuccess && discordClient && credentials.dmOnSuccess) {
      discordClient.users
        .fetch(discordId)
        .then((user) => user.send(`✅ Code \`${code}\` redeemed successfully!`))
        .catch(() => {
          // DM delivery failure is non-critical — user may have DMs disabled
        });
    }

    await auditManager.logAction(discordId, 'CODE_REDEEMED', {
      code,
      status: statusName,
      source: 'auto',
      autoPublic: shouldBePublic,
    });
  } else {
    if (credentials.dmOnFailure) sendFailureDm(discordId, [code], statusName);
    await auditManager.logAction(discordId, 'CODE_REDEEM_FAILED', {
      code,
      reason: statusName,
      source: 'auto',
    });
  }
}

/**
 * Redeems a list of codes for every registered user, sequentially.
 * All codes are redeemed for one user before moving to the next user,
 * with a single random delay between users. This keeps total throttle
 * delays at N-1 (users) rather than M×(N-1) (codes × users).
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

  for (let i = 0; i < allUsers.length; i++) {
    const user = allUsers[i]!;
    logger.info(`[AUTO REDEEMER] Processing user ${user.discordId}`);

    for (const [index, code] of codes.entries()) {
      try {
        const sessionFailure = await redeemCodeForUser(code, user);
        if (sessionFailure) {
          // Codes after this one were not checked yet; leave out any the user
          // already has so the DM lists only what was actually missed.
          const remaining: string[] = [];
          for (const c of codes.slice(index)) {
            if (!(await codeManager.isCodeRedeemedByUser(c, user.discordId))) remaining.push(c);
          }
          logger.warn(
            `[AUTO REDEEMER] Skipping ${remaining.length} remaining code(s) for user ${user.discordId}`
          );
          if (user.dmOnFailure && sessionFailure.userFixable) {
            sendFailureDm(user.discordId, remaining, sessionFailure.description);
          }
          break;
        }
      } catch (error) {
        logger.error(
          `[AUTO REDEEMER] Error redeeming code ${code} for user ${user.discordId}:`,
          error
        );
      }
    }

    // Single delay per user transition, not per code
    if (i < allUsers.length - 1) {
      await randomDelay();
    }
  }

  // After all users are done, remove codes that were successfully persisted.
  // If every attempt failed (API down, bad credentials, unexpected response),
  // leave the code pending so /catchup can retry it later.
  for (const code of codes) {
    if (await codeManager.isCodeRedeemed(code)) {
      await codeManager.removePendingCode(code);
    }
  }

  logger.info(`[AUTO REDEEMER] Finished auto-redeem for ${codes.length} code(s)`);
}
