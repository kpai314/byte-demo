# BYTE — Database Setup Guide
## Relational Database Configuration & Migration Manual

### Overview
BYTE utilizes a dual-compatible ANSI SQL relational architecture:
1. **Active Container Runtime**: SQLite in Write-Ahead Logging (`WAL`) mode via `better-sqlite3`. Database files are stored under `data/byte_campus.db`.
2. **Cloud Production Deployment**: PostgreSQL 15+ supported via SQLAlchemy 2.0 and standard connection string (`DATABASE_URL=postgresql://user:pass@host:5432/byte_db`).

---

### 1. Active Container Environment Setup

#### Prerequisites
- Node.js 22 LTS
- `better-sqlite3` and `bcryptjs` (installed in `package.json`)

#### Initializing Database Schema
The database tables are automatically verified and created on server startup via `initializeDatabase()` in `server/db/database.ts`:
```typescript
import { initializeDatabase } from './server/db/database';
initializeDatabase();
```
To run manually via shell:
```bash
npx tsx -e "import { initializeDatabase } from './server/db/database'; initializeDatabase();"
```

#### Seeding Initial DJSCE Campus Data
Initial data (campuses, staff, students, canteens, menu items, floor plan tables) is seeded via `seedDatabase()` in `server/db/seed.ts`:
```bash
npx tsx -e "import { seedDatabase } from './server/db/seed'; seedDatabase();"
```

---

### 2. PRAGMA Settings for SQLite Relational Integrity
To ensure production-grade ACID compliance, the following PRAGMAs are executed on connection:
```sql
PRAGMA journal_mode = WAL;        -- High-throughput concurrent reads and writes
PRAGMA foreign_keys = ON;         -- Enforces foreign key constraints and cascading deletes
PRAGMA synchronous = NORMAL;      -- Optimal balance of durability and write speed
```

---

### 3. Migrating to Cloud PostgreSQL

When deploying BYTE to Google Cloud SQL (PostgreSQL):
1. Provision Cloud SQL PostgreSQL from the Google Cloud Console or AI Studio integrations menu.
2. Set the `DATABASE_URL` environment variable:
   ```bash
   DATABASE_URL=postgresql://byte_admin:StrongPassword@/cloudsql/PROJECT_ID:REGION:INSTANCE/byte_campus_db
   ```
3. Run DDL migration script:
   The SQL schema in `server/db/schema.sql` uses ANSI SQL types that map directly to PostgreSQL:
   - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
   - `TEXT` → `VARCHAR` / `TEXT`
   - `datetime('now')` → `CURRENT_TIMESTAMP`
   - `REAL` → `NUMERIC(10, 2)`

4. Execute via `psql`:
   ```bash
   psql $DATABASE_URL -f server/db/schema.sql
   ```

---

### 4. Database Reset Procedure (Development Only)
If a fresh state is required:
```bash
rm -f data/byte_campus.db*
npx tsx -e "import { initializeDatabase } from './server/db/database'; import { seedDatabase } from './server/db/seed'; initializeDatabase(); seedDatabase();"
```
Default accounts populated:
- **Admin**: `admin@example.com` / `ByteAdmin123!`
- **Vendor**: `vendor@example.com` / `ByteVendor123!`
- **Student**: `student@example.com` / `ByteStudent123!`
