import { db } from './db';

interface UserCredentials {
  discordId: string;
  userId: string;
  userHash: string;
  server?: string;
  instanceId?: string;
}

interface StoredUser {
  discord_id: string;
  user_id: string;
  user_hash: string;
  server: string | null;
  instance_id: string | null;
  created_at: string;
  updated_at: string;
}

class UserManager {
  async saveCredentials(credentials: UserCredentials): Promise<void> {
    const { discordId, userId, userHash, server, instanceId } = credentials;

    await db.run(
      `INSERT OR REPLACE INTO users (discord_id, user_id, user_hash, server, instance_id, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [discordId, userId, userHash, server || null, instanceId || null]
    );
  }

  async getCredentials(discordId: string): Promise<UserCredentials | null> {
    const user = await db.get<StoredUser>('SELECT * FROM users WHERE discord_id = ?', [discordId]);

    if (!user) return null;

    return {
      discordId: user.discord_id,
      userId: user.user_id,
      userHash: user.user_hash,
      server: user.server || undefined,
      instanceId: user.instance_id || undefined,
    };
  }

  async deleteCredentials(discordId: string): Promise<void> {
    await db.run('DELETE FROM users WHERE discord_id = ?', [discordId]);
  }

  async hasCredentials(discordId: string): Promise<boolean> {
    const user = await db.get('SELECT discord_id FROM users WHERE discord_id = ?', [discordId]);
    return user !== undefined;
  }

  async updateServer(discordId: string, server: string): Promise<void> {
    await db.run(
      'UPDATE users SET server = ?, updated_at = CURRENT_TIMESTAMP WHERE discord_id = ?',
      [server, discordId]
    );
  }

  async updateInstanceId(discordId: string, instanceId: string): Promise<void> {
    await db.run(
      'UPDATE users SET instance_id = ?, updated_at = CURRENT_TIMESTAMP WHERE discord_id = ?',
      [instanceId, discordId]
    );
  }
}

export const userManager = new UserManager();
