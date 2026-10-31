import { Router } from 'express';
import { db } from '../db/database';
import { requireVendorOrAdmin } from '../middleware/auth';
import { sendSuccess, sendError } from '../middleware/responseContract';

export const categoryRouter = Router();

// 1. List Categories
categoryRouter.get('/', (req, res) => {
  const outletId = req.query.outlet_id ? parseInt(req.query.outlet_id as string, 10) : null;
  let query = 'SELECT * FROM menu_categories WHERE is_active = 1';
  const params: any[] = [];

  if (outletId) {
    query += ' AND outlet_id = ?';
    params.push(outletId);
  }
  query += ' ORDER BY display_order ASC, id ASC';

  const rows = db.prepare(query).all(...params);
  sendSuccess(res, rows);
});

// 2. Reorder Categories — MUST BE DECLARED BEFORE /:id ROUTE
categoryRouter.patch('/reorder', requireVendorOrAdmin, (req, res) => {
  const items = req.body.orders || req.body.categories;
  if (!Array.isArray(items) || items.length === 0) {
    sendError(res, 400, 'BAD_REQUEST', 'orders or categories must be a non-empty array of { id, display_order }.');
    return;
  }

  // Validate each item
  for (const item of items) {
    if (!item.id || typeof item.display_order !== 'number') {
      sendError(res, 400, 'BAD_REQUEST', 'Each reorder item must have an id and numeric display_order.');
      return;
    }
    const cat = db.prepare('SELECT id FROM menu_categories WHERE id = ?').get(item.id);
    if (!cat) {
      sendError(res, 404, 'NOT_FOUND', `Category ID ${item.id} not found.`);
      return;
    }
  }

  const stmt = db.prepare('UPDATE menu_categories SET display_order = ? WHERE id = ?');
  const updateMany = db.transaction((reorderList: Array<{ id: number; display_order: number }>) => {
    for (const item of reorderList) {
      stmt.run(item.display_order, item.id);
    }
  });

  updateMany(items);

  const updatedRows = db.prepare('SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY display_order ASC, id ASC').all();
  sendSuccess(res, updatedRows, 'Categories reordered successfully.');
});

// 3. Create Category
categoryRouter.post('/', requireVendorOrAdmin, (req, res) => {
  const { outlet_id, category_name, description, display_order } = req.body;
  if (!outlet_id || !category_name) {
    sendError(res, 400, 'BAD_REQUEST', 'outlet_id and category_name are required.');
    return;
  }

  const result = db.prepare(`
    INSERT INTO menu_categories (outlet_id, category_name, description, display_order, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(outlet_id, category_name.trim(), description || '', Number(display_order) || 0);

  const created = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(result.lastInsertRowid);
  sendSuccess(res, created, 'Category created.', 201);
});

// 4. Update Category
categoryRouter.patch('/:id', requireVendorOrAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid category ID required.');
    return;
  }

  const existing = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(id);
  if (!existing) {
    sendError(res, 404, 'NOT_FOUND', 'Category not found.');
    return;
  }

  const { category_name, description, display_order, is_active } = req.body;

  db.prepare(`
    UPDATE menu_categories
    SET category_name = COALESCE(?, category_name),
        description = COALESCE(?, description),
        display_order = COALESCE(?, display_order),
        is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    category_name ? category_name.trim() : null,
    description !== undefined ? description : null,
    display_order !== undefined ? Number(display_order) : null,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    id
  );

  const updated = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(id);
  sendSuccess(res, updated, 'Category updated.');
});

// 5. Deactivate / Delete Category
categoryRouter.delete('/:id', requireVendorOrAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid category ID required.');
    return;
  }

  db.prepare('UPDATE menu_categories SET is_active = 0 WHERE id = ?').run(id);
  sendSuccess(res, { id, is_active: 0 }, 'Category deactivated.');
});
