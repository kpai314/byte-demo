import { db } from './database';

export function runMigrations() {
  // 1. Ensure duration_minutes column in reservations
  const resCols = db.prepare("PRAGMA table_info(reservations)").all() as Array<{ name: string }>;
  const hasDuration = resCols.some(c => c.name === 'duration_minutes');
  if (!hasDuration) {
    db.exec("ALTER TABLE reservations ADD COLUMN duration_minutes INTEGER DEFAULT 20;");
  }

  // 2. Create order_status_history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
  `);

  // 3. Create pickup_tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pickup_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REDEEMED', 'EXPIRED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      redeemed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pickup_tokens_token ON pickup_tokens(token);
  `);

  // 4. Create notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'announcement' CHECK (type IN ('order', 'pickup', 'rush', 'announcement', 'reservation')),
      read INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
  `);

  // 5. Backfill pickup_tokens and order_status_history for existing orders
  const existingOrders = db.prepare("SELECT id, order_number, order_status, pickup_token, created_at, updated_at FROM orders").all() as any[];
  for (const o of existingOrders) {
    if (o.pickup_token) {
      const isCompleted = o.order_status === 'COMPLETED';
      db.prepare(`
        INSERT OR IGNORE INTO pickup_tokens (order_id, token, status, created_at, redeemed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        o.id,
        o.pickup_token,
        isCompleted ? 'REDEEMED' : 'ACTIVE',
        o.created_at,
        isCompleted ? (o.updated_at || o.created_at) : null
      );
    }

    const hasHistory = db.prepare("SELECT id FROM order_status_history WHERE order_id = ?").get(o.id);
    if (!hasHistory) {
      db.prepare(`
        INSERT INTO order_status_history (order_id, previous_status, new_status, created_at)
        VALUES (?, NULL, ?, ?)
      `).run(o.id, o.order_status, o.created_at);
    }
  }

  // 6. Migrate image URLs from /src/assets/images/... to /images/food/...
  const imageMapping: Record<string, string> = {
    'pav_bhaji_fisheye_1793394718269.jpg': '/images/food/pav_bhaji.jpg',
    'vada_pav_fisheye_1793394718933.jpg': '/images/food/vada_pav.jpg',
    'paneer_butter_masala_fisheye_1793394718861.jpg': '/images/food/paneer_butter_masala.jpg',
    'masala_dosa_fisheye_1793394719149.jpg': '/images/food/masala_dosa.jpg',
  };

  const items = db.prepare("SELECT id, image_url FROM menu_items").all() as any[];
  for (const item of items) {
    if (item.image_url && item.image_url.startsWith('/src/assets/images/')) {
      const filename = item.image_url.replace('/src/assets/images/', '');
      const newUrl = imageMapping[filename] || `/images/food/${filename}`;
      db.prepare("UPDATE menu_items SET image_url = ? WHERE id = ?").run(newUrl, item.id);
    }
  }

  console.log('[BYTE Migrations] Applied schema updates, new tables, and backfilled relations safely.');
}
