import { describe, test, expect, beforeAll, beforeEach, afterAll, spyOn } from 'bun:test';
import { resolveGameSession } from './gameSession';
import IdleChampionsApi from '../api/idleChampionsApi';
import { db, initializeDatabase } from '../database/db';
import { userManager } from '../database/userManager';
import { users, redeemedCodes, pendingCodes } from '../database/schema/index';

// ---------------------------------------------------------------------------
// resolveGameSession() replaces a ~70-line block that was duplicated verbatim
// across /redeem, /open and /blacksmith. These tests pin the behaviour of the
// code it replaced: server fallback, persistence, the one-shot server-switch
// retry, and each failure branch.
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
      expect(session).toMatchObject({ description: 'Server switch failed.' });
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
        description: 'Could not determine game server.',
      });
      expect(getUserDetailsSpy).not.toHaveBeenCalled();
    });

    test('reports when user details come back without a details object', async () => {
      getUserDetailsSpy.mockResolvedValue({ status: 2 } as any);

      const session = await resolveGameSession(USER, creds(CACHED_SERVER));

      expect(session).toMatchObject({ ok: false, description: 'Could not retrieve user data.' });
    });

    test('reports when the response is null', async () => {
      getUserDetailsSpy.mockResolvedValue(null as any);

      const session = await resolveGameSession(USER, creds(CACHED_SERVER));

      expect(session).toMatchObject({ ok: false, description: 'Could not retrieve user data.' });
    });

    test("rejects the API's '0' no-session sentinel", async () => {
      getUserDetailsSpy.mockResolvedValue({ details: { instance_id: '0' } } as any);

      const session = await resolveGameSession(USER, creds(CACHED_SERVER));

      expect(session).toMatchObject({
        ok: false,
        description: 'Could not retrieve valid instance ID from server.',
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

    test('every failure carries a title so callers can render it directly', async () => {
      getUserDetailsSpy.mockResolvedValue({ status: 2 } as any);
      const session = await resolveGameSession(USER, creds(CACHED_SERVER));
      expect(session.ok).toBe(false);
      if (!session.ok) {
        expect(session.title).toBe('❌ Error');
      }
    });
  });
});
