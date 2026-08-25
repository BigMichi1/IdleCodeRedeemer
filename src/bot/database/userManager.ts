import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { users } from './schema/index';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto';
import logger from '../utils/logger';

/**
 * Write side: what a caller may supply to saveCredentials().
 *
 * The preference fields are genuinely optional here -- omitting them leaves an
 * existing user's choices untouched.
 */
export interface UserCredentials {
  discordId: string;
  userId: string;
  userHash: string;
  server?: string;
  instanceId?: string;
  autoRedeem?: boolean;
  dmOnCode?: boolean;
  dmOnSuccess?: boolean;
  dmOnFailure?: boolean;
}

/**
 * Read side: what rowToCredentials() always produces.
 *
 * Every preference column is NOT NULL with a default, so these are always
 * present. Typing them as required stops consumers writing defensive checks for
 * an `undefined` that cannot occur -- and stops `if (credentials.dmOnFailure)`
 * conflating "absent" with "false".
 */
export interface UserProfile {
  discordId: string;
  userId: string;
  userHash: string;
  server?: string;
  instanceId?: string;
  autoRedeem: boolean;
  dmOnCode: boolean;
  dmOnSuccess: boolean;
  dmOnFailure: boolean;
}

export interface NotificationPreferences {
  dmOnCode: boolean;
  dmOnSuccess: boolean;
  dmOnFailure: boolean;
}

function decryptField(value: string): string {
  return isEncrypted(value) ? decrypt(value) : value;
}

function rowToCredentials(user: typeof users.$inferSelect): UserProfile {
  return {
    discordId: user.discordId,
    userId: decryptField(user.userId),
    userHash: decryptField(user.userHash),
    server: user.server ?? undefined,
    instanceId: user.instanceId ?? undefined,
    // The four preference columns are NOT NULL with defaults, so no `??`
    // fallbacks are needed -- those branches were unreachable.
    autoRedeem: user.autoRedeem,
    dmOnCode: user.dmOnCode,
    dmOnSuccess: user.dmOnSuccess,
    dmOnFailure: user.dmOnFailure,
  };
}

class UserManager {
  /**
   * Insert or update a user's credentials.
   *
   * Notification preferences are optional: they are applied only when supplied,
   * so re-running /setup does not silently reset a user's existing choices.
   * (They were previously declared on the parameter type and then dropped on
   * the floor -- passing autoRedeem:false type-checked and did nothing.)
   */
  async saveCredentials(credentials: UserCredentials): Promise<void> {
    const { discordId, userId, userHash, server, instanceId } = credentials;
    const prefs = {
      ...(credentials.autoRedeem !== undefined && { autoRedeem: credentials.autoRedeem }),
      ...(credentials.dmOnCode !== undefined && { dmOnCode: credentials.dmOnCode }),
      ...(credentials.dmOnSuccess !== undefined && { dmOnSuccess: credentials.dmOnSuccess }),
      ...(credentials.dmOnFailure !== undefined && { dmOnFailure: credentials.dmOnFailure }),
    };
    if (!userId || !userHash) {
      throw new Error('userId and userHash must not be empty');
    }
    const encryptedUserId = encrypt(userId);
    const encryptedUserHash = encrypt(userHash);

    db.insert(users)
      .values({
        discordId,
        userId: encryptedUserId,
        userHash: encryptedUserHash,
        server: server ?? null,
        instanceId: instanceId ?? null,
        ...prefs,
      })
      .onConflictDoUpdate({
        target: users.discordId,
        set: {
          userId: encryptedUserId,
          userHash: encryptedUserHash,
          server: server ?? null,
          instanceId: instanceId ?? null,
          ...prefs,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })
      .run();
  }

  async getCredentials(discordId: string): Promise<UserCredentials | null> {
    const user = db.select().from(users).where(eq(users.discordId, discordId)).get();
    return user ? rowToCredentials(user) : null;
  }

  async deleteCredentials(discordId: string): Promise<void> {
    db.delete(users).where(eq(users.discordId, discordId)).run();
  }

  async hasCredentials(discordId: string): Promise<boolean> {
    const user = db.select({ discordId: users.discordId }).from(users).where(eq(users.discordId, discordId)).get();
    return user !== undefined;
  }

  async getUserCount(): Promise<number> {
    const result = db.select({ count: sql<number>`COUNT(*)` }).from(users).get();
    return result?.count ?? 0;
  }

  async updateServer(discordId: string, server: string): Promise<void> {
    db.update(users)
      .set({ server, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(users.discordId, discordId))
      .run();
  }

  async updateInstanceId(discordId: string, instanceId: string): Promise<void> {
    db.update(users)
      .set({ instanceId, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(users.discordId, discordId))
      .run();
  }

  async setAutoRedeem(discordId: string, enabled: boolean): Promise<void> {
    db.update(users)
      .set({ autoRedeem: enabled, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(users.discordId, discordId))
      .run();
  }

  async getAllUsersWithAutoRedeem(): Promise<UserProfile[]> {
    const rows = db.select().from(users).where(eq(users.autoRedeem, true)).orderBy(sql`${users.createdAt} DESC`).all();
    return rows.map(rowToCredentials);
  }

  /**
   * Returns only the Discord IDs of users who have opted into code-detection DMs.
   */
  async getDiscordIdsWithDmOnCode(): Promise<string[]> {
    const rows = db.select({ discordId: users.discordId }).from(users).where(eq(users.dmOnCode, true)).all();
    return rows.map((r) => r.discordId);
  }

  /**
   * Update notification preferences for a user.
   *
   * Note: this is a silent no-op when `discordId` does not exist in the
   * database. The `/notifications` command guards against this by requiring
   * `getCredentials` to succeed first. Direct callers must do the same.
   */
  async setNotificationPreferences(discordId: string, prefs: Partial<NotificationPreferences>): Promise<boolean> {
    const update: Partial<{ dmOnCode: boolean; dmOnSuccess: boolean; dmOnFailure: boolean }> = {};
    if (prefs.dmOnCode !== undefined) update.dmOnCode = prefs.dmOnCode;
    if (prefs.dmOnSuccess !== undefined) update.dmOnSuccess = prefs.dmOnSuccess;
    if (prefs.dmOnFailure !== undefined) update.dmOnFailure = prefs.dmOnFailure;
    if (Object.keys(update).length === 0) return false;
    const rows = db.update(users)
      .set({ ...update, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(users.discordId, discordId))
      .returning({ discordId: users.discordId })
      .all();
    return rows.length > 0;
  }

  async getAllUsers(): Promise<UserProfile[]> {
    const rows = db.select().from(users).orderBy(sql`${users.createdAt} DESC`).all();
    return rows.map(rowToCredentials);
  }

  /**
   * One-time migration: re-encrypts any rows whose userId/userHash were stored
   * as plaintext before encryption was introduced. Safe to call on every startup.
   */
  async migratePlaintextCredentials(): Promise<void> {
    const rows = db.select().from(users).all();
    let migrated = 0;
    for (const row of rows) {
      const userIdNeedsEncryption = !isEncrypted(row.userId);
      const userHashNeedsEncryption = !isEncrypted(row.userHash);
      if (userIdNeedsEncryption || userHashNeedsEncryption) {
        db.update(users)
          .set({
            userId: userIdNeedsEncryption ? encrypt(row.userId) : row.userId,
            userHash: userHashNeedsEncryption ? encrypt(row.userHash) : row.userHash,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(users.discordId, row.discordId))
          .run();
        migrated++;
      }
    }
    if (migrated > 0) {
      logger.info(`[USER MANAGER] Migrated ${migrated} plaintext credential row(s) to encrypted storage`);
    }
  }
}

export const userManager = new UserManager();
