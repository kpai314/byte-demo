import { initializeDatabase } from './database';
import { seedDatabase } from './seed';

console.log('[BYTE CLI] Running database migrations and idempotent seed...');
initializeDatabase();
seedDatabase();
console.log('[BYTE CLI] Seed completed successfully.');
