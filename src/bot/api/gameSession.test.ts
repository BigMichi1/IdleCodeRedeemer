import { describe, test, expect, beforeAll, beforeEach, afterAll, spyOn } from 'bun:test';
import { resolveGameSession, resolvePlayerData } from './gameSession';
import IdleChampionsApi from './idleChampionsApi';
import { db, initializeDatabase } from '../database/db';
import { userManager } from '../database/userManager';
import { users, redeemedCodes, pendingCodes } from '../database/schema/index';

// ---------------------------------------------------------------------------
// resolvePlayerData() and resolveGameSession() are the only getuserdetails
// callers. They replaced a block copied verbatim across /redeem, /open and
// /blacksmith, plus drifted copies in /catchup, /inventory, the auto-redeemer
// and the backfill. These tests pin server fallback, persistence, the one-shot
// server-switch retry, the instance_id check (resolveGameSession only), and
// each failure branch.
// ---------------------------------------------------------------------------

const USER = 'discord-session-user';
const CACHED_SERVER = 'https://cached.example.com/~idledragons/post.php';
const LOOKUP_SERVER = 'https://looked-up.example.com/~idledragons/post.php';
const SWITCHED_SERVER = 'https://switched.example.com/~idledragons/post.php';
const INSTANCE = '556677';

const getUserDetailsSpy = spyOn(IdleChampionsApi, 'getUserDetails');
const getServerSpy = spyOn(IdleChampionsApi, 'getServer');

/** Credentials as the commands build them, with an overridable cached server. */
function creds(server?: string) {
  return { discordId: USER, userId: '12345', userHash: 'hash-value', server };
}

beforeAll(() => {
  initializeDatabase();
});

beforeEach(async () => {
  db.delete(pendingCodes).run();
  db.delete(redeemedCodes).run();
  db.delete(users).run();
  await userManager.saveCredentials({
    discordId: USER,
    userId: '12345',
    userHash: 'hash-value',
    server: CACHED_SERVER,
  });

  getUserDetailsSpy.mockReset();
  getServerSpy.mockReset();
  getUserDetailsSpy.mockResolvedValue({ details: { instance_id: INSTANCE } } as any);
  getServerSpy.mockResolvedValue(LOOKUP_SERVER as any);
});

afterAll(() => {
  getUserDetailsSpy.mockRestore();
  getServerSpy.mockRestore();
  db.delete(pendingCodes).run();
  db.delete(redeemedCodes).run();
  db.delete(users).run();
});

describe('resolveGameSession', () => {
  describe('happy path', () => {
    test('uses the cached server without a lookup', async () => {
      const session = await resolveGameSession(USER, creds(CACHED_SERVER));

      expect(session.ok).toBe(true);
      expect(session).toMatchObject({ server: CACHED_SERVER, instanceId: INSTANCE });
      expect(getServerSpy).not.toHaveBeenCalled();
    });

    test('looks the server up when none is cached, and persists it', async () => {
      const session = await resolveGameSession(USER, creds(undefined));

      expect(session).toMatchObject({ ok: true, server: LOOKUP_SERVER });
      expect(getServerSpy).toHaveBeenCalled();

      // Persisted, so the next command does not repeat the lookup.
      const stored = await userManager.getCredentials(USER);
      expect(stored?.server).toBe(LOOKUP_SERVER);
    });
  });

  describe('server switch', () => {
    test('follows the redirect once, persists it, and re-fetches', async () => {
      getUserDetailsSpy
        .mockResolvedValueOnce({ status: 4, newServer: SWITCHED_SERVER } as any)
        .mockResolvedValueOnce({ details: { instance_id: INSTANCE } } as any);

      const session = await resolveGameSession(USER, creds(CACHED_SERVER));

      expect(session).toMatchObject({ ok: true, server: SWITCHED_SERVER, instanceId: INSTANCE });
      expect(getUserDetailsSpy).toHaveBeenCalledTimes(2);
      // The retry must target the NEW server, not the stale one.
      expect((getUserDetailsSpy.mock.calls[1]![0] as any).server).toBe(SWITCHED_SERVER);

      const stored = await userManager.getCredentials(USER);
      expect(stored?.server).toBe(SWITCHED_SERVER);
    });

    test('fails cleanly when the switch response carries no new server', async () => {
      getUserDetailsSpy.mockResolvedValue({ status: 4 } as any);

      const session = await resolveGameSession(USER, creds(CACHED_SERVER));

      expect(session.ok).toBe(false);
      expect(session).toMatchObject({
        description: 'The game asked to switch servers but named none. Try again later.',
      });
      // Regression: /inventory passed undefined straight into updateServer and
      // then into new URL(), throwing instead of reporting.
      expect(getUserDetailsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure branches', () => {
    test('reports when no server can be determined', async () => {
      getServerSpy.mockResolvedValue(undefined as any);

      const session = await resolveGameSession(USER, creds(undefined));

      expect(session).toMatchObject({
        ok: false,
        description: 'Could not determine the game server. Try again later.',
      });
      expect(getUserDetailsSpy).not.toHaveBeenCalled();
    });

    test('reports when user details come back without a details object', async () => {
      getUserDetailsSpy.mockResolvedValue({ status: 2 } as any);

      const session = await resolveGameSession(USER, creds(CACHED_SERVER));

      expect(session).toMatchObject({
        ok: false,
        description:
          'Could not retrieve your account from the game server. Check your credentials with `/setup`.',
      });
    });

    test('reports when the response is null', async () => {
      getUserDetailsSpy.mockResolvedValue(null as any);

      const session = await resolveGameSession(USER, creds(CACHED_SERVER));

      expect(session).toMatchObject({
        ok: false,
        description:
          'Could not retrieve your account from the game server. Check your credentials with `/setup`.',
      });
    });

    test("rejects the API's '0' no-session sentinel", async () => {
      getUserDetailsSpy.mockResolvedValue({ details: { instance_id: '0' } } as any);

      const session = await resolveGameSession(USER, creds(CACHED_SERVER));

      expect(session).toMatchObject({
        ok: false,
        description: 'Could not find an active game session. Open Idle Champions and try again.',
      });
    });

    test('rejects a missing, empty or whitespace instance_id', async () => {
      for (const instance_id of [undefined, '', '   ']) {
        getUserDetailsSpy.mockResolvedValue({ details: { instance_id } } as any);
        const session = await resolveGameSession(USER, creds(CACHED_SERVER));
        expect(session.ok).toBe(false);
      }
    });

    test('coerces a numeric instance_id to a string', async () => {
      getUserDetailsSpy.mockResolvedValue({ details: { instance_id: 998877 } } as any);

      const session = await resolveGameSession(USER, creds(CACHED_SERVER));

      expect(session).toMatchObject({ ok: true, instanceId: '998877' });
    });

    test('every failure carries a description callers can show the user', async () => {
      getUserDetailsSpy.mockResolvedValue({ status: 2 } as any);
      const session = await resolveGameSession(USER, creds(CACHED_SERVER));
      expect(session.ok).toBe(false);
      if (!session.ok) {
        expect(session.description).toContain('/setup');
      }
    });
  });
});

describe('resolvePlayerData', () => {
  // /inventory only reads account state, so it must not be blocked by the
  // instance_id check that resolveGameSession adds for state-changing calls.
  test('returns the player details without requiring an instance_id', async () => {
    const player = { details: { instance_id: '0', gold: '42' } };
    getUserDetailsSpy.mockResolvedValue(player as any);

    const result = await resolvePlayerData(USER, creds(CACHED_SERVER));

    expect(result).toEqual({ ok: true, server: CACHED_SERVER, player: player as any });
  });

  test('follows a server switch and persists it', async () => {
    getUserDetailsSpy
      .mockResolvedValueOnce({ status: 4, newServer: SWITCHED_SERVER } as any)
      .mockResolvedValueOnce({ details: { gold: '1' } } as any);

    const result = await resolvePlayerData(USER, creds(CACHED_SERVER));

    expect(result).toMatchObject({ ok: true, server: SWITCHED_SERVER });
    expect((await userManager.getCredentials(USER))?.server).toBe(SWITCHED_SERVER);
  });

  test('fails when user details come back without a details object', async () => {
    getUserDetailsSpy.mockResolvedValue({ status: 2 } as any);

    const result = await resolvePlayerData(USER, creds(CACHED_SERVER));

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.description).toContain('Check your credentials');
  });

  test('does not follow a second redirect in a row, and says so', async () => {
    // One-shot by design: following redirects unboundedly could loop. A second
    // redirect gets its own message so it is not mistaken for bad credentials.
    getUserDetailsSpy.mockResolvedValue({ status: 4, newServer: SWITCHED_SERVER } as any);

    const result = await resolvePlayerData(USER, creds(CACHED_SERVER));

    expect(getUserDetailsSpy).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.description).toContain('twice in a row');
  });
});
