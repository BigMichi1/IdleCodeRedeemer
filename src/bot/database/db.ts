import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'idle.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class Database {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
      }
      console.log('Connected to SQLite database');
    });
    
    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
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
      ];

      let completed = 0;
      const total = createTableStatements.length;

      createTableStatements.forEach((sql) => {
        this.db.run(sql, (err) => {
          if (err && !err.message.includes('already exists')) {
            reject(err);
            return;
          }
          completed++;
          if (completed === total) {
            resolve();
          }
        });
      });
    });
  }

  run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const db = new Database();
