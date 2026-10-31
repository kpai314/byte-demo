import { Router } from 'express';
import { db } from '../db/database';
import { sendSuccess, sendError } from '../middleware/responseContract';

export const cartRouter = Router();

// Validate Cart Items & Server Calculation
cartRouter.post('/validate', (req, res) => {
  const { outlet_id, items } = req.body;

  if (!outlet_id) {
    sendError(res, 400, 'BAD_REQUEST', 'outlet_id is required.');
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    sendSuccess(res, {
      valid: true,
      outlet_id,
      items: [],
      subtotal: 0,
      taxes: 0,
      total: 0,
    });
    return;
  }

  // 1. Single Outlet Rule: Verify all items belong to requested outlet_id
  const itemIds = items.map((x: any) => Number(x.food_item_id || x.id)).filter(id => !isNaN(id));
  const placeholders = itemIds.map(() => '?').join(',');

  const dbItems = db.prepare(`
    SELECT id, outlet_id, item_name, price, availability_status, stock_quantity
    FROM menu_items
    WHERE id IN (${placeholders})
  `).all(...itemIds) as any[];

  let subtotal = 0;
  const validatedLines = [];
  const errors: string[] = [];

  for (const line of items) {
    const itemId = Number(line.food_item_id || line.id);
    const qty = Math.max(1, Number(line.quantity) || 1);
    const dbItem = dbItems.find(i => i.id === itemId);

    if (!dbItem) {
      errors.push(`Item ID ${itemId} does not exist.`);
      continue;
    }

    if (dbItem.outlet_id !== outlet_id) {
      errors.push(`"${dbItem.item_name}" belongs to a different canteen. Carts must contain items from a single outlet.`);
      continue;
    }

    if (dbItem.availability_status !== 'AVAILABLE') {
      errors.push(`"${dbItem.item_name}" is currently sold out.`);
      continue;
    }

    if (dbItem.stock_quantity < qty) {
      errors.push(`Only ${dbItem.stock_quantity} portions of "${dbItem.item_name}" available.`);
      continue;
    }

    const lineTotal = dbItem.price * qty;
    subtotal += lineTotal;

    validatedLines.push({
      food_item_id: dbItem.id,
      item_name: dbItem.item_name,
      unit_price: dbItem.price,
      quantity: qty,
      line_total: lineTotal,
    });
  }

  if (errors.length > 0) {
    sendError(res, 409, 'CART_VALIDATION_FAILED', 'Some items in your tray could not be validated.', {
      errors,
      validated_lines: validatedLines,
    });
    return;
  }

  sendSuccess(res, {
    valid: true,
    outlet_id,
    items: validatedLines,
    subtotal,
    taxes: 0,
    total: subtotal,
  });
});
