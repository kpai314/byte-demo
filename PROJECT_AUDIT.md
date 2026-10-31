# BYTE — Project Audit (diagnosis phase)

**Scope and honesty statement.** This audit was produced by static inspection of the ZIP plus direct
queries of the shipped SQLite file. The audit environment had **no network access**, so
`npm install` failed (`express`, `tsx`, `vite`, `better-sqlite3` installed as empty folders). Therefore
**the backend and frontend were NOT started, no browser was opened, and no tests were executed.**
Everything marked VERIFIED below was observed directly; everything else is a code-reading finding.

## 1. Which backend is real? (VERIFIED)

| Question | Answer |
|---|---|
| Backend started by `npm run dev` / `npm start` | **Express + SQLite** (`server.ts`, `server/`), serving Vite as middleware on port 3000 |
| Backend the frontend calls | Same Express app, via axios `baseURL=/api/v1` (same origin) |
| Backend the tests target | `tests/integration.test.ts` (Express); note there is **no test script** in `package.json` |
| Database in use | `data/byte_campus.db` (WAL mode), path overridable via `DATABASE_PATH` |
| FastAPI `backend/` | **Skeleton only**: `config.py`, `database.py`, `models.py`, and a `/api/health` route (~316 lines total). No routers, no seed, no Alembic directory, no `requirements` install possible to serve data. It cannot serve a single menu item. |
| README.md (original) | Described FastAPI + a `frontend/` folder + `python -m app.seed` and `alembic upgrade head`. **None of those exist.** Following it could never produce a working site. |

**Decision: Express + SQLite is canonical.** It is the only backend with routes, schema, seed and a
frontend wired to it. Migrating to FastAPI would mean rewriting ~15 routers for no gain. The
`backend/` folder is retained but marked inactive (see `backend/README.md`).

## 2. Database state (VERIFIED by querying a copy of `data/byte_campus.db`)

Row counts: campuses 1, users 6, outlets 3, outlet_staff 3, menu_categories 7, menu_items 14, orders 3,
order_items 4, payments 3, outlet_tables 12, reservations 1, reviews 0, media_assets 0, audit_logs 0.
Outlets: Central Canteen, South Indian Corner, Beverage & Snack Station (all ACTIVE).

So the "empty database" hypothesis is **ruled out** for the shipped file. A fresh DB would also be
seeded, because `server.ts` calls `initializeDatabase(); seedDatabase();` on startup.

## 3. API contract (read from source)

- Envelope `{success, data, message[, pagination]}` is implemented in `responseContract.ts`
  and consumed by an axios interceptor that unwraps `data`. List pages wrap results in `safeArray()`.
  The earlier `allFoods.filter is not a function` crash is **already guarded** in this version.
- Routes are mounted under both `/api/v1` and `/api`. Works, but is redundant ambiguity.
- Error envelope puts `message` inside `error.message` and omits top-level `message`, which differs from the
  spec in the brief. The frontend reads both, so it is harmless but inconsistent.

## 4. Defects found (code-reading; not yet reproduced at runtime)

| # | Severity | Finding |
|---|---|---|
| 1 | High | **Reservations are not the requested workflow.** `POST /tables/:id/reserve` only creates a walk-up hold from *now* for 10–60 min. There is no date, time-slot or party-size check against capacity (`party_size` defaults to 2 and is never compared to `capacity`). The frontend sends only `duration_minutes`. |
| 2 | High | **Conflict detection is status-flag based, not time-overlap based.** It checks `outlet_tables.status='available'` and any CONFIRMED reservation "today". Two users can never book different time slots on the same table. |
| 3 | Medium | **Date mismatch:** inserts use `toISOString()` (UTC date) while the conflict query uses `date('now','localtime')`. Near midnight (IST is UTC+5:30) these disagree. |
| 4 | Medium | `GET /tables` LEFT JOINs every CONFIRMED reservation without a date filter; a table with more than one confirmed row would be duplicated in the response. |
| 5 | Medium | Seed runs only when `campuses` is empty (all or nothing). Not a per-row upsert, so adding outlets later never reaches an existing DB. |
| 6 | Medium | Food `image_url` values are `/src/assets/images/...`. That works only under the Vite dev server. In a production build (`vite build` + `express.static(dist)`) those URLs 404. Only 4 images exist for 14 items. |
| 7 | Medium | Frontend calls `GET /notifications`, which has no backend route (404 on every page load that uses it). |
| 8 | Low | `PATCH /categories/reorder` is declared after `PATCH /:id`, so Express matches `:id="reorder"` first; reorder is unreachable. |
| 9 | Medium | Schema lacks dedicated `order_status_history` and `pickup_tokens` tables required by the brief (pickup token is a column on `orders`). Reservation states lack `HELD`/`COMPLETED`. |
| 10 | Low | `menuRouter` computes `is_jain` from the raw JSON string with `.includes('JAIN')`; works by accident but is fragile. `item.description.toLowerCase()` in the menu filter will throw if a description is ever NULL. |
| 11 | Risk | `package.json` pins `better-sqlite3 ^13.0.3` and mixes `@types/express ^5` with `express ^4`. I could not verify either installs cleanly on Windows. A native-build failure here would stop the backend from starting at all. |
| 12 | Low | `package.json` has no `test` script and no `db:reset` / `seed` scripts; `.aistudio/` contains tooling artefacts. |

## 5. What was changed in this pass

Documentation and orientation only. No application logic was modified, because it cannot be compiled or run here and
blind edits to a 90 KB `App.tsx` would add risk rather than remove it.
- `README.md` rewritten to describe the real (Express + SQLite) setup with Windows commands.
- `backend/README.md` added marking the FastAPI skeleton as inactive.
- This audit added. The original ZIP contents are otherwise untouched.

## 6. Recommended next steps (in order)

1. Run the app locally (README) and confirm the homepage, menu and tables load. Report the first failure verbatim.
2. Fix #1/#2/#3/#4 together: add `reservation_date` + time-slot selection, overlap query
   (`start < :end AND end > :start`), capacity check, and a unique-ish guard inside the transaction.
3. Serve images from `public/` (#6), add the `/notifications` route or remove the call (#7), fix route order (#8).
4. Add `order_status_history` / `pickup_tokens` (#9), per-row seed upsert (#5), then add a real test script and Playwright.
