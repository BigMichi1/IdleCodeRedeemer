import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { users } from './schema/index';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto';
import logger from '../utils/logger';

export interface UserCredentials {
  discordId: string;
  userId: string;
  userHash: string;
  server?: string;
  instanceId?: string;
  autoRedeem?: boolean;
}

function decryptField(value: string): string {
  return isEncrypted(value) ? decrypt(value) : value;
}

function rowToCredentials(user: typeof users.$inferSelect): UserCredentials {
  return {
    discordId: user.discordId,
    userId: decryptField(user.userId),
    userHash: decryptField(user.userHash),
    server: user.server ?? undefined,
    instanceId: user.instanceId ?? undefined,
    autoRedeem: user.autoRedeem ?? true,
  };
}

class UserManager {
  async saveCredentials(credentials: UserCredentials): Promise<void> {
    const { discordId, userId, userHash, server, instanceId } = credentials;
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
      })
      .onConflictDoUpdate({
        target: users.discordId,
        set: {
          userId: encryptedUserId,
          userHash: encryptedUserHash,
          server: server ?? null,
          instanceId: instanceId ?? null,
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

  async getAllUsersWithAutoRedeem(): Promise<UserCredentials[]> {
    const rows = db.select().from(users).where(eq(users.autoRedeem, true)).orderBy(sql`${users.createdAt} DESC`).all();
    return rows.map(rowToCredentials);
  }

  async getAllUsers(): Promise<UserCredentials[]> {
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
