import { eq, gte, sql } from 'drizzle-orm';
import { db } from './db';
import { auditLog } from './schema/index';

type AuditLog = typeof auditLog.$inferSelect;

/**
 * The closed set of audited actions. A union rather than `string` so a typo is
 * a compile error and getAuditLogByAction() cannot search for a value that is
 * never written.
 */
export type AuditAction =
  | 'USER_SETUP'
  | 'CODE_REDEEMED'
  | 'CODE_REDEEM_FAILED'
  | 'CODE_MADE_PUBLIC'
  | 'CHESTS_OPENED'
  | 'BLACKSMITH_USED'
  | 'VIEWED_CODES'
  | 'VIEWED_INVENTORY'
  | 'VIEWED_STATS'
  | 'BACKFILL_STARTED'
  | 'BACKFILL_COMPLETED'
  | 'CATCHUP_REDEEM_SUCCESS'
  | 'CATCHUP_REDEEM_FAILED'
  | 'AUTO_REDEEM_TOGGLED'
  | 'NOTIFICATION_PREFS_UPDATED';

class AuditManager {
  // `details` is only ever JSON.stringify'd, so `unknown` is the accurate type.
  async logAction(discordId: string | null, action: AuditAction, details?: unknown): Promise<void> {
    const detailsStr = details ? JSON.stringify(details) : null;
    db.insert(auditLog).values({ discordId, action, details: detailsStr }).run();
  }

  async getUserAuditLog(discordId: string, limit: number = 50): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLog)
      .where(eq(auditLog.discordId, discordId))
      .orderBy(sql`${auditLog.createdAt} DESC`)
      .limit(limit)
      .all();
  }

  async getAllAuditLog(limit: number = 100): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLog)
      .orderBy(sql`${auditLog.createdAt} DESC`)
      .limit(limit)
      .all();
  }

  async getAuditLogSince(timestamp: string, limit: number = 100): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLog)
      .where(gte(auditLog.createdAt, timestamp))
      .orderBy(sql`${auditLog.createdAt} DESC`)
      .limit(limit)
      .all();
  }

  async getAuditLogByAction(action: AuditAction, limit: number = 50): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, action))
      .orderBy(sql`${auditLog.createdAt} DESC`)
      .limit(limit)
      .all();
  }

  async deleteUserAuditLog(discordId: string): Promise<void> {
    db.delete(auditLog).where(eq(auditLog.discordId, discordId)).run();
  }
}

export const auditManager = new AuditManager();
