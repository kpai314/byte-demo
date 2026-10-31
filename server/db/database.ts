import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrations';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure persistent data directory exists
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'byte_campus.db');

export const db = new Database(dbPath);

// Enforce foreign keys and High-Performance Write-Ahead Logging
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

/**
 * Execute schema DDL scripts safely and apply migrations
 */
export function initializeDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);
  runMigrations();
}

/**
 * Run a transaction safely with rollback on failure
 */
export function runTransaction<T>(fn: () => T): T {
  const transaction = db.transaction(fn);
  return transaction();
}

export default db;
