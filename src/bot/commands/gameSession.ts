import IdleChampionsApi, { ResponseStatus } from '../api/idleChampionsApi';
import { userManager, type UserCredentials } from '../database/userManager';

/**
 * Resolving a usable game session — a play server plus a current instance_id —
 * was duplicated verbatim across /redeem, /open and /blacksmith. Diffing the
 * three ~70-line blocks returned a single comment line of difference.
 *
 * The failure branches return a message instead of replying directly so the
 * caller keeps control of how and when it responds.
 */
export type GameSession =
  | { ok: true; server: string; instanceId: string }
  | { ok: false; title: string; description: string };

function failure(description: string): GameSession {
  return { ok: false, title: '❌ Error', description };
}

export async function resolveGameSession(
  discordId: string,
  credentials: UserCredentials
): Promise<GameSession> {
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
    server = newServer;
    await userManager.updateServer(discordId, newServer);

    userResult = await IdleChampionsApi.getUserDetails({
      server: newServer,
      user_id: credentials.userId,
      hash: credentials.userHash,
    });
  }

  const userData = userResult as any;
  if (!userData?.details) {
    return failure('Could not retrieve user data.');
  }

  // Coerce and validate in one step. '0' is the API's "no session" sentinel.
  const instanceId = String(userData.details.instance_id ?? '').trim();
  if (!instanceId || instanceId === '0') {
    return failure('Could not retrieve valid instance ID from server.');
  }

  return { ok: true, server: server!, instanceId };
}
