import { eq, ne, and, or, isNull, gt, inArray, notInArray, sql } from 'drizzle-orm';
import { db } from './db';
import { redeemedCodes, pendingCodes, lootTotals } from './schema/index';

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
 * Converts a raw codeStatus value (number, numeric string, or canonical string)
 * to the canonical status string stored in the database.
 */
export function normalizeCodeStatus(status: number | string): string {
  if (typeof status === 'number') {
    return CODE_STATUS_MAP[status] ?? 'Unknown Status';
  }
  if (/^\d+$/.test(status)) {
    return CODE_STATUS_MAP[Number(status)] ?? 'Unknown Status';
  }
  return status;
}

export const CHEST_TYPE_NAMES: Record<number, string> = {
  1: 'Silver Chest',
  2: 'Gold Chest',
  230: 'Modron Chest',
  282: 'Electrum Chest',
};

export type LootSummary = { chests: Record<string, number>; items: Record<string, number> };

function parseLootEntries(
  lootStr: string | null
): Array<{ key: string; type: 'chest' | 'item'; count: number }> {
  if (!lootStr) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(lootStr);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const entries: Array<{ key: string; type: 'chest' | 'item'; count: number }> = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const count = typeof e['count'] === 'number' ? e['count'] : undefined;
    if (count === undefined || !Number.isFinite(count) || count <= 0) continue;
    if ('chest_type_id' in e && typeof e['chest_type_id'] === 'number') {
      const name = CHEST_TYPE_NAMES[e['chest_type_id'] as number] ?? `Chest ${e['chest_type_id']}`;
      entries.push({ key: name, type: 'chest', count });
    } else if ('loot_item' in e && typeof e['loot_item'] === 'string') {
      const name = (e['loot_item'] as string).replace(/_/g, ' ').toLowerCase();
      entries.push({ key: name, type: 'item', count });
    }
  }
  return entries;
}

class CodeManager {
  async addRedeemedCode(
    code: string,
    discordId: string,
    status: string | number,
    lootDetail?: unknown,
    isPublic: boolean = false
  ): Promise<void> {
    const normalizedStatus = normalizeCodeStatus(status);
    const lootStr = lootDetail == null ? null : JSON.stringify(lootDetail);
    db.insert(redeemedCodes)
      .values({
        code,
        discordId,
        status: normalizedStatus,
        lootDetail: lootStr,
        isPublic: isPublic ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [redeemedCodes.code, redeemedCodes.discordId],
        set: { status: normalizedStatus, lootDetail: lootStr, isPublic: isPublic ? 1 : 0 },
      })
      .run();
    // When a redemption is marked public, propagate to every row for this code
    // so all users see it as public regardless of who originally redeemed it.
    if (isPublic) {
      db.update(redeemedCodes).set({ isPublic: 1 }).where(eq(redeemedCodes.code, code)).run();
    }
    // Maintain loot_totals for Success redemptions
    if (normalizedStatus === 'Success' && lootStr) {
      const entries = parseLootEntries(lootStr);
      for (const { key, type, count } of entries) {
        for (const scope of [discordId, '__server__']) {
          db.insert(lootTotals)
            .values({ lootKey: key, lootType: type, scope, totalCount: count })
            .onConflictDoUpdate({
              target: [lootTotals.lootKey, lootTotals.scope],
              set: { totalCount: sql`${lootTotals.totalCount} + ${count}` },
            })
            .run();
        }
      }
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

  async isCodeRedeemedByUser(code: string, discordId: string): Promise<boolean> {
    const qualifyingStatuses = ['Success', 'Already Redeemed', 'Code Expired'] as const;
    const result = db
      .select({ code: redeemedCodes.code })
      .from(redeemedCodes)
      .where(
        and(
          eq(redeemedCodes.code, code),
          eq(redeemedCodes.discordId, discordId),
          inArray(redeemedCodes.status, qualifyingStatuses as unknown as string[])
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

  async getRedeemedCodeDetails(
    discordId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<RedeemedCodeRow[]> {
    return db
      .select()
      .from(redeemedCodes)
      .where(eq(redeemedCodes.discordId, discordId))
      .orderBy(sql`${redeemedCodes.redeemedAt} DESC`)
      .limit(limit)
      .offset(offset)
      .all();
  }

  async getRedeemedCodeCount(discordId: string): Promise<number> {
    const result = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(redeemedCodes)
      .where(eq(redeemedCodes.discordId, discordId))
      .get();
    return result?.count ?? 0;
  }

  async getPublicUnexpiredCodes(): Promise<RedeemedCodeRow[]> {
    const rows = db
      .select()
      .from(redeemedCodes)
      .where(
        and(
          eq(redeemedCodes.isPublic, 1),
          eq(redeemedCodes.status, 'Success'),
          or(isNull(redeemedCodes.expiresAt), gt(redeemedCodes.expiresAt, sql`CURRENT_TIMESTAMP`))
        )
      )
      .orderBy(sql`${redeemedCodes.redeemedAt} DESC`)
      .all();
    // Return one row per distinct code (latest first).
    const seen = new Set<string>();
    return rows.filter((r) => {
      if (seen.has(r.code)) return false;
      seen.add(r.code);
      return true;
    });
  }

  async getAllValidCodes(): Promise<string[]> {
    const expiredSubquery = db
      .select({ code: redeemedCodes.code })
      .from(redeemedCodes)
      .where(eq(redeemedCodes.status, 'Code Expired'));
    const rows = db
      .selectDistinct({ code: redeemedCodes.code })
      .from(redeemedCodes)
      .where(
        and(
          eq(redeemedCodes.status, 'Success'),
          notInArray(redeemedCodes.code, expiredSubquery)
        )
      )
      .all();
    return rows.map((r) => r.code);
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

  async addPendingCode(code: string, discordId?: string): Promise<void> {
    db.insert(pendingCodes)
      .values({ code, discordId: discordId ?? null })
      .onConflictDoNothing()
      .run();
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

  /**
   * Bulk-insert pending codes, skipping any that are already present.
   * Returns only the codes that were newly inserted.
   * Uses a single INSERT … ON CONFLICT DO NOTHING RETURNING to avoid N+1
   * queries and race conditions between pre-read and insert.
   */
  async addNewPendingCodes(codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    // pendingCodes has 2 columns (code, discordId) → 2 bound params per row.
    const CHUNK_SIZE = Math.floor(999 / 2); // = 499
    const result: string[] = [];
    for (let i = 0; i < codes.length; i += CHUNK_SIZE) {
      const chunk = codes.slice(i, i + CHUNK_SIZE);
      const inserted = db
        .insert(pendingCodes)
        .values(chunk.map((code) => ({ code, discordId: null })))
        .onConflictDoNothing()
        .returning({ code: pendingCodes.code })
        .all();
      result.push(...inserted.map((r) => r.code));
    }
    return result;
  }

  /**
   * Returns the subset of `codes` that already have at least one
   * Success or Code Expired row in redeemed_codes (i.e. globally redeemed).
   * Uses a single IN query — suitable for bulk pre-filter before addNewPendingCodes.
   */
  async getRedeemedCodesFromList(codes: string[]): Promise<Set<string>> {
    if (codes.length === 0) return new Set();
    // WHERE has codes.length + 2 params (IN list + 2 status literals).
    const CHUNK_SIZE = 999 - 2; // = 997
    const result = new Set<string>();
    for (let i = 0; i < codes.length; i += CHUNK_SIZE) {
      const chunk = codes.slice(i, i + CHUNK_SIZE);
      const rows = db
        .select({ code: redeemedCodes.code })
        .from(redeemedCodes)
        .where(
          and(
            inArray(redeemedCodes.code, chunk),
            or(eq(redeemedCodes.status, 'Success'), eq(redeemedCodes.status, 'Code Expired'))
          )
        )
        .all();
      for (const row of rows) result.add(row.code);
    }
    return result;
  }

  async deleteUserRedeemedCodes(discordId: string): Promise<number> {
    const countRow = db
      .select({ count: sql<number>`count(*)` })
      .from(redeemedCodes)
      .where(eq(redeemedCodes.discordId, discordId))
      .get();
    db.delete(redeemedCodes).where(eq(redeemedCodes.discordId, discordId)).run();
    return countRow?.count ?? 0;
  }

  /**
   * For a given set of codes and Discord user IDs, returns a map of
   * discordId → Set<code> containing codes that user has any qualifying
   * redemption record for (Success, Already Redeemed, Code Expired).
   *
   * Throws if codes.length would exceed the safe SQLite parameter budget.
   * Chunks discordIds automatically to stay within the 999-variable limit.
   */
  async getRedeemedCodesByUsers(
    codes: string[],
    discordIds: string[]
  ): Promise<Map<string, Set<string>>> {
    if (codes.length === 0 || discordIds.length === 0) return new Map();

    const SQLITE_PARAM_LIMIT = 999;
    const STATUS_COUNT = 3; // 'Success', 'Already Redeemed', 'Code Expired'
    // codes + status params are fixed per query; remaining budget is for discordIds
    const discordIdChunkSize = SQLITE_PARAM_LIMIT - codes.length - STATUS_COUNT;
    if (discordIdChunkSize <= 0) {
      throw new Error('Too many codes provided to getRedeemedCodesByUsers');
    }

    const result = new Map<string, Set<string>>();
    const qualifyingStatuses = ['Success', 'Already Redeemed', 'Code Expired'] as const;
    for (let i = 0; i < discordIds.length; i += discordIdChunkSize) {
      const chunk = discordIds.slice(i, i + discordIdChunkSize);
      const rows = db
        .select({ code: redeemedCodes.code, discordId: redeemedCodes.discordId })
        .from(redeemedCodes)
        .where(
          and(
            inArray(redeemedCodes.code, codes),
            inArray(redeemedCodes.discordId, chunk),
            inArray(redeemedCodes.status, qualifyingStatuses as unknown as string[])
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

  async getServerCodeStats(): Promise<{ totalCodes: number; totalRedemptions: number }> {
    const row = db
      .select({
        totalCodes: sql<number>`COUNT(DISTINCT ${redeemedCodes.code})`,
        totalRedemptions: sql<number>`COUNT(*)`,
      })
      .from(redeemedCodes)
      .where(eq(redeemedCodes.status, 'Success'))
      .get();
    return { totalCodes: row?.totalCodes ?? 0, totalRedemptions: row?.totalRedemptions ?? 0 };
  }

  async getAggregateLoot(
    discordId?: string
  ): Promise<{ chests: Record<string, number>; items: Record<string, number> }> {
    const scope = discordId ?? '__server__';
    const rows = db
      .select({
        lootKey: lootTotals.lootKey,
        lootType: lootTotals.lootType,
        totalCount: lootTotals.totalCount,
      })
      .from(lootTotals)
      .where(eq(lootTotals.scope, scope))
      .all();

    const chests: Record<string, number> = {};
    const items: Record<string, number> = {};
    for (const row of rows) {
      if (row.lootType === 'chest') chests[row.lootKey] = row.totalCount;
      else if (row.lootType === 'item') items[row.lootKey] = row.totalCount;
    }
    return { chests, items };
  }

  /**
   * One-time migration: populate loot_totals from existing redeemed_codes rows.
   * Exits early (no-op) if loot_totals already contains data.
   */
  async backfillLootTotals(): Promise<void> {
    const existing = db.select({ lootKey: lootTotals.lootKey }).from(lootTotals).limit(1).get();
    if (existing) return; // already seeded

    const rows = db
      .select({ discordId: redeemedCodes.discordId, lootDetail: redeemedCodes.lootDetail })
      .from(redeemedCodes)
      .where(eq(redeemedCodes.status, 'Success'))
      .all();

    for (const row of rows) {
      const entries = parseLootEntries(row.lootDetail);
      for (const { key, type, count } of entries) {
        for (const scope of [row.discordId, '__server__']) {
          db.insert(lootTotals)
            .values({ lootKey: key, lootType: type, scope, totalCount: count })
            .onConflictDoUpdate({
              target: [lootTotals.lootKey, lootTotals.scope],
              set: { totalCount: sql`${lootTotals.totalCount} + ${count}` },
            })
            .run();
        }
      }
    }
  }
}

export const codeManager = new CodeManager();
