import { eq, ne, and, or, isNull, gt, sql, max, inArray } from 'drizzle-orm';
import { db } from './db';
import { redeemedCodes, pendingCodes } from './schema/index';

interface RedeemedCode {
  code: string;
  discordId?: string;
  status?: string;
  lootDetail?: string;
  isPublic?: boolean;
  expiresAt?: string;
}

type RedeemedCodeRow = typeof redeemedCodes.$inferSelect;

const CODE_STATUS_MAP: Record<number, string> = {
  0: 'Success',
  1: 'Already Redeemed',
  2: 'Invalid Parameters',
  3: 'Not a Valid Code',
  4: 'Code Expired',
  5: 'Cannot Redeem',
};

/**
 * Converts a numeric codeStatus (from the game API) to its canonical string name.
 * String values that are already canonical are returned unchanged.
 */
export function normalizeCodeStatus(status: number | string): string {
  if (typeof status === 'number') {
    return CODE_STATUS_MAP[status] ?? 'Unknown Status';
  }
  const asNum = Number(status);
  if (!Number.isNaN(asNum) && asNum.toString() === status) {
    return CODE_STATUS_MAP[asNum] ?? 'Unknown Status';
  }
  return status;
}

class CodeManager {
  async addRedeemedCode(
    code: string,
    discordId: string,
    status: number | string,
    lootDetail?: string,
    isPublic: boolean = false
  ): Promise<void> {
    const canonicalStatus = normalizeCodeStatus(status);
    db.insert(redeemedCodes)
      .values({
        code,
        discordId,
        status: canonicalStatus,
        lootDetail: lootDetail ? JSON.stringify(lootDetail) : null,
        isPublic: isPublic ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [redeemedCodes.code, redeemedCodes.discordId],
        set: { status: canonicalStatus, lootDetail: lootDetail ? JSON.stringify(lootDetail) : null },
      })
      .run();
    // If this redemption makes the code public, propagate to ALL rows for this code
    if (isPublic) {
      db.update(redeemedCodes).set({ isPublic: 1 }).where(eq(redeemedCodes.code, code)).run();
    }
  }

  async isCodeRedeemed(code: string): Promise<boolean> {
    const result = db
      .select({ code: redeemedCodes.code })
      .from(redeemedCodes)
      .where(and(eq(redeemedCodes.code, code), or(eq(redeemedCodes.status, 'Success'), eq(redeemedCodes.status, 'Code Expired'))))
      .get();
    return result !== undefined;
  }

  /**
   * Batch variant of isCodeRedeemedByUser. Returns a map of discordId → set of codes
   * that user has already redeemed (Success / Already Redeemed / Code Expired).
   * Chunks discordIds to stay within SQLite's SQLITE_LIMIT_VARIABLE_NUMBER (default 999).
   */
  async getRedeemedCodesByUsers(codes: string[], discordIds: string[]): Promise<Map<string, Set<string>>> {
    if (codes.length === 0 || discordIds.length === 0) return new Map();
    // Budget per query: codes.length (inArray) + 3 (status OR literals) + chunk size (discordIds inArray).
    const SQLITE_MAX_PARAMS = 999;
    const STATUS_PARAM_COUNT = 3;
    const MIN_DISCORD_ID_CHUNK_SIZE = 1;
    const maxCodesPerQuery = SQLITE_MAX_PARAMS - STATUS_PARAM_COUNT - MIN_DISCORD_ID_CHUNK_SIZE;
    if (codes.length > maxCodesPerQuery) {
      throw new Error(
        `Too many codes provided to getRedeemedCodesByUsers: ${codes.length}. ` +
          `This query supports at most ${maxCodesPerQuery} codes per call within SQLite's parameter limit of ${SQLITE_MAX_PARAMS}.`
      );
    }
    const chunkSize = SQLITE_MAX_PARAMS - codes.length - STATUS_PARAM_COUNT;
    const result = new Map<string, Set<string>>();
    for (let i = 0; i < discordIds.length; i += chunkSize) {
      const chunk = discordIds.slice(i, i + chunkSize);
      const rows = db
        .select({ code: redeemedCodes.code, discordId: redeemedCodes.discordId })
        .from(redeemedCodes)
        .where(
          and(
            inArray(redeemedCodes.code, codes),
            inArray(redeemedCodes.discordId, chunk),
            or(
              eq(redeemedCodes.status, 'Success'),
              eq(redeemedCodes.status, 'Already Redeemed'),
              eq(redeemedCodes.status, 'Code Expired')
            )
          )
        )
        .all();
      for (const row of rows) {
        if (!result.has(row.discordId)) result.set(row.discordId, new Set());
        result.get(row.discordId)!.add(row.code);
      }
    }
    return result;
  }

  async isCodeRedeemedByUser(code: string, discordId: string): Promise<boolean> {
    const result = db
      .select({ code: redeemedCodes.code })
      .from(redeemedCodes)
      .where(
        and(
          eq(redeemedCodes.code, code),
          eq(redeemedCodes.discordId, discordId),
          or(
            eq(redeemedCodes.status, 'Success'),
            eq(redeemedCodes.status, 'Already Redeemed'),
            eq(redeemedCodes.status, 'Code Expired')
          )
        )
      )
      .get();
    return result !== undefined;
  }

  async getRedeemedCodes(discordId: string): Promise<string[]> {
    const results = db
      .select({ code: redeemedCodes.code })
      .from(redeemedCodes)
      .where(eq(redeemedCodes.discordId, discordId))
      .orderBy(sql`${redeemedCodes.redeemedAt} DESC`)
      .limit(100)
      .all();
    return results.map((r) => r.code);
  }

  async getRedeemedCodeCount(discordId: string): Promise<number> {
    const result = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(redeemedCodes)
      .where(eq(redeemedCodes.discordId, discordId))
      .get();
    return result?.count ?? 0;
  }

  async getRedeemedCodeDetails(discordId: string, limit: number = 10, offset: number = 0): Promise<RedeemedCodeRow[]> {
    return db
      .select()
      .from(redeemedCodes)
      .where(eq(redeemedCodes.discordId, discordId))
      .orderBy(sql`${redeemedCodes.redeemedAt} DESC`)
      .limit(limit)
      .offset(offset)
      .all();
  }

  async getPublicUnexpiredCodes(): Promise<RedeemedCodeRow[]> {
    // Build a subquery: for each code, find the latest redeemedAt among public/success/unexpired rows
    const publicSuccessWhere = and(
      eq(redeemedCodes.isPublic, 1),
      eq(redeemedCodes.status, 'Success'),
      or(isNull(redeemedCodes.expiresAt), gt(redeemedCodes.expiresAt, sql`CURRENT_TIMESTAMP`))
    );
    const latest = db
      .select({ code: redeemedCodes.code, maxRedeemedAt: max(redeemedCodes.redeemedAt).as('max_redeemed_at') })
      .from(redeemedCodes)
      .where(publicSuccessWhere)
      .groupBy(redeemedCodes.code)
      .as('latest');
    // Join back to get the full row for the latest redeemedAt per code
    return db
      .select({
        id: redeemedCodes.id,
        code: redeemedCodes.code,
        discordId: redeemedCodes.discordId,
        redeemedAt: redeemedCodes.redeemedAt,
        status: redeemedCodes.status,
        lootDetail: redeemedCodes.lootDetail,
        isPublic: redeemedCodes.isPublic,
        expiresAt: redeemedCodes.expiresAt,
      })
      .from(redeemedCodes)
      .innerJoin(latest, and(eq(redeemedCodes.code, latest.code), eq(redeemedCodes.redeemedAt, latest.maxRedeemedAt)))
      .orderBy(sql`${redeemedCodes.redeemedAt} DESC`)
      .all();
  }

  async getSuccessfulRedeemCount(code: string): Promise<number> {
    const result = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(redeemedCodes)
      .where(and(eq(redeemedCodes.code, code), eq(redeemedCodes.status, 'Success')))
      .get();
    return result?.count ?? 0;
  }

  async isCodeSuccessfullyRedeemedByOther(code: string, discordId: string): Promise<boolean> {
    const result = db
      .select({ code: redeemedCodes.code })
      .from(redeemedCodes)
      .where(and(eq(redeemedCodes.code, code), ne(redeemedCodes.discordId, discordId), eq(redeemedCodes.status, 'Success')))
      .get();
    return result !== undefined;
  }

  async isCodePublic(code: string): Promise<boolean> {
    const result = db
      .select({ code: redeemedCodes.code })
      .from(redeemedCodes)
      .where(and(eq(redeemedCodes.code, code), eq(redeemedCodes.isPublic, 1)))
      .get();
    return result !== undefined;
  }

  async isCodeExpired(code: string): Promise<boolean> {
    const result = db
      .select({ code: redeemedCodes.code })
      .from(redeemedCodes)
      .where(and(eq(redeemedCodes.code, code), eq(redeemedCodes.status, 'Code Expired')))
      .get();
    return result !== undefined;
  }

  async getAllValidCodes(): Promise<string[]> {
    // Return distinct codes that have at least one 'Success' row and are not expired
    const results = db
      .selectDistinct({ code: redeemedCodes.code })
      .from(redeemedCodes)
      .where(
        and(
          eq(redeemedCodes.status, 'Success'),
          sql`${redeemedCodes.code} NOT IN (SELECT code FROM ${redeemedCodes} WHERE status = 'Code Expired')`
        )
      )
      .all();
    return results.map((r) => r.code);
  }

  async markCodeAsExpired(code: string): Promise<void> {
    db.update(redeemedCodes)
      .set({ status: 'Code Expired', expiresAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(redeemedCodes.code, code))
      .run();
  }

  async markCodeAsPublic(code: string): Promise<void> {
    db.update(redeemedCodes).set({ isPublic: 1 }).where(eq(redeemedCodes.code, code)).run();
  }

  async markCodeAsPrivate(code: string): Promise<void> {
    db.update(redeemedCodes).set({ isPublic: 0 }).where(eq(redeemedCodes.code, code)).run();
  }

  async addPendingCode(code: string, discordId?: string): Promise<boolean> {
    const rows = db.insert(pendingCodes).values({ code, discordId: discordId ?? null }).onConflictDoNothing().returning({ code: pendingCodes.code }).all();
    return rows.length > 0;
  }

  /**
   * Batch-insert multiple codes into pending_codes in a single query.
   * Returns only the codes that were newly inserted (already-present codes are skipped via onConflictDoNothing).
   */
  async addNewPendingCodes(codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const rows = db
      .insert(pendingCodes)
      .values(codes.map((code) => ({ code, discordId: null })))
      .onConflictDoNothing()
      .returning({ code: pendingCodes.code })
      .all();
    return rows.map((r) => r.code);
  }

  async getPendingCodes(discordId?: string): Promise<string[]> {
    const results = discordId
      ? db.select({ code: pendingCodes.code }).from(pendingCodes).where(eq(pendingCodes.discordId, discordId)).orderBy(sql`${pendingCodes.foundAt} ASC`).all()
      : db.select({ code: pendingCodes.code }).from(pendingCodes).orderBy(sql`${pendingCodes.foundAt} ASC`).all();
    return results.map((r) => r.code);
  }

  async removePendingCode(code: string): Promise<void> {
    db.delete(pendingCodes).where(eq(pendingCodes.code, code)).run();
  }

  async clearPendingCodes(discordId?: string): Promise<void> {
    if (discordId) {
      db.delete(pendingCodes).where(eq(pendingCodes.discordId, discordId)).run();
    } else {
      db.delete(pendingCodes).run();
    }
  }

  async deleteUserRedeemedCodes(discordId: string): Promise<number> {
    const before = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(redeemedCodes)
      .where(eq(redeemedCodes.discordId, discordId))
      .get();
    db.delete(redeemedCodes).where(eq(redeemedCodes.discordId, discordId)).run();
    return before?.count ?? 0;
  }
}

export const codeManager = new CodeManager();
