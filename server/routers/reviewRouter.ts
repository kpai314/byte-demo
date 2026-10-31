import { Router } from 'express';
import { db } from '../db/database';
import { requireAuth } from '../middleware/auth';
import { sendSuccess, sendError } from '../middleware/responseContract';

export const reviewRouter = Router();

// List Reviews for Outlet
reviewRouter.get('/', (req, res) => {
  const outletId = req.query.outlet_id ? parseInt(req.query.outlet_id as string, 10) : null;
  let query = `
    SELECT r.*, u.full_name as author_name, o.outlet_name
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    JOIN outlets o ON r.outlet_id = o.id
  `;
  const params: any[] = [];

  if (outletId) {
    query += ' WHERE r.outlet_id = ?';
    params.push(outletId);
  }
  query += ' ORDER BY r.created_at DESC';

  const rows = db.prepare(query).all(...params);
  sendSuccess(res, rows);
});

// Post a Review (Must be an eligible COMPLETED order placed by user)
reviewRouter.post('/', requireAuth, (req, res) => {
  const user = req.user!;
  const { order_id, rating, review_text } = req.body;

  const orderNum = parseInt(order_id, 10);
  const ratingNum = parseInt(rating, 10);

  if (isNaN(orderNum) || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid order_id and rating between 1 and 5 are required.');
    return;
  }

  // Verify order eligibility
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderNum) as any;
  if (!order) {
    sendError(res, 404, 'NOT_FOUND', 'Order not found.');
    return;
  }

  if (order.user_id !== user.id) {
    sendError(res, 403, 'FORBIDDEN', 'You may only review your own orders.');
    return;
  }

  if (order.order_status !== 'COMPLETED') {
    sendError(res, 400, 'ORDER_NOT_COMPLETED', 'Only completed orders qualify for student reviews.');
    return;
  }

  const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(orderNum);
  if (existing) {
    sendError(res, 409, 'ALREADY_REVIEWED', 'This order has already been reviewed.');
    return;
  }

  const result = db.prepare(`
    INSERT INTO reviews (user_id, outlet_id, order_id, rating, review_text)
    VALUES (?, ?, ?, ?, ?)
  `).run(user.id, order.outlet_id, orderNum, ratingNum, review_text || '');

  const created = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid);
  sendSuccess(res, created, 'Review submitted successfully.', 201);
});
