# BYTE — Backend Architecture Specification (Part B)
## Campus Food Operating System · Dwarkadas J. Sanghvi College of Engineering

### 1. Architectural Philosophy
BYTE is designed around four core architectural principles:
1. **Frontend Preservation**: Zero changes to the established aesthetic identity, fonts, colorways, or layout structures.
2. **Transactional Concurrency**: Financial and inventory state (stock counts, order lines, table seating passes) must always be settled in explicit ACID transactions.
3. **Data Safety by Contract**: Strict `{ success, data, message }` envelope guarantees that the frontend never receives unexpected formats or crashes on array methods (`.filter()`, `.map()`).
4. **Modularity**: Single-responsibility routers and services rather than monolithic script files.

---

### 2. System Architecture Diagram

```
[ Student / Staff Browser ]
           │
           │ HTTP (Port 3000) · Cookie/Bearer Session
           ▼
┌────────────────────────────────────────────────────────┐
│ Express Application Server (Node 22 / tsx)             │
│                                                        │
│  ├─ Middleware: CORS, CookieParser, BodyParser         │
│  ├─ Middleware: Auth & Role Guards (RBAC)              │
│  ├─ Middleware: Response Contract Envelope             │
│  │                                                     │
│  ├─ Routers:                                           │
│  │   ├─ /api/v1/auth          → authRouter.ts          │
│  │   ├─ /api/v1/outlets       → outletRouter.ts        │
│  │   ├─ /api/v1/foods         → menuRouter.ts          │
│  │   ├─ /api/v1/cart          → cartRouter.ts          │
│  │   ├─ /api/v1/orders        → orderRouter.ts         │
│  │   ├─ /api/v1/tables        → reservationRouter.ts   │
│  │   ├─ /api/v1/canteen-status→ canteenStatusRouter.ts │
│  │   ├─ /api/v1/admin         → adminRouter.ts         │
│  │   └─ /api/v1/vendor        → vendorRouter.ts        │
│  │                                                     │
│  ├─ Vite Middleware (Development SPA Serving)          │
│  └─ Error Boundary Middleware (JSON 500 handler)       │
└────────────────────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────────────────┐
│ Relational Database Storage Engine                     │
│  ├─ Engine: SQLite 3.40+ (better-sqlite3) in WAL Mode  │
│  ├─ Schema: 14 Normalized ANSI Relational Tables       │
│  ├─ Integrity: Foreign Keys ON, Immediate Transactions │
│  └─ Production Mirror: PostgreSQL 15+ (SQLAlchemy 2.0) │
└────────────────────────────────────────────────────────┘
```

---

### 3. Concurrency Protection & Conflict Avoidance

#### 3.1 Table Reservations
Dining tables cannot be double-booked. When a student requests a table hold:
1. `runTransaction()` acquires an immediate database lock.
2. An overlap query executes:
   ```sql
   SELECT id FROM reservations
   WHERE table_id = ?
     AND reservation_status = 'CONFIRMED'
     AND reservation_date = date('now', 'localtime')
     AND start_time < :new_end_time
     AND end_time > :new_start_time
   ```
3. If an existing record is returned, the transaction aborts with `409 Conflict`.
4. Housekeeping routine `expireOverdueReservations()` releases tables whose `end_time` has lapsed.

#### 3.2 Inventory & Stock Decrement
Menu item stock cannot become negative:
1. Items are checked in transaction: `stock_quantity >= quantity`.
2. Stock is decremented atomically:
   ```sql
   UPDATE menu_items
   SET stock_quantity = stock_quantity - ?,
       availability_status = CASE WHEN stock_quantity - ? <= 0 THEN 'SOLD_OUT' ELSE 'AVAILABLE' END
   WHERE id = ?
   ```
3. If portions are insufficient, the transaction rolls back cleanly.

#### 3.3 Idempotent Order Creation
To prevent network duplicate checkouts:
- Every checkout submission supplies an `idempotency_key`.
- The database enforces a `UNIQUE(idempotency_key)` constraint on the `orders` table.
- A duplicate submission immediately returns the existing confirmed order without repeating stock decrements or creating duplicate sandbox payments.

---

### 4. Security & Role-Based Access Control (RBAC)

1. **Password Security**: Passwords hashed using bcrypt with salt rounds = 10 (compatible with Argon2id parameters).
2. **Session Security**: HTTP-only, `SameSite=Lax` cookies prevent XSS exfiltration.
3. **Role Decoupling**: Academic category (`STUDENT`, `FACULTY`, `NON_TEACHING_STAFF`) is completely separate from permission (`USER`, `VENDOR`, `OUTLET_STAFF`, `ADMIN`).
4. **Backend Enforcement**: Outlet staff and vendors can only mutate orders and inventory of outlets mapped to their `user_id`.
