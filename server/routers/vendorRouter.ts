import { Router } from 'express';
import { db, runTransaction } from '../db/database';
import { requireVendorOrAdmin } from '../middleware/auth';
import { sendSuccess, sendError } from '../middleware/responseContract';
import { createNotification } from '../services/notificationService';

export const vendorRouter = Router();

const VALID_TRANSITIONS: Record<string, string[]> = {
  PLACED: ['ACCEPTED', 'PREPARING', 'CANCELLED', 'REJECTED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

// Vendor's Authorized Outlets
vendorRouter.get('/outlets', requireVendorOrAdmin, (req, res) => {
  const user = req.user!;
  let query = 'SELECT * FROM outlets';
  const params: any[] = [];

  if (user.operational_role !== 'ADMIN') {
    query += `
      WHERE vendor_owner_id = ?
         OR id IN (SELECT outlet_id FROM outlet_staff WHERE user_id = ? AND status = 'ACTIVE')
    `;
    params.push(user.id, user.id);
  }

  query += ' ORDER BY id ASC';
  const rows = db.prepare(query).all(...params) as any[];

  const result = rows.map(o => ({
    id: o.id,
    name: o.outlet_name,
    outlet_name: o.outlet_name,
    slug: o.slug,
    description: o.description,
    location: o.location,
    status: o.outlet_status.toLowerCase(),
    outlet_status: o.outlet_status,
    crowd_level: o.crowd_level,
    avg_wait_min: o.avg_wait_min,
  }));

  sendSuccess(res, result);
});

// Vendor's Orders Queue
vendorRouter.get('/orders', requireVendorOrAdmin, (req, res) => {
  const user = req.user!;
  let query = `
    SELECT o.*, out.outlet_name
    FROM orders o
    JOIN outlets out ON o.outlet_id = out.id
  `;
  const params: any[] = [];

  if (user.operational_role !== 'ADMIN') {
    query += `
      WHERE o.outlet_id IN (
        SELECT id FROM outlets WHERE vendor_owner_id = ?
        UNION
        SELECT outlet_id FROM outlet_staff WHERE user_id = ? AND status = 'ACTIVE'
      )
    `;
    params.push(user.id, user.id);
  }

  query += ' ORDER BY o.created_at DESC LIMIT 100';
  const rows = db.prepare(query).all(...params) as any[];

  const result = rows.map(o => {
    const items = db.prepare(`
      SELECT item_name_snapshot as name, unit_price_snapshot as unit_price, quantity, item_total as line_total
      FROM order_items
      WHERE order_id = ?
    `).all(o.id);

    return {
      id: o.id,
      order_number: o.order_number,
      outlet_id: o.outlet_id,
      outlet_name: o.outlet_name,
      pickup_counter: o.pickup_counter,
      status: o.order_status,
      order_status: o.order_status,
      total: o.total_amount,
      pickup_token: o.pickup_token,
      created_at: o.created_at,
      items,
    };
  });

  sendSuccess(res, result);
});

// Update Order Status in Kitchen Queue
vendorRouter.patch('/orders/:orderId/status', requireVendorOrAdmin, (req, res) => {
  const user = req.user!;
  const orderId = parseInt(req.params.orderId, 10);
  const { status } = req.body;
  const nextStatus = status ? status.toUpperCase() : null;

  if (!nextStatus) {
    sendError(res, 400, 'BAD_REQUEST', 'status is required.');
    return;
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    sendError(res, 404, 'NOT_FOUND', 'Order not found.');
    return;
  }

  const allowedNext = VALID_TRANSITIONS[order.order_status] || [];
  if (!allowedNext.includes(nextStatus)) {
    sendError(
      res,
      400,
      'INVALID_STATUS_TRANSITION',
      `Cannot transition order from ${order.order_status} to ${nextStatus}. Allowed: [${allowedNext.join(', ')}]`
    );
    return;
  }

  runTransaction(() => {
    db.prepare(`
      UPDATE orders SET order_status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(nextStatus, orderId);

    db.prepare(`
      INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(orderId, order.order_status, nextStatus, user.id);

    if (nextStatus === 'COMPLETED') {
      db.prepare(`
        UPDATE pickup_tokens SET status = 'REDEEMED', redeemed_at = datetime('now') WHERE order_id = ?
      `).run(orderId);
    }
  });

  if (nextStatus === 'ACCEPTED') {
    createNotification(order.user_id, 'Order Accepted', `Your order #${order.order_number} has been accepted by the kitchen.`, 'order');
  } else if (nextStatus === 'PREPARING') {
    createNotification(order.user_id, 'Order Preparing', `Your order #${order.order_number} is being cooked fresh.`, 'order');
  } else if (nextStatus === 'READY') {
    createNotification(order.user_id, 'Order Ready for Pickup', `Order #${order.order_number} is READY! Present token ${order.pickup_token} at ${order.pickup_counter}.`, 'pickup');
  } else if (nextStatus === 'COMPLETED') {
    createNotification(order.user_id, 'Order Completed', `Order #${order.order_number} has been delivered. Enjoy your meal!`, 'order');
  }

  sendSuccess(res, { id: orderId, status: nextStatus, order_status: nextStatus }, `Order updated to ${nextStatus}.`);
});

// Add Item to Outlet Menu
vendorRouter.post('/outlets/:outletId/items', requireVendorOrAdmin, (req, res) => {
  const user = req.user!;
  const outletId = parseInt(req.params.outletId, 10);
  const {
    name,
    item_name,
    description,
    price,
    image_url,
    prep_minutes,
    dietary_type,
    food_type,
    is_jain,
    dietary_tags,
    category_id,
    stock_quantity,
  } = req.body;

  const resolvedName = (name || item_name || '').trim();
  const resolvedPrice = Number(price);
  if (!resolvedName || isNaN(resolvedPrice) || resolvedPrice < 0) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid name and non-negative price required.');
    return;
  }

  // Permission check
  if (user.operational_role === 'VENDOR') {
    const authorized = db.prepare(`
      SELECT id FROM outlets WHERE id = ? AND (
        vendor_owner_id = ?
        OR id IN (SELECT outlet_id FROM outlet_staff WHERE user_id = ? AND status = 'ACTIVE')
      )
    `).get(outletId, user.id, user.id);
    if (!authorized) {
      sendError(res, 403, 'FORBIDDEN', 'You are not authorized to manage menu items for this outlet.');
      return;
    }
  }

  const defaultImg = image_url || '/images/food/placeholder.svg';
  const resolvedFoodType = (food_type || (dietary_type === 'non_veg' ? 'NON_VEG' : 'VEG')).toUpperCase();
  const tags = Array.isArray(dietary_tags) ? dietary_tags : (is_jain ? ['JAIN'] : []);

  const result = db.prepare(`
    INSERT INTO menu_items (
      outlet_id, category_id, item_name, description, price, image_url,
      food_type, dietary_tags, preparation_time, availability_status, stock_quantity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?)
  `).run(
    outletId,
    category_id || 1,
    resolvedName,
    description || 'Freshly made on campus.',
    resolvedPrice,
    defaultImg,
    resolvedFoodType,
    JSON.stringify(tags),
    Number(prep_minutes) || 10,
    Number(stock_quantity) || 50
  );

  const created = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(result.lastInsertRowid) as any;
  sendSuccess(res, {
    ...created,
    name: created.item_name,
    prep_minutes: created.preparation_time,
    is_available: true,
  }, 'Item added.', 201);
});

// Update Menu Item
vendorRouter.patch('/items/:itemId', requireVendorOrAdmin, (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  const { name, item_name, description, price, is_available, stock_quantity, prep_minutes } = req.body;

  const resolvedName = item_name || name;

  db.prepare(`
    UPDATE menu_items
    SET item_name = COALESCE(?, item_name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        stock_quantity = COALESCE(?, stock_quantity),
        preparation_time = COALESCE(?, preparation_time),
        availability_status = CASE
          WHEN ? = 0 THEN 'SOLD_OUT'
          WHEN ? = 1 THEN 'AVAILABLE'
          ELSE availability_status
        END,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    resolvedName ? resolvedName.trim() : null,
    description !== undefined ? description : null,
    price !== undefined ? Number(price) : null,
    stock_quantity !== undefined ? Number(stock_quantity) : null,
    prep_minutes !== undefined ? Number(prep_minutes) : null,
    is_available !== undefined ? (is_available ? 1 : 0) : null,
    is_available !== undefined ? (is_available ? 1 : 0) : null,
    itemId
  );

  const updated = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(itemId) as any;
  sendSuccess(res, updated, 'Item updated.');
});

// Toggle Item Availability
vendorRouter.patch('/items/:itemId/availability', requireVendorOrAdmin, (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  const { is_available } = req.body;
  const status = is_available ? 'AVAILABLE' : 'SOLD_OUT';

  db.prepare(`
    UPDATE menu_items SET availability_status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, itemId);

  sendSuccess(res, { id: itemId, is_available: Boolean(is_available), availability_status: status });
});
