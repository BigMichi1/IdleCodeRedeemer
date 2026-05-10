import { eq, gte, sql } from 'drizzle-orm';
import { db } from './db';
import { auditLog } from './schema/index';

type AuditLog = typeof auditLog.$inferSelect;

class AuditManager {
  async logAction(discordId: string | null, action: string, details?: any): Promise<void> {
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

  async getAuditLogByAction(action: string, limit: number = 50): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, action))
      .orderBy(sql`${auditLog.createdAt} DESC`)
      .limit(limit)
      .all();
  }
}

export const auditManager = new AuditManager();
