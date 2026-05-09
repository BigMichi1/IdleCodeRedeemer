import { db } from './db';

interface RedeemedCode {
  code: string;
  discordId?: string;
  status?: string;
  lootDetail?: string;
}

class CodeManager {
  async addRedeemedCode(code: string, discordId: string, status: string, lootDetail?: string): Promise<void> {
    await db.run(
      `INSERT OR REPLACE INTO redeemed_codes (code, discord_id, status, loot_detail)
       VALUES (?, ?, ?, ?)`,
      [code, discordId, status, lootDetail ? JSON.stringify(lootDetail) : null]
    );
  }

  async isCodeRedeemed(code: string): Promise<boolean> {
    const result = await db.get(
      `SELECT code FROM redeemed_codes WHERE code = ?`,
      [code]
    );
    return result !== undefined;
  }

  async getRedeemedCodes(discordId: string): Promise<string[]> {
    const results = await db.all<{ code: string }>(
      `SELECT code FROM redeemed_codes WHERE discord_id = ? ORDER BY redeemed_at DESC LIMIT 100`,
      [discordId]
    );
    return results.map(r => r.code);
  }

  async addPendingCode(code: string, discordId?: string): Promise<void> {
    await db.run(
      `INSERT INTO pending_codes (code, discord_id) VALUES (?, ?)`,
      [code, discordId || null]
    );
  }

  async getPendingCodes(discordId?: string): Promise<string[]> {
    let sql = `SELECT code FROM pending_codes`;
    let params: any[] = [];

    if (discordId) {
      sql += ` WHERE discord_id = ?`;
      params = [discordId];
    }

    sql += ` ORDER BY found_at ASC`;

    const results = await db.all<{ code: string }>(sql, params);
    return results.map(r => r.code);
  }

  async removePendingCode(code: string): Promise<void> {
    await db.run(
      `DELETE FROM pending_codes WHERE code = ?`,
      [code]
    );
  }

  async clearPendingCodes(discordId?: string): Promise<void> {
    if (discordId) {
      await db.run(
        `DELETE FROM pending_codes WHERE discord_id = ?`,
        [discordId]
      );
    } else {
      await db.run(`DELETE FROM pending_codes`);
    }
  }
}

export const codeManager = new CodeManager();
