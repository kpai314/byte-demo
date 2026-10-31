import { Router } from 'express';
import { db, runTransaction } from '../db/database';
import { requireAuth, requireVendorOrAdmin } from '../middleware/auth';
import { sendSuccess, sendError } from '../middleware/responseContract';
import { createNotification } from '../services/notificationService';

export const orderRouter = Router();

// Order Lifecycle Status Transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  PLACED: ['ACCEPTED', 'PREPARING', 'CANCELLED', 'REJECTED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

// 1. Order Checkout & Transactional Creation
orderRouter.post(['/checkout', '/'], requireAuth, (req, res) => {
  const user = req.user!;
  const {
    outlet_id,
    items,
    idempotency_key,
    pickup_type,
    scheduled_time,
    payment_method,
  } = req.body;

  if (!outlet_id) {
    sendError(res, 400, 'BAD_REQUEST', 'outlet_id is required.');
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    sendError(res, 400, 'BAD_REQUEST', 'Your campus tray is empty.');
    return;
  }

  // Idempotency Check
  if (idempotency_key) {
    const existing = db.prepare('SELECT * FROM orders WHERE idempotency_key = ?').get(idempotency_key) as any;
    if (existing) {
      if (existing.user_id !== user.id) {
        sendError(res, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key has already been used by another transaction.');
        return;
      }
      const existingItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(existing.id) as any[];
      const outlet = db.prepare('SELECT outlet_name FROM outlets WHERE id = ?').get(existing.outlet_id) as any;

      sendSuccess(res, {
        id: existing.id,
        order_number: existing.order_number,
        outlet_name: outlet?.outlet_name || 'Campus Canteen',
        pickup_counter: existing.pickup_counter,
        status: existing.order_status,
        order_status: existing.order_status,
        payment_status: existing.payment_status,
        subtotal: existing.subtotal,
        total: existing.total_amount,
        pickup_token: existing.pickup_token,
        items: existingItems.map(i => ({
          food_item_id: i.menu_item_id,
          name: i.item_name_snapshot,
          quantity: i.quantity,
          unit_price: i.unit_price_snapshot,
          line_total: i.item_total,
        })),
        message: 'Existing order returned via idempotency key.',
      });
      return;
    }
  }

  // Fetch Outlet
  const outlet = db.prepare('SELECT * FROM outlets WHERE id = ?').get(outlet_id) as any;
  if (!outlet) {
    sendError(res, 404, 'NOT_FOUND', 'Campus outlet not found.');
    return;
  }

  if (outlet.outlet_status !== 'ACTIVE') {
    sendError(res, 403, 'OUTLET_CLOSED', `This outlet is currently ${outlet.outlet_status.toLowerCase()}.`);
    return;
  }

  // Transactional Validation, Stock Decrement, Order, History & Payment Creation
  try {
    const createdOrder = runTransaction(() => {
      let subtotal = 0;
      const orderLines: Array<{
        menu_item_id: number;
        name: string;
        unit_price: number;
        quantity: number;
        item_total: number;
      }> = [];

      for (const line of items) {
        const itemId = Number(line.food_item_id || line.id);
        const qty = Math.max(1, Number(line.quantity) || 1);

        const menuItem = db.prepare(`
          SELECT id, outlet_id, item_name, price, availability_status, stock_quantity
          FROM menu_items
          WHERE id = ?
        `).get(itemId) as any;

        if (!menuItem) {
          throw new Error(`Item ID ${itemId} does not exist.`);
        }

        if (menuItem.outlet_id !== outlet_id) {
          throw new Error(`Item "${menuItem.item_name}" does not belong to ${outlet.outlet_name}.`);
        }

        if (menuItem.availability_status !== 'AVAILABLE') {
          throw new Error(`Item "${menuItem.item_name}" is currently sold out.`);
        }

        if (menuItem.stock_quantity < qty) {
          throw new Error(`Only ${menuItem.stock_quantity} available for "${menuItem.item_name}".`);
        }

        const lineTotal = menuItem.price * qty;
        subtotal += lineTotal;

        // Atomically decrement stock
        db.prepare(`
          UPDATE menu_items
          SET stock_quantity = stock_quantity - ?,
              availability_status = CASE WHEN stock_quantity - ? <= 0 THEN 'SOLD_OUT' ELSE 'AVAILABLE' END,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(qty, qty, itemId);

        orderLines.push({
          menu_item_id: menuItem.id,
          name: menuItem.item_name,
          unit_price: menuItem.price,
          quantity: qty,
          item_total: lineTotal,
        });
      }

      const total = subtotal;
      const orderNum = 'B' + Math.floor(1000 + Math.random() * 9000).toString();
      const pickupToken = 'TK-' + Math.floor(1000 + Math.random() * 9000).toString() + '-EXP';
      const pickupCounter = outlet_id === 3 ? 'EXPRESS WINDOW' : `COUNTER 0${outlet_id}`;
      const resolvedPaymentMethod = payment_method === 'cash' ? 'cash' : 'upi';
      const paymentStatus = resolvedPaymentMethod === 'cash' ? 'CASH_AT_COUNTER' : 'PAID';

      // Insert Order
      const orderResult = db.prepare(`
        INSERT INTO orders (
          order_number, idempotency_key, user_id, outlet_id, subtotal, taxes,
          discounts, total_amount, payment_status, order_status, pickup_token,
          pickup_counter, pickup_type, scheduled_time, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, 'PLACED', ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        orderNum,
        idempotency_key || `idemp-${Date.now()}-${Math.random()}`,
        user.id,
        outlet_id,
        subtotal,
        total,
        paymentStatus,
        pickupToken,
        pickupCounter,
        pickup_type || 'immediate',
        scheduled_time || null
      );

      const orderId = Number(orderResult.lastInsertRowid);

      // Insert Order Items (Historical Snapshot)
      const itemStmt = db.prepare(`
        INSERT INTO order_items (
          order_id, menu_item_id, item_name_snapshot, unit_price_snapshot,
          quantity, item_total
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const line of orderLines) {
        itemStmt.run(
          orderId,
          line.menu_item_id,
          line.name,
          line.unit_price,
          line.quantity,
          line.item_total
        );
      }

      // Insert into pickup_tokens table
      db.prepare(`
        INSERT INTO pickup_tokens (order_id, token, status, created_at)
        VALUES (?, ?, 'ACTIVE', datetime('now'))
      `).run(orderId, pickupToken);

      // Record in order_status_history table
      db.prepare(`
        INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, created_at)
        VALUES (?, NULL, 'PLACED', ?, datetime('now'))
      `).run(orderId, user.id);

      // Insert Sandbox Payment Record
      db.prepare(`
        INSERT INTO payments (
          order_id, payment_provider, payment_reference, amount,
          payment_method, payment_status, created_at
        ) VALUES (?, 'SANDBOX_UPI', ?, ?, ?, ?, datetime('now'))
      `).run(
        orderId,
        `UPI-REF-${Date.now()}`,
        total,
        resolvedPaymentMethod,
        paymentStatus === 'PAID' ? 'SUCCESS' : 'PENDING'
      );

      // Notify User
      createNotification(
        user.id,
        'Order Placed',
        `Order #${orderNum} placed at ${outlet.outlet_name}. Pickup token: ${pickupToken}. Total: ₹${total.toFixed(0)}.`,
        'order'
      );

      return {
        id: orderId,
        order_number: orderNum,
        outlet_name: outlet.outlet_name,
        pickup_counter: pickupCounter,
        status: 'PLACED',
        order_status: 'PLACED',
        payment_status: paymentStatus,
        subtotal,
        total,
        pickup_token: pickupToken,
        items: orderLines,
      };
    });

    sendSuccess(res, createdOrder, 'Order placed successfully. Present pickup token at counter.', 201);
  } catch (err: any) {
    sendError(res, 400, 'ORDER_CREATION_FAILED', err.message || 'Transaction could not be completed.');
  }
});

// 2. Student's Own Orders
orderRouter.get('/mine', requireAuth, (req, res) => {
  const user = req.user!;
  const orders = db.prepare(`
    SELECT
      o.*,
      out.outlet_name
    FROM orders o
    JOIN outlets out ON o.outlet_id = out.id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC
  `).all(user.id) as any[];

  const result = orders.map(o => {
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
      payment_status: o.payment_status,
      total: o.total_amount,
      total_amount: o.total_amount,
      pickup_token: o.pickup_token,
      created_at: o.created_at,
      items,
    };
  });

  sendSuccess(res, result);
});

// 3. Vendor / Admin: Active Kitchen Queue Orders
orderRouter.get('/', requireVendorOrAdmin, (req, res) => {
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
      payment_status: o.payment_status,
      total: o.total_amount,
      total_amount: o.total_amount,
      pickup_token: o.pickup_token,
      created_at: o.created_at,
      items,
    };
  });

  sendSuccess(res, result);
});

// 4. Single Order Details with Status History
orderRouter.get('/:id', requireAuth, (req, res) => {
  const user = req.user!;
  const orderId = parseInt(req.params.id, 10);

  if (isNaN(orderId)) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid order ID required.');
    return;
  }

  const order = db.prepare(`
    SELECT o.*, out.outlet_name
    FROM orders o
    JOIN outlets out ON o.outlet_id = out.id
    WHERE o.id = ?
  `).get(orderId) as any;

  if (!order) {
    sendError(res, 404, 'NOT_FOUND', 'Order not found.');
    return;
  }

  if (user.operational_role === 'USER' && order.user_id !== user.id) {
    sendError(res, 403, 'FORBIDDEN', 'Access denied.');
    return;
  }

  const items = db.prepare(`
    SELECT item_name_snapshot as name, unit_price_snapshot as unit_price, quantity, item_total as line_total
    FROM order_items
    WHERE order_id = ?
  `).all(order.id);

  const history = db.prepare(`
    SELECT h.previous_status, h.new_status, h.created_at, u.full_name as changed_by_name
    FROM order_status_history h
    LEFT JOIN users u ON h.changed_by = u.id
    WHERE h.order_id = ?
    ORDER BY h.created_at ASC
  `).all(order.id);

  sendSuccess(res, {
    ...order,
    status: order.order_status,
    total: order.total_amount,
    items,
    history,
  });
});

// 5. Order Lifecycle Status Transitions
orderRouter.patch('/:id/status', requireVendorOrAdmin, (req, res) => {
  const user = req.user!;
  const orderId = parseInt(req.params.id, 10);
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
      UPDATE orders
      SET order_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, orderId);

    // Record in history
    db.prepare(`
      INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(orderId, order.order_status, nextStatus, user.id);

    // If order completed, mark pickup token redeemed
    if (nextStatus === 'COMPLETED') {
      db.prepare(`
        UPDATE pickup_tokens
        SET status = 'REDEEMED', redeemed_at = datetime('now')
        WHERE order_id = ?
      `).run(orderId);
    }
  });

  // Notifications based on transition
  if (nextStatus === 'ACCEPTED') {
    createNotification(order.user_id, 'Order Accepted', `Your order #${order.order_number} has been accepted by the kitchen.`, 'order');
  } else if (nextStatus === 'PREPARING') {
    createNotification(order.user_id, 'Order Preparing', `Your order #${order.order_number} is being cooked fresh.`, 'order');
  } else if (nextStatus === 'READY') {
    createNotification(order.user_id, 'Order Ready for Pickup', `Order #${order.order_number} is READY! Present token ${order.pickup_token} at ${order.pickup_counter}.`, 'pickup');
  } else if (nextStatus === 'COMPLETED') {
    createNotification(order.user_id, 'Order Completed', `Order #${order.order_number} has been delivered. Enjoy your meal!`, 'order');
  } else if (nextStatus === 'CANCELLED') {
    createNotification(order.user_id, 'Order Cancelled', `Order #${order.order_number} was cancelled.`, 'order');
  }

  sendSuccess(res, { id: orderId, status: nextStatus, order_status: nextStatus }, `Order updated to ${nextStatus}.`);
});

// 6. Pickup Token Verification at Counter (Prevents reuse!)
orderRouter.post('/:id/verify-pickup', requireVendorOrAdmin, (req, res) => {
  const user = req.user!;
  const orderId = parseInt(req.params.id, 10);
  const { pickup_token } = req.body;

  if (!pickup_token) {
    sendError(res, 400, 'BAD_REQUEST', 'pickup_token is required.');
    return;
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    sendError(res, 404, 'NOT_FOUND', 'Order not found.');
    return;
  }

  if (order.pickup_token !== pickup_token) {
    sendError(res, 400, 'INVALID_TOKEN', 'Pickup token mismatch. Please re-check the QR token.');
    return;
  }

  // Check token in pickup_tokens table
  const tokenRecord = db.prepare('SELECT * FROM pickup_tokens WHERE order_id = ?').get(orderId) as any;
  if (tokenRecord && tokenRecord.status === 'REDEEMED') {
    sendError(res, 409, 'ALREADY_COMPLETED', 'This pickup token has already been redeemed and cannot be reused.');
    return;
  }

  if (order.order_status === 'COMPLETED') {
    sendError(res, 409, 'ALREADY_COMPLETED', 'This order has already been verified and delivered.');
    return;
  }

  runTransaction(() => {
    db.prepare(`
      UPDATE orders
      SET order_status = 'COMPLETED', updated_at = datetime('now')
      WHERE id = ?
    `).run(orderId);

    db.prepare(`
      UPDATE pickup_tokens
      SET status = 'REDEEMED', redeemed_at = datetime('now')
      WHERE order_id = ?
    `).run(orderId);

    db.prepare(`
      INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, created_at)
      VALUES (?, ?, 'COMPLETED', ?, datetime('now'))
    `).run(orderId, order.order_status, user.id);
  });

  createNotification(order.user_id, 'Order Delivered', `Pickup verified for order #${order.order_number}. Have a great meal!`, 'pickup');

  sendSuccess(res, { id: orderId, status: 'COMPLETED', order_status: 'COMPLETED' }, 'Pickup token verified. Order delivered.');
});
