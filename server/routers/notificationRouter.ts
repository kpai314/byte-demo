import { Router } from 'express';
import { db } from '../db/database';
import { requireAuth } from '../middleware/auth';
import { sendSuccess, sendError } from '../middleware/responseContract';

export const notificationRouter = Router();

// Retrieve current user's notifications
notificationRouter.get('/', requireAuth, (req, res) => {
  const user = req.user!;
  const rows = db.prepare(`
    SELECT id, title, body, type, read, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(user.id) as any[];

  const items = rows.map(r => ({
    id: r.id,
    title: r.title,
    body: r.body,
    timestamp: r.created_at,
    type: r.type,
    read: Boolean(r.read),
  }));

  sendSuccess(res, items);
});

// Unread notifications count
notificationRouter.get('/unread-count', requireAuth, (req, res) => {
  const user = req.user!;
  const row = db.prepare(`
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = ? AND read = 0
  `).get(user.id) as { count: number };

  sendSuccess(res, { count: row.count || 0 });
});

// Mark all as read
notificationRouter.patch('/read-all', requireAuth, (req, res) => {
  const user = req.user!;
  db.prepare(`
    UPDATE notifications
    SET read = 1
    WHERE user_id = ? AND read = 0
  `).run(user.id);

  sendSuccess(res, { success: true }, 'All notifications marked as read.');
});

// Mark single notification as read
notificationRouter.patch('/:id/read', requireAuth, (req, res) => {
  const user = req.user!;
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid notification ID required.');
    return;
  }

  db.prepare(`
    UPDATE notifications
    SET read = 1
    WHERE id = ? AND user_id = ?
  `).run(id, user.id);

  sendSuccess(res, { id, read: true }, 'Notification marked as read.');
});
