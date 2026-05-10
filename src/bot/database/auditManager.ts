import { db } from './db';

interface AuditLog {
  id: number;
  discord_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

class AuditManager {
  /**
   * Log an action to the audit log
   */
  async logAction(discordId: string | null, action: string, details?: any): Promise<void> {
    const detailsStr = details ? JSON.stringify(details) : null;
    await db.run(
      `INSERT INTO audit_log (discord_id, action, details)
       VALUES (?, ?, ?)`,
      [discordId, action, detailsStr]
    );
  }

  /**
   * Get audit log entries for a specific user
   */
  async getUserAuditLog(discordId: string, limit: number = 50): Promise<AuditLog[]> {
    return db.all<AuditLog>(
      `SELECT id, discord_id, action, details, created_at
       FROM audit_log
       WHERE discord_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [discordId, limit]
    );
  }

  /**
   * Get all audit log entries (admin function)
   */
  async getAllAuditLog(limit: number = 100): Promise<AuditLog[]> {
    return db.all<AuditLog>(
      `SELECT id, discord_id, action, details, created_at
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
  }

  /**
   * Get audit log entries since a specific timestamp
   */
  async getAuditLogSince(timestamp: string, limit: number = 100): Promise<AuditLog[]> {
    return db.all<AuditLog>(
      `SELECT id, discord_id, action, details, created_at
       FROM audit_log
       WHERE created_at >= ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [timestamp, limit]
    );
  }

  /**
   * Get audit log entries for a specific action
   */
  async getAuditLogByAction(action: string, limit: number = 50): Promise<AuditLog[]> {
    return db.all<AuditLog>(
      `SELECT id, discord_id, action, details, created_at
       FROM audit_log
       WHERE action = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [action, limit]
    );
  }
}

export const auditManager = new AuditManager();
