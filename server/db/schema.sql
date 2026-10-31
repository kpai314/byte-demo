-- ====================================================================
-- BYTE — CAMPUS FOOD OS RELATIONAL DATABASE SCHEMA
-- Compatible with PostgreSQL & SQLite (WAL Mode, Foreign Keys Enforced)
-- ====================================================================

-- 1. Campuses
CREATE TABLE IF NOT EXISTS campuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  campus_code TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Users (Separating user_category and operational_role)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  campus_id INTEGER NOT NULL REFERENCES campuses(id) ON DELETE RESTRICT,
  user_category TEXT NOT NULL CHECK (user_category IN ('STUDENT', 'FACULTY', 'NON_TEACHING_STAFF')),
  operational_role TEXT NOT NULL DEFAULT 'USER' CHECK (operational_role IN ('USER', 'ADMIN', 'VENDOR', 'OUTLET_STAFF')),
  account_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'PENDING')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Outlets
CREATE TABLE IF NOT EXISTS outlets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campus_id INTEGER NOT NULL REFERENCES campuses(id) ON DELETE RESTRICT,
  outlet_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  location TEXT NOT NULL,
  opening_time TEXT NOT NULL DEFAULT '08:00',
  closing_time TEXT NOT NULL DEFAULT '20:00',
  outlet_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (outlet_status IN ('ACTIVE', 'CLOSED', 'MAINTENANCE')),
  crowd_level TEXT NOT NULL DEFAULT 'LOW' CHECK (crowd_level IN ('LOW', 'MODERATE', 'HIGH')),
  avg_wait_min INTEGER NOT NULL DEFAULT 10,
  vendor_owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Outlet Staff Memberships
CREATE TABLE IF NOT EXISTS outlet_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_role TEXT NOT NULL DEFAULT 'STAFF' CHECK (staff_role IN ('MANAGER', 'CHEF', 'CASHIER', 'STAFF')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(outlet_id, user_id)
);

-- 5. Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  item_name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL CHECK (price >= 0),
  image_url TEXT NOT NULL,
  food_type TEXT NOT NULL CHECK (food_type IN ('VEG', 'NON_VEG', 'EGG')),
  dietary_tags TEXT DEFAULT '[]', -- JSON string e.g. ["JAIN", "VEGAN"]
  allergens TEXT DEFAULT '[]',     -- JSON string e.g. ["DAIRY", "NUTS"]
  preparation_time INTEGER NOT NULL DEFAULT 10 CHECK (preparation_time >= 0),
  availability_status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (availability_status IN ('AVAILABLE', 'SOLD_OUT', 'HIDDEN')),
  stock_quantity INTEGER NOT NULL DEFAULT 100 CHECK (stock_quantity >= 0),
  display_order INTEGER NOT NULL DEFAULT 0,
  rating REAL DEFAULT 4.8,
  is_popular INTEGER NOT NULL DEFAULT 0 CHECK (is_popular IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Orders
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  idempotency_key TEXT UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  taxes REAL NOT NULL DEFAULT 0 CHECK (taxes >= 0),
  discounts REAL NOT NULL DEFAULT 0 CHECK (discounts >= 0),
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'CASH_AT_COUNTER', 'REFUNDED')),
  order_status TEXT NOT NULL DEFAULT 'PLACED' CHECK (order_status IN ('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'REJECTED')),
  pickup_token TEXT NOT NULL,
  pickup_counter TEXT NOT NULL DEFAULT 'COUNTER 01',
  pickup_type TEXT NOT NULL DEFAULT 'immediate' CHECK (pickup_type IN ('immediate', 'scheduled')),
  scheduled_time TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Order Items (Historical Snapshot: Name & Unit Price at time of purchase)
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  item_name_snapshot TEXT NOT NULL,
  unit_price_snapshot REAL NOT NULL CHECK (unit_price_snapshot >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  selected_options TEXT DEFAULT '{}',
  item_total REAL NOT NULL CHECK (item_total >= 0)
);

-- 9. Payments (Sandbox UPI and Counter verification)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_provider TEXT NOT NULL DEFAULT 'SANDBOX_UPI',
  payment_reference TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('upi', 'cash', 'card', 'campus_id')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('SUCCESS', 'PENDING', 'FAILED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. Outlet Tables (Physical seating)
CREATE TABLE IF NOT EXISTS outlet_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(outlet_id, table_number)
);

-- 11. Reservations (Express table holds with concurrency protection)
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_number TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  table_id INTEGER NOT NULL REFERENCES outlet_tables(id) ON DELETE CASCADE,
  reservation_date TEXT NOT NULL, -- YYYY-MM-DD
  start_time TEXT NOT NULL,       -- HH:MM (24-hour)
  end_time TEXT NOT NULL,         -- HH:MM (24-hour)
  duration_minutes INTEGER NOT NULL DEFAULT 20 CHECK (duration_minutes > 0),
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  reservation_status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (reservation_status IN ('CONFIRMED', 'SEATED', 'CANCELLED', 'EXPIRED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 12. Order Status History (Audit trail of valid order transitions)
CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 13. Pickup Tokens (Unique tokens redeemable at counter)
CREATE TABLE IF NOT EXISTS pickup_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REDEEMED', 'EXPIRED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  redeemed_at TEXT
);

-- 14. Notifications (Campus event dispatches)
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'announcement' CHECK (type IN ('order', 'pickup', 'rush', 'announcement', 'reservation')),
  read INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 15. Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(order_id)
);

-- 16. Media Assets
CREATE TABLE IF NOT EXISTS media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO', 'DOCUMENT')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  alt_text TEXT,
  title TEXT,
  duration_seconds INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 17. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ====================================================================
-- PERFORMANCE & INTEGRITY INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_campus ON users(campus_id);
CREATE INDEX IF NOT EXISTS idx_outlets_campus ON outlets(campus_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_outlet ON menu_items(outlet_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_outlet ON orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_pickup_tokens_token ON pickup_tokens(token);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_reservations_table ON reservations(table_id, reservation_date, reservation_status);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
