import { Database as BunDatabase } from 'bun:sqlite';
import { drizzle, BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';
import * as schema from './schema/index';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'idle.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let sqlite: BunDatabase;
let _db: BunSQLiteDatabase<typeof schema>;

function createConnection(): { sqlite: BunDatabase; db: BunSQLiteDatabase<typeof schema> } {
  const sqlite = new BunDatabase(DB_PATH);
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec('PRAGMA journal_mode = WAL');
  const db = drizzle(sqlite, { schema, casing: 'snake_case' });
  return { sqlite, db };
}

try {
  ({ sqlite, db: _db } = createConnection());
  logger.debug('Connected to SQLite database');
} catch (err: any) {
  logger.error(`Failed to initialize SQLite database at ${DB_PATH}: ${err?.message || String(err)}`);
  process.exit(1);
}

export const db = _db;
export { sqlite };

export function initializeDatabase(): void {
  const migrationsFolder =
    process.env.MIGRATIONS_PATH ??
    path.join(path.dirname(process.execPath), 'migrations');
  migrate(db, { migrationsFolder });
  logger.info('Database migrations applied');
}

export async function closeDatabase(): Promise<void> {
  try {
    sqlite.close();
  } catch (err) {
    logger.error('Error closing database:', err);
  }
}
