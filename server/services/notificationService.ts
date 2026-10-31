import { db } from '../db/database';

export function createNotification(
  userId: number,
  title: string,
  body: string,
  type: 'order' | 'pickup' | 'rush' | 'announcement' | 'reservation' = 'announcement'
) {
  try {
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, title, body, type, read, created_at)
      VALUES (?, ?, ?, ?, 0, datetime('now'))
    `);
    const res = stmt.run(userId, title, body, type);
    return Number(res.lastInsertRowid);
  } catch (err) {
    console.error('[Notification creation error]', err);
    return null;
  }
}
