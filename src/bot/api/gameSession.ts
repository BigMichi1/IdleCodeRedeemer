// The single place that turns stored credentials into live game state: every
// getuserdetails call goes through here.
//
// It started as one ~70-line block duplicated verbatim across /redeem, /open
// and /blacksmith, while /catchup, /inventory, the auto-redeemer and the
// backfill each kept their own copy. Those copies drifted: the backfill never
// followed the SwitchServer redirect, so when the game moved accounts to a new
// play server it reported "invalid credentials" and skipped every user.
//
// Failures are returned as a message instead of replied directly so the caller
// keeps control of how and when it responds.

import IdleChampionsApi, { ResponseStatus, type GenericResponse } from './idleChampionsApi';
import { userManager, type UserCredentials } from '../database/userManager';
import logger from '../utils/logger';

type Failure = { ok: false; description: string };

export type PlayerDataResult = { ok: true; server: string; player: PlayerData } | Failure;

export type GameSession = { ok: true; server: string; instanceId: string } | Failure;

function failure(description: string): Failure {
  return { ok: false, description };
}

/**
 * Structural rather than IdleChampionsApi.isGenericResponse()'s instanceof:
 * the API only ever returns real GenericResponse instances, but the tests (and
 * anything else that stubs getUserDetails) hand back plain objects, which
 * instanceof would silently treat as player data.
 */
function isGenericResponse(result: GenericResponse | PlayerData): result is GenericResponse {
  return result instanceof Object && 'status' in result;
}

/**
 * Resolves the play server and fetches the player's details. Use this when
 * only reading account state (/inventory); state-changing calls need
 * resolveGameSession(), which also validates the instance_id.
 */
export async function resolvePlayerData(
  discordId: string,
  credentials: UserCredentials
): Promise<PlayerDataResult> {
  // Prefer the cached server; fall back to a lookup and persist the result.
  let server = credentials.server;
  if (!server) {
    server = await IdleChampionsApi.getServer();
    if (!server) {
      return failure('Could not determine the game server. Try again later.');
    }
    await userManager.updateServer(discordId, server);
  }

  let userResult = await IdleChampionsApi.getUserDetails({
    server,
    user_id: credentials.userId,
    hash: credentials.userHash,
  });

  // The game may move an account to a different play server. Follow the
  // redirect once, persist it, and re-fetch.
  if (isGenericResponse(userResult) && userResult.status === ResponseStatus.SwitchServer) {
    if (!userResult.newServer) {
      return failure('The game asked to switch servers but named none. Try again later.');
    }
    server = userResult.newServer;
    await userManager.updateServer(discordId, server);

    userResult = await IdleChampionsApi.getUserDetails({
      server,
      user_id: credentials.userId,
      hash: credentials.userHash,
    });

    // Following a second redirect could loop; report it distinctly so it is
    // not mistaken for bad credentials.
    if (isGenericResponse(userResult) && userResult.status === ResponseStatus.SwitchServer) {
      logger.warn(`[GAME SESSION] Second server switch in a row for user ${discordId}`);
      return failure('The game redirected to another server twice in a row. Try again later.');
    }
  }

  if (!userResult || isGenericResponse(userResult) || !userResult.details) {
    // getUserDetails collapses every non-redirect failure (HTTP error, network,
    // success:false) into one status; the raw response is in api-logs/.
    const status = isGenericResponse(userResult) ? userResult.status : 'no details';
    logger.warn(`[GAME SESSION] getuserdetails failed for user ${discordId} (status ${status})`);
    return failure(
      'Could not retrieve your account from the game server. Check your credentials with `/setup`.'
    );
  }

  return { ok: true, server, player: userResult };
}

/**
 * Resolves a usable game session (play server plus a current instance_id).
 * instance_id is per-session, so call this before every state-changing game
 * call and again whenever the API reports the instance_id as outdated.
 */
export async function resolveGameSession(
  discordId: string,
  credentials: UserCredentials
): Promise<GameSession> {
  const result = await resolvePlayerData(discordId, credentials);
  if (!result.ok) return result;

  // Coerce and validate in one step. '0' is the API's "no session" sentinel.
  const instanceId = String(result.player.details.instance_id ?? '').trim();
  if (!instanceId || instanceId === '0') {
    return failure('Could not find an active game session. Open Idle Champions and try again.');
  }

  return { ok: true, server: result.server, instanceId };
}
