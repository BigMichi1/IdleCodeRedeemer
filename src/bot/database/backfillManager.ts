import { db } from './db';

interface BackfillOperation {
  id: number;
  initiated_by: string;
  started_at: string;
  completed_at: string | null;
  codes_found: number;
  codes_redeemed: number;
  status: 'in_progress' | 'completed' | 'failed';
}

class BackfillManager {
  // Global backfill lock to prevent concurrent operations
  private backfillInProgress = false;

  /**
   * Check if a backfill is currently in progress
   */
  isBackfillInProgress(): boolean {
    return this.backfillInProgress;
  }

  /**
   * Start a new backfill operation
   */
  async startBackfill(discordId: string): Promise<number> {
    if (this.backfillInProgress) {
      throw new Error(
        'A backfill operation is already in progress. Please wait for it to complete.'
      );
    }

    this.backfillInProgress = true;

    const result = await db.get<{ id: number }>(
      `INSERT INTO backfill_operations (initiated_by, status)
       VALUES (?, 'in_progress')
       RETURNING id`,
      [discordId]
    );

    return result?.id || 0;
  }

  /**
   * Check if user can initiate a new backfill (rate limiting)
   * Returns true if user hasn't initiated a backfill in the last 1 hour
   */
  async canUserInitiateBackfill(discordId: string): Promise<boolean> {
    const lastBackfill = await db.get<{ started_at: string }>(
      `SELECT started_at FROM backfill_operations
       WHERE initiated_by = ? AND status = 'completed'
       ORDER BY completed_at DESC
       LIMIT 1`,
      [discordId]
    );

    if (!lastBackfill) {
      return true; // User has never done a backfill
    }

    const lastTime = new Date(lastBackfill.started_at).getTime();
    const now = new Date().getTime();
    const oneHourMs = 60 * 60 * 1000;

    return now - lastTime >= oneHourMs;
  }

  /**
   * Get the last backfill operation
   */
  async getLastBackfill(): Promise<BackfillOperation | undefined> {
    return db.get<BackfillOperation>(
      `SELECT * FROM backfill_operations
       WHERE status = 'completed'
       ORDER BY completed_at DESC
       LIMIT 1`
    );
  }

  /**
   * Check if backfill should run on startup (hasn't run in last 6 hours)
   */
  async shouldRunStartupBackfill(): Promise<boolean> {
    const lastBackfill = await this.getLastBackfill();

    if (!lastBackfill) {
      return true; // Never run before
    }

    const lastTime = new Date(lastBackfill.completed_at || lastBackfill.started_at).getTime();
    const now = new Date().getTime();
    const sixHoursMs = 6 * 60 * 60 * 1000;

    return now - lastTime >= sixHoursMs;
  }

  /**
   * Update backfill operation status
   */
  async updateBackfill(
    operationId: number,
    codesFound: number,
    codesRedeemed: number,
    status: 'completed' | 'failed'
  ): Promise<void> {
    await db.run(
      `UPDATE backfill_operations
       SET codes_found = ?, codes_redeemed = ?, status = ?, completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [codesFound, codesRedeemed, status, operationId]
    );

    this.backfillInProgress = false;
  }

  /**
   * Get backfill operation by ID
   */
  async getBackfillById(operationId: number): Promise<BackfillOperation | undefined> {
    return db.get<BackfillOperation>('SELECT * FROM backfill_operations WHERE id = ?', [
      operationId,
    ]);
  }
}

export const backfillManager = new BackfillManager();
