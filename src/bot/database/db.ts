import { Database as BunDatabase, Statement } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'idle.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class Database {
  private db: BunDatabase;
  private statementCache: Map<string, Statement> = new Map();

  constructor() {
    try {
      this.db = new BunDatabase(DB_PATH);
      logger.debug('Connected to SQLite database');

      // Enable foreign keys
      this.db.exec('PRAGMA foreign_keys = ON');
    } catch (err: any) {
      const errorMessage = `Failed to initialize SQLite database at ${DB_PATH}: ${err?.message || String(err)}`;
      logger.error(errorMessage);
      process.exit(1);
    }
  }

  private getStatement(sql: string): Statement {
    if (!this.statementCache.has(sql)) {
      this.statementCache.set(sql, this.db.prepare(sql));
    }
    return this.statementCache.get(sql)!;
  }

  async initialize(): Promise<void> {
    const createTableStatements = [
      // Users table - stores Discord user credentials
      `CREATE TABLE IF NOT EXISTS users (
        discord_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_hash TEXT NOT NULL,
        server TEXT,
        instance_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      // Redeemed codes table - tracks which codes have been redeemed
      `CREATE TABLE IF NOT EXISTS redeemed_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        discord_id TEXT,
        redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT,
        loot_detail TEXT,
        is_public INTEGER DEFAULT 0,
        expires_at DATETIME,
        FOREIGN KEY (discord_id) REFERENCES users(discord_id)
      )`,
      // Pending codes table - codes waiting to be redeemed
      `CREATE TABLE IF NOT EXISTS pending_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        discord_id TEXT,
        found_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (discord_id) REFERENCES users(discord_id)
      )`,
      // Audit log table - tracks all operations
      `CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (discord_id) REFERENCES users(discord_id)
      )`,
      // Backfill operations table - tracks backfill runs to prevent duplicates
      `CREATE TABLE IF NOT EXISTS backfill_operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        initiated_by TEXT NOT NULL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        codes_found INTEGER DEFAULT 0,
        codes_redeemed INTEGER DEFAULT 0,
        status TEXT DEFAULT 'in_progress'
      )`,
    ];

    for (const sql of createTableStatements) {
      try {
        this.db.exec(sql);
      } catch (err: any) {
        if (!err.message?.includes('already exists')) {
          throw err;
        }
        // Ignore if table already exists
      }
    }

    // Run migrations for existing databases
    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    // Add is_public column if it doesn't exist
    try {
      this.db.exec('ALTER TABLE redeemed_codes ADD COLUMN is_public INTEGER DEFAULT 0');
    } catch {
      // Ignore if column already exists
    }

    // Add expires_at column if it doesn't exist
    try {
      this.db.exec('ALTER TABLE redeemed_codes ADD COLUMN expires_at DATETIME');
    } catch {
      // Ignore if column already exists
    }

    // Migration: Remove foreign key constraint from backfill_operations.initiated_by
    // The bot initiates backfills, not user records, so the FK constraint is unnecessary
    try {
      const tableExists = this.db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='backfill_operations'")
        .get();

      if (tableExists) {
        const foreignKeys = this.db
          .prepare('PRAGMA foreign_key_list(backfill_operations)')
          .all() as any[];
        const hasInitiatedByFK = foreignKeys.some((fk) => fk.from === 'initiated_by');

        if (hasInitiatedByFK) {
          // Recreate the table without the FK constraint
          this.db.exec(`
            CREATE TABLE backfill_operations_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              initiated_by TEXT NOT NULL,
              started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              completed_at DATETIME,
              codes_found INTEGER DEFAULT 0,
              codes_redeemed INTEGER DEFAULT 0,
              status TEXT DEFAULT 'in_progress'
            );
            INSERT INTO backfill_operations_new SELECT * FROM backfill_operations;
            DROP TABLE backfill_operations;
            ALTER TABLE backfill_operations_new RENAME TO backfill_operations;
          `);
        }
      }
    } catch (err: any) {
      // Log migration error but don't fail startup
      logger.debug('Backfill operations FK migration result:', err.message);
    }
  }

  private reconnect(): void {
    try {
      this.statementCache.clear();
      try { this.db.close(); } catch { /* ignore close errors */ }
      this.db = new BunDatabase(DB_PATH);
      this.db.exec('PRAGMA foreign_keys = ON');
      logger.info('Reconnected to SQLite database');
    } catch (err: any) {
      logger.error(`Failed to reconnect to SQLite database: ${err?.message || String(err)}`);
      process.exit(1);
    }
  }

  async run(sql: string, params: any[] = []): Promise<void> {
    try {
      const stmt = this.getStatement(sql);
      stmt.run(...params);
    } catch (err: any) {
      if (err?.code === 'SQLITE_READONLY_DBMOVED') {
        logger.warn('Database file moved, reconnecting...');
        this.reconnect();
        const stmt = this.getStatement(sql);
        stmt.run(...params);
      } else {
        throw err;
      }
    }
  }

  async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    try {
      const stmt = this.getStatement(sql);
      const result = stmt.get(...params) as T | null;
      return result ?? undefined;
    } catch (err: any) {
      if (err?.code === 'SQLITE_READONLY_DBMOVED') {
        logger.warn('Database file moved, reconnecting...');
        this.reconnect();
        const stmt = this.getStatement(sql);
        const result = stmt.get(...params) as T | null;
        return result ?? undefined;
      }
      throw err;
    }
  }

  async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const stmt = this.getStatement(sql);
      return stmt.all(...params) as T[];
    } catch (err: any) {
      if (err?.code === 'SQLITE_READONLY_DBMOVED') {
        logger.warn('Database file moved, reconnecting...');
        this.reconnect();
        const stmt = this.getStatement(sql);
        return stmt.all(...params) as T[];
      }
      throw err;
    }
  }

  async close(): Promise<void> {
    try {
      // Clear statement cache
      this.statementCache.clear();
      this.db.close();
    } catch (err) {
      logger.error('Error closing database:', err);
    }
  }
}

export const db = new Database();
