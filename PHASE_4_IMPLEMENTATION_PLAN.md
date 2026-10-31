# BYTE — Phase 4 Implementation Plan
## Complete Backend, Database, API and Data Management Implementation

### 1. Existing Application Architecture Inspection
- **Runtime Environment**: Node.js 22 (linux-x64), Vite 5.4.10, React 18.3.1 (TypeScript), Express 4.21.1 fullstack server (`server.ts`).
- **Styling & Design**: Tailwind CSS 3.4.14 with strict BYTE 5-color palette (Neon Blue `#2A00FF`, Yellow `#F9E900`, Signal Red `#DD1C1A`, Jet Black `#000000`, Pure White `#FFFFFF`).
- **Frontend State Management**: Zustand (`useCart`), TanStack React Query (`useQuery`, `useQueryClient`), React Router 6 (`react-router-dom`).
- **Existing Routes**:
  - `/` (Home dashboard, signature carousel, value pillars, DJSCE status)
  - `/login` (Campus Sign-in with role presets)
  - `/menu` (Food discovery catalogue with outlet and diet filtering)
  - `/cart` (Tray checkout with pickup slot & payment method)
  - `/tables` (Interactive floor plan with 15/20-min express reservation holds)
  - `/orders` (Live preparation tracker & thermal receipt archive)
  - `/rewards` (BYTE Points & loyalty promotions)
  - `/status` (Campus canteens crowd & wait-time overview)
  - `/profile` (Student dossier & campus credentials)
  - `/vendor` (Kitchen operations queue terminal)
  - `/admin` (Administrator operations)
- **API Client**: Axios instance in `src/services/api.ts` with base URL `/api/v1`.
- **Existing Blocker Identified**: In-memory state in single monolithic `server.ts` without relational persistence, lacking transactional concurrency guarantees, missing standard data response envelope, and vulnerable to `TypeError: allFoods.filter is not a function` when responses deviate.

---

### 2. Planned Backend Architecture

#### 2.1 Relational Database Engine
- **Engine**: SQLite (via `better-sqlite3`) for the active Node.js server container with persistent disk storage (`data/byte_campus.db`), configured with:
  - Write-Ahead Logging (`PRAGMA journal_mode = WAL`)
  - Enforced Foreign Key Constraints (`PRAGMA foreign_keys = ON`)
  - Explicit Transactions (`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`)
  - Complete indexes on foreign keys and search columns
- **Compatibility**: 100% schema and type compatible with PostgreSQL (ANSI SQL DDL, UUID/text tokens, ISO timestamps, decimal numeric prices).
- **Independent Deployable Service**: A complete Python FastAPI + SQLAlchemy 2.0 + Pydantic + Alembic backend package in `backend/` for external cloud PostgreSQL deployment.

#### 2.2 Modular Directory Structure
```
server/
  db/
    database.ts        # Database connection, PRAGMA config, transaction helper
    schema.sql         # Relational DDL (13 tables, foreign keys, indexes)
    seed.ts            # DJSCE campus seed data & hashed credentials
    migrations.ts      # Schema migration runner
  middleware/
    auth.ts            # Cookie & Bearer JWT session auth, RBAC guards
    errorHandler.ts    # Central JSON error handler (no HTML errors)
    contract.ts        # Enforces { success, data, message } response envelope
  routers/
    authRouter.ts      # Login, logout, session me, password reset
    campusRouter.ts    # Campus management
    outletRouter.ts    # Outlets CRUD, staff assignment, status
    categoryRouter.ts  # Menu categories CRUD, display ordering
    menuRouter.ts      # Menu items CRUD, availability, pricing, dietary tags
    cartRouter.ts      # Server-side cart validation & single-outlet rules
    orderRouter.ts     # Transactional checkout, status machine, pickup verification
    paymentRouter.ts   # Sandbox UPI & counter payment records
    reservationRouter.ts # Concurrency-protected table reservation engine
    reviewRouter.ts    # Order-verified student reviews
    mediaRouter.ts     # Media metadata and asset registry
    adminRouter.ts     # User management, analytics, CSV import engine
    vendorRouter.ts    # Kitchen queue dispatch, item toggling
  services/
    csvService.ts      # RFC 4180 CSV parser, header validation, dry-run preview
    orderService.ts    # Price snapshotting, stock validation, idempotency
    reservationService.ts # Overlap conflict prevention & expiry checks
```

#### 2.3 Strict API Response Contract
All endpoints return:
```json
{
  "success": true,
  "data": [...],
  "message": null
}
```
Or for errors:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Human-readable explanation",
    "details": {}
  }
}
```
Dual-route mounting (`/api/v1/*` and `/api/*`) guarantees seamless backward compatibility for existing frontend calls while supporting the new REST endpoints.

#### 2.4 Frontend Safety & Defensive Layer
- Central normalizer in `src/services/api.ts` extracts `.data` defensively.
- All collection states initialised as `[]` (never `undefined`).
- Safe helper functions (`safeArray`, `safeString`) guarantee `.filter()`, `.map()`, `.find()` never crash.
- React Error Boundary at root and route levels.

---

### 3. Implementation Checkpoints Sequence
1. **CHECKPOINT 1**: Repository inspection, backend foundation, directory setup.
2. **CHECKPOINT 2**: Database models, DDL schema, migrations, seed data.
3. **CHECKPOINT 3**: Authentication, password hashing (bcryptjs), RBAC middleware.
4. **CHECKPOINT 4**: Outlet and menu APIs with category ordering and filtering.
5. **CHECKPOINT 5**: Frontend API normalisation, array safety, error boundaries.
6. **CHECKPOINT 6**: Cart and transactional order management with pickup tokens.
7. **CHECKPOINT 7**: Table reservation engine with concurrency and conflict checks.
8. **CHECKPOINT 8**: Admin and vendor CRUD management panels.
9. **CHECKPOINT 9**: CSV import engine with validation and preview.
10. **CHECKPOINT 10**: Integration test suite, Python backend package, and documentation.
