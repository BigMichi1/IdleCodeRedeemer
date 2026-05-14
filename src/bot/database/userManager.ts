import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { users } from './schema/index';

interface UserCredentials {
  discordId: string;
  userId: string;
  userHash: string;
  server?: string;
  instanceId?: string;
  autoRedeem: boolean;
}

function rowToCredentials(user: typeof users.$inferSelect): UserCredentials {
  return {
    discordId: user.discordId,
    userId: user.userId,
    userHash: user.userHash,
    server: user.server ?? undefined,
    instanceId: user.instanceId ?? undefined,
    autoRedeem: user.autoRedeem ?? true,
  };
}

class UserManager {
  async saveCredentials(credentials: UserCredentials): Promise<void> {
    const { discordId, userId, userHash, server, instanceId } = credentials;

    db.insert(users)
      .values({ discordId, userId, userHash, server: server ?? null, instanceId: instanceId ?? null })
      .onConflictDoUpdate({
        target: users.discordId,
        set: {
          userId,
          userHash,
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
}

export const userManager = new UserManager();
