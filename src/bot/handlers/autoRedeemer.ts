import type { Client } from 'discord.js';
import { userManager, type UserCredentials } from '../database/userManager';
import { codeManager, normalizeCodeStatus } from '../database/codeManager';
import { auditManager } from '../database/auditManager';
import IdleChampionsApi, {
  CodeSubmitStatus,
  ResponseStatus,
  describeResponseStatus,
} from '../api/idleChampionsApi';
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
 * Resolves once every job enqueued so far has finished. Lets tests wait for
 * a background run to complete instead of racing its last DB writes (audit
 * row, pending-code cleanup) against the next test's database reset.
 */
export function whenAutoRedeemIdle(): Promise<void> {
  return redeemQueue;
}

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
      // warn, not debug: the default level is info, and a silent miss here is
      // exactly what this DM exists to prevent.
      // Codes and reason are logged so the operator can tell the user by hand.
      logger.warn(
        `[AUTO REDEEMER] Failure DM to ${discordId} not delivered (${codes.join(', ')}: ${reason}): ${errorMessage(err)}`
      )
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

  let session: Awaited<ReturnType<typeof resolveGameSession>>;
  try {
    session = await resolveGameSession(discordId, credentials);
  } catch (error) {
    // A throw (e.g. the DB write persisting a new server) is just as per-user
    // as a returned failure; as a Failure it stops the user's remaining codes
    // instead of repeating the same lookup once per code.
    logger.error(`[AUTO REDEEMER] Session lookup threw for user ${discordId}:`, error);
    return {
      ok: false,
      description: `Could not start a game session: ${errorMessage(error).replace(/\.$/, '')}.`,
      userFixable: false,
    };
  }
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
        `[AUTO REDEEMER] submitCode returned GenericResponse ${describeResponseStatus(generic.status)} for code ${code}, user ${discordId}`
      );
      // The status name goes to the log only: enum identifiers such as
      // InsuficcientCurrency (sic) mean nothing to a user.
      if (credentials.dmOnFailure)
        sendFailureDm(discordId, [code], 'The game server rejected the request');
      return;
    }
  }

  if (!(submitResponse instanceof Object && 'codeStatus' in submitResponse)) {
    // Mainly reached when the retry after a server switch or stale
    // instance_id also fails; name the status so that reason is not lost.
    const status =
      submitResponse instanceof Object && 'status' in submitResponse
        ? describeResponseStatus((submitResponse as any).status)
        : 'no status';
    logger.error(
      `[AUTO REDEEMER] Unexpected response for code ${code}, user ${discordId} (${status})`
    );
    if (credentials.dmOnFailure)
      sendFailureDm(discordId, [code], 'The game server rejected the request');
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
        // Non-critical (the user may have DMs disabled), but leave a trace.
        .catch((err) =>
          logger.warn(
            `[AUTO REDEEMER] Success DM to ${discordId} not delivered: ${errorMessage(err)}`
          )
        );
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
 * Logs a per-user session failure and, when the user opted in and can fix it,
 * sends one DM listing the codes they missed. Never throws: the caller must be
 * able to stop the user's loop regardless.
 *
 * A failed getuserdetails is not user-fixable here, because it cannot be told
 * apart from a game outage. The trade-off: a user whose stored credentials are
 * wrong is not DMed; the operator sees an error line per run instead.
 */
async function reportSessionFailure(
  user: UserCredentials,
  codesFromFailure: string[],
  failure: Failure
): Promise<void> {
  const { discordId } = user;
  try {
    // This code and the ones after it: leave out any the user already has or
    // that are known-expired, so the DM lists only what was actually missed.
    const missed: string[] = [];
    for (const c of codesFromFailure) {
      if (await codeManager.isCodeRedeemedByUser(c, discordId)) continue;
      if (await codeManager.isCodeExpired(c)) continue;
      missed.push(c);
    }
    logger.warn(
      `[AUTO REDEEMER] Skipping ${missed.length} remaining code(s) for user ${discordId}`
    );
    if (user.dmOnFailure && failure.userFixable && missed.length > 0) {
      sendFailureDm(discordId, missed, failure.description);
    }
  } catch (error) {
    // Over-report rather than go silent: the opted-in user still hears about
    // it, with the unfiltered list.
    logger.error(
      `[AUTO REDEEMER] Could not filter codes for session failure of user ${discordId} (${failure.description}); skipping ${codesFromFailure.length} remaining code(s):`,
      error
    );
    if (user.dmOnFailure && failure.userFixable) {
      sendFailureDm(discordId, codesFromFailure, failure.description);
    }
  }
}

/**
 * Redeems a list of codes for every registered user, sequentially.
 * All codes are redeemed for one user before moving to the next user,
 * with a single random delay between users. This keeps total throttle
 * delays at N-1 (users) rather than M×(N-1) (codes × users).
 * A session failure stops that user's remaining codes; the run continues
 * with the next user.
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
      let sessionFailure: Failure | undefined;
      try {
        sessionFailure = await redeemCodeForUser(code, user);
      } catch (error) {
        logger.error(
          `[AUTO REDEEMER] Error redeeming code ${code} for user ${user.discordId}:`,
          error
        );
        continue;
      }
      if (sessionFailure) {
        // Outside the per-code try: whatever happens while reporting it, a
        // session failure must still stop this user's codes, or the failing
        // lookup comes back once per remaining code.
        await reportSessionFailure(user, codes.slice(index), sessionFailure);
        break;
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
