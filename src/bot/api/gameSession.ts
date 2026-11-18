import IdleChampionsApi, { ResponseStatus } from './idleChampionsApi';
import { userManager, type UserCredentials } from '../database/userManager';

/**
 * The single place that turns stored credentials into live game state. Every
 * getuserdetails caller goes through here.
 *
 * It started as one ~70-line block duplicated verbatim across /redeem, /open
 * and /blacksmith, while /catchup, /inventory, the auto-redeemer and the
 * backfill each kept their own copy. Those copies drifted: the backfill never
 * followed the SwitchServer redirect, so when the game moved accounts to a new
 * play server it reported "invalid credentials" and skipped every user.
 *
 * The failure branches return a message instead of replying directly so the
 * caller keeps control of how and when it responds.
 */
type Failure = { ok: false; title: string; description: string };

export type PlayerDataResult = { ok: true; server: string; player: PlayerData } | Failure;

export type GameSession = { ok: true; server: string; instanceId: string } | Failure;

function failure(description: string): Failure {
  return { ok: false, title: '❌ Error', description };
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
      return failure('Could not determine game server.');
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
  if (
    userResult instanceof Object &&
    'status' in userResult &&
    (userResult as any).status === ResponseStatus.SwitchServer
  ) {
    const newServer = (userResult as any).newServer;
    if (!newServer) {
      return failure('Server switch failed.');
    }
    server = newServer as string;
    await userManager.updateServer(discordId, server);

    userResult = await IdleChampionsApi.getUserDetails({
      server,
      user_id: credentials.userId,
      hash: credentials.userHash,
    });
  }

  const player = userResult as any;
  if (!player?.details) {
    return failure('Could not retrieve user data.');
  }

  return { ok: true, server, player: player as PlayerData };
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
    return failure('Could not retrieve valid instance ID from server.');
  }

  return { ok: true, server: result.server, instanceId };
}
