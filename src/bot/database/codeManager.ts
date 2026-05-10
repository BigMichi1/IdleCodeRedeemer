import { db } from './db';

interface RedeemedCode {
  code: string;
  discordId?: string;
  status?: string;
  lootDetail?: string;
  isPublic?: boolean;
  expiresAt?: string;
}

interface RedeemedCodeRow {
  id: number;
  code: string;
  discord_id: string;
  redeemed_at: string;
  status: string;
  loot_detail: string;
  is_public: number;
  expires_at: string | null;
}

class CodeManager {
  async addRedeemedCode(
    code: string,
    discordId: string,
    status: string,
    lootDetail?: string,
    isPublic: boolean = false
  ): Promise<void> {
    await db.run(
      `INSERT OR REPLACE INTO redeemed_codes (code, discord_id, status, loot_detail, is_public)
       VALUES (?, ?, ?, ?, ?)`,
      [code, discordId, status, lootDetail ? JSON.stringify(lootDetail) : null, isPublic ? 1 : 0]
    );
  }

  async isCodeRedeemed(code: string): Promise<boolean> {
    const result = await db.get(
      "SELECT code FROM redeemed_codes WHERE code = ? AND (status = 'Success' OR status = 'Code Expired')",
      [code]
    );
    return result !== undefined;
  }

  async getRedeemedCodes(discordId: string): Promise<string[]> {
    const results = await db.all<{ code: string }>(
      'SELECT code FROM redeemed_codes WHERE discord_id = ? ORDER BY redeemed_at DESC LIMIT 100',
      [discordId]
    );
    return results.map((r) => r.code);
  }

  async getRedeemedCodeDetails(discordId: string, limit: number = 10): Promise<RedeemedCodeRow[]> {
    const results = await db.all<RedeemedCodeRow>(
      `SELECT id, code, discord_id, redeemed_at, status, loot_detail, is_public, expires_at
       FROM redeemed_codes 
       WHERE discord_id = ? 
       ORDER BY redeemed_at DESC 
       LIMIT ?`,
      [discordId, limit]
    );
    return results;
  }

  async getPublicUnexpiredCodes(): Promise<RedeemedCodeRow[]> {
    const results = await db.all<RedeemedCodeRow>(
      `SELECT id, code, discord_id, redeemed_at, status, loot_detail, is_public, expires_at
       FROM redeemed_codes 
       WHERE is_public = 1 
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       AND status = 'Success'
       ORDER BY redeemed_at DESC`,
      []
    );
    return results;
  }

  async getSuccessfulRedeemCount(code: string): Promise<number> {
    const result = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM redeemed_codes WHERE code = ? AND status = 'Success'",
      [code]
    );
    return result?.count || 0;
  }

  async isCodeSuccessfullyRedeemedByOther(code: string, discordId: string): Promise<boolean> {
    const result = await db.get(
      "SELECT code FROM redeemed_codes WHERE code = ? AND discord_id != ? AND status = 'Success'",
      [code, discordId]
    );
    return result !== undefined;
  }

  async isCodePublic(code: string): Promise<boolean> {
    const result = await db.get(
      'SELECT code FROM redeemed_codes WHERE code = ? AND is_public = 1',
      [code]
    );
    return result !== undefined;
  }

  async isCodeExpired(code: string): Promise<boolean> {
    const result = await db.get('SELECT code FROM redeemed_codes WHERE code = ? AND status = ?', [
      code,
      'Code Expired',
    ]);
    return result !== undefined;
  }

  async markCodeAsExpired(code: string): Promise<void> {
    await db.run(
      "UPDATE redeemed_codes SET status = 'expired', expires_at = CURRENT_TIMESTAMP WHERE code = ?",
      [code]
    );
  }

  async markCodeAsPublic(code: string): Promise<void> {
    await db.run('UPDATE redeemed_codes SET is_public = 1 WHERE code = ?', [code]);
  }

  async markCodeAsPrivate(code: string): Promise<void> {
    await db.run('UPDATE redeemed_codes SET is_public = 0 WHERE code = ?', [code]);
  }

  async addPendingCode(code: string, discordId?: string): Promise<void> {
    await db.run('INSERT INTO pending_codes (code, discord_id) VALUES (?, ?)', [
      code,
      discordId || null,
    ]);
  }

  async getPendingCodes(discordId?: string): Promise<string[]> {
    let sql = 'SELECT code FROM pending_codes';
    let params: any[] = [];

    if (discordId) {
      sql += ' WHERE discord_id = ?';
      params = [discordId];
    }

    sql += ' ORDER BY found_at ASC';

    const results = await db.all<{ code: string }>(sql, params);
    return results.map((r) => r.code);
  }

  async removePendingCode(code: string): Promise<void> {
    await db.run('DELETE FROM pending_codes WHERE code = ?', [code]);
  }

  async clearPendingCodes(discordId?: string): Promise<void> {
    if (discordId) {
      await db.run('DELETE FROM pending_codes WHERE discord_id = ?', [discordId]);
    } else {
      await db.run('DELETE FROM pending_codes');
    }
  }
}

export const codeManager = new CodeManager();
