import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { backfillOperations, type BackfillOperation } from './schema/index';

class BackfillManager {
  // Global backfill lock to prevent concurrent operations
  private backfillInProgress = false;

  isBackfillInProgress(): boolean {
    return this.backfillInProgress;
  }

  async startBackfill(discordId: string): Promise<number> {
    if (this.backfillInProgress) {
      throw new Error(
        'A backfill operation is already in progress. Please wait for it to complete.'
      );
    }

    this.backfillInProgress = true;

    try {
      const result = db
        .insert(backfillOperations)
        .values({ initiatedBy: discordId, status: 'in_progress' })
        .returning({ id: backfillOperations.id })
        .get();

      return result?.id ?? 0;
    } catch (err) {
      this.backfillInProgress = false;
      throw err;
    }
  }

  async canUserInitiateBackfill(discordId: string): Promise<boolean> {
    const lastBackfill = db
      .select({ completedAt: backfillOperations.completedAt, startedAt: backfillOperations.startedAt })
      .from(backfillOperations)
      .where(and(eq(backfillOperations.initiatedBy, discordId), eq(backfillOperations.status, 'completed')))
      .orderBy(sql`${backfillOperations.completedAt} DESC`)
      .limit(1)
      .get();

    if (!lastBackfill) return true;

    const timestamp = lastBackfill.completedAt ?? lastBackfill.startedAt;
    if (!timestamp) return true;

    const lastTime = new Date(timestamp).getTime();
    if (isNaN(lastTime)) return true;

    const now = Date.now();
    return now - lastTime >= 60 * 60 * 1000;
  }

  async getLastBackfill(): Promise<BackfillOperation | undefined> {
    return db
      .select()
      .from(backfillOperations)
      .where(eq(backfillOperations.status, 'completed'))
      .orderBy(sql`${backfillOperations.completedAt} DESC`)
      .limit(1)
      .get() as BackfillOperation | undefined;
  }

  async shouldRunStartupBackfill(): Promise<boolean> {
    const lastBackfill = await this.getLastBackfill();
    if (!lastBackfill) return true;

    const timestamp = lastBackfill.completedAt ?? lastBackfill.startedAt;
    if (!timestamp) return true;
    const lastTime = new Date(timestamp).getTime();
    if (isNaN(lastTime)) return true;
    return Date.now() - lastTime >= 6 * 60 * 60 * 1000;
  }

  async updateBackfill(
    operationId: number,
    codesFound: number,
    codesRedeemed: number,
    status: 'completed' | 'failed'
  ): Promise<void> {
    try {
      db.update(backfillOperations)
        .set({ codesFound, codesRedeemed, status, completedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(backfillOperations.id, operationId))
        .run();
    } finally {
      this.backfillInProgress = false;
    }
  }

  async getBackfillById(operationId: number): Promise<BackfillOperation | undefined> {
    return db
      .select()
      .from(backfillOperations)
      .where(eq(backfillOperations.id, operationId))
      .get() as BackfillOperation | undefined;
  }

  async hasUserBackfillOperations(discordId: string): Promise<boolean> {
    const row = db
      .select({ id: backfillOperations.id })
      .from(backfillOperations)
      .where(eq(backfillOperations.initiatedBy, discordId))
      .limit(1)
      .get();
    return row !== undefined;
  }

  async deleteUserBackfillOperations(discordId: string): Promise<number> {
    const rows = db
      .select({ id: backfillOperations.id })
      .from(backfillOperations)
      .where(eq(backfillOperations.initiatedBy, discordId))
      .all();
    const total = rows.length;
    if (total > 0) {
      db.delete(backfillOperations)
        .where(eq(backfillOperations.initiatedBy, discordId))
        .run();
    }
    return total;
  }
}

export const backfillManager = new BackfillManager();
