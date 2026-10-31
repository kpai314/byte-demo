import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../../data/byte_campus.db');

console.log('[BYTE CLI] Explicit development-only database reset requested...');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
  if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
  console.log('[BYTE CLI] Existing database file cleared.');
}

const { initializeDatabase } = await import('./database');
const { seedDatabase } = await import('./seed');

initializeDatabase();
seedDatabase();
console.log('[BYTE CLI] Database reinitialized and freshly seeded.');
