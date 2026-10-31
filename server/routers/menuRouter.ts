import { Router } from 'express';
import { db } from '../db/database';
import { requireVendorOrAdmin } from '../middleware/auth';
import { sendSuccess, sendError } from '../middleware/responseContract';

export const menuRouter = Router();

// Helper to safely parse JSON arrays
function safeJsonArray(val: any): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Helper to map and sanitize food image URL
function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return '/images/food/placeholder.svg';
  if (url.includes('masala_dosa')) return '/images/food/masala_dosa.jpg';
  if (url.includes('paneer_butter')) return '/images/food/paneer_butter_masala.jpg';
  if (url.includes('pav_bhaji')) return '/images/food/pav_bhaji.jpg';
  if (url.includes('vada_pav')) return '/images/food/vada_pav.jpg';
  return url;
}

// 1. Food Item Listing with Search & Dietary Filters
menuRouter.get('/', (req, res) => {
  const search = (req.query.search as string || '').trim().toLowerCase();
  const outletId = req.query.outlet_id ? parseInt(req.query.outlet_id as string, 10) : null;
  const categoryId = req.query.category_id ? parseInt(req.query.category_id as string, 10) : null;
  const diet = (req.query.diet as string || '').toUpperCase().trim(); // 'VEG' | 'NON_VEG' | 'JAIN' | 'ALL'

  let query = `
    SELECT
      m.*,
      o.outlet_name,
      c.category_name
    FROM menu_items m
    JOIN outlets o ON m.outlet_id = o.id
    JOIN menu_categories c ON m.category_id = c.id
    WHERE m.availability_status != 'HIDDEN'
  `;
  const params: any[] = [];

  if (outletId) {
    query += ' AND m.outlet_id = ?';
    params.push(outletId);
  }

  if (categoryId) {
    query += ' AND m.category_id = ?';
    params.push(categoryId);
  }

  if (diet === 'VEG') {
    query += " AND m.food_type = 'VEG'";
  } else if (diet === 'NON_VEG') {
    query += " AND m.food_type = 'NON_VEG'";
  }

  if (search) {
    query += ` AND (
      LOWER(m.item_name) LIKE ?
      OR LOWER(COALESCE(m.description, '')) LIKE ?
      OR LOWER(o.outlet_name) LIKE ?
      OR LOWER(c.category_name) LIKE ?
    )`;
    const wildcard = `%${search}%`;
    params.push(wildcard, wildcard, wildcard, wildcard);
  }

  query += ' ORDER BY m.outlet_id ASC, m.display_order ASC, m.id ASC';

  const rows = db.prepare(query).all(...params) as any[];

  // Process rows, safely parse JSON, compute Jain tag, and filter for Jain if requested
  const items = rows
    .map(i => {
      const tags = safeJsonArray(i.dietary_tags);
      const allergens = safeJsonArray(i.allergens);
      const isJain = tags.some(t => t.toUpperCase() === 'JAIN');
      const safeDesc = typeof i.description === 'string' ? i.description : '';

      return {
        id: i.id,
        outlet_id: i.outlet_id,
        outlet_name: i.outlet_name,
        category_id: i.category_id,
        category_name: i.category_name,
        name: i.item_name,
        item_name: i.item_name,
        description: safeDesc,
        price: Number(i.price) || 0,
        image_url: normalizeImageUrl(i.image_url),
        prep_minutes: i.preparation_time,
        preparation_time: i.preparation_time,
        dietary_type: i.food_type === 'NON_VEG' ? 'non_veg' : 'veg',
        food_type: i.food_type,
        is_jain: isJain,
        dietary_tags: tags,
        allergens: allergens,
        is_available: i.availability_status === 'AVAILABLE',
        availability_status: i.availability_status,
        available_quantity: i.stock_quantity,
        stock_quantity: i.stock_quantity,
        rating: i.rating || 4.8,
        is_popular: Boolean(i.is_popular),
        display_order: i.display_order || 0,
      };
    })
    .filter(item => {
      if (diet === 'JAIN') {
        return item.is_jain;
      }
      return true;
    });

  sendSuccess(res, items);
});

// 2. Single Food Item
menuRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid item ID required.');
    return;
  }

  const item = db.prepare(`
    SELECT m.*, o.outlet_name, c.category_name
    FROM menu_items m
    JOIN outlets o ON m.outlet_id = o.id
    JOIN menu_categories c ON m.category_id = c.id
    WHERE m.id = ?
  `).get(id) as any;

  if (!item) {
    sendError(res, 404, 'NOT_FOUND', 'Menu item not found.');
    return;
  }

  const tags = safeJsonArray(item.dietary_tags);
  const allergens = safeJsonArray(item.allergens);
  const isJain = tags.some(t => t.toUpperCase() === 'JAIN');

  sendSuccess(res, {
    ...item,
    name: item.item_name,
    description: typeof item.description === 'string' ? item.description : '',
    price: Number(item.price) || 0,
    image_url: normalizeImageUrl(item.image_url),
    prep_minutes: item.preparation_time,
    dietary_type: item.food_type === 'NON_VEG' ? 'non_veg' : 'veg',
    is_jain: isJain,
    dietary_tags: tags,
    allergens: allergens,
    is_available: item.availability_status === 'AVAILABLE',
    available_quantity: item.stock_quantity,
    is_popular: Boolean(item.is_popular),
  });
});

// 3. Create Menu Item
menuRouter.post('/', requireVendorOrAdmin, (req, res) => {
  const user = req.user!;
  const {
    outlet_id,
    category_id,
    name,
    item_name,
    description,
    price,
    image_url,
    food_type,
    dietary_type,
    dietary_tags,
    allergens,
    prep_minutes,
    preparation_time,
    stock_quantity,
    is_popular,
  } = req.body;

  const resolvedName = (item_name || name || '').trim();
  const resolvedPrice = Number(price);

  if (!outlet_id || !resolvedName || isNaN(resolvedPrice) || resolvedPrice < 0) {
    sendError(res, 400, 'BAD_REQUEST', 'outlet_id, name, and a valid non-negative price are required.');
    return;
  }

  // Permission check for vendors
  if (user.operational_role === 'VENDOR') {
    const ownsOutlet = db.prepare(`
      SELECT id FROM outlets WHERE id = ? AND (
        vendor_owner_id = ?
        OR id IN (SELECT outlet_id FROM outlet_staff WHERE user_id = ? AND status = 'ACTIVE')
      )
    `).get(outlet_id, user.id, user.id);
    if (!ownsOutlet) {
      sendError(res, 403, 'FORBIDDEN', 'You can only manage menu items for your assigned outlet.');
      return;
    }
  }

  const normalizedFoodType = (food_type || (dietary_type === 'non_veg' ? 'NON_VEG' : 'VEG')).toUpperCase();
  const prep = Number(preparation_time || prep_minutes) || 10;
  const stock = Number(stock_quantity) || 50;
  const defaultImg = normalizeImageUrl(image_url);

  const tagsArr = safeJsonArray(dietary_tags);
  const allergensArr = safeJsonArray(allergens);

  const result = db.prepare(`
    INSERT INTO menu_items (
      outlet_id, category_id, item_name, description, price, image_url,
      food_type, dietary_tags, allergens, preparation_time, availability_status,
      stock_quantity, is_popular
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?)
  `).run(
    outlet_id,
    category_id || 1,
    resolvedName,
    description || 'Freshly made on campus.',
    resolvedPrice,
    defaultImg,
    normalizedFoodType,
    JSON.stringify(tagsArr),
    JSON.stringify(allergensArr),
    prep,
    stock,
    is_popular ? 1 : 0
  );

  const created = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(result.lastInsertRowid) as any;
  sendSuccess(res, {
    ...created,
    name: created.item_name,
    prep_minutes: created.preparation_time,
    image_url: normalizeImageUrl(created.image_url),
    is_available: true,
    dietary_tags: tagsArr,
    allergens: allergensArr,
  }, 'Menu item created.', 201);
});

// 4. Update Menu Item
menuRouter.patch('/:id', requireVendorOrAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid menu item ID required.');
    return;
  }

  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as any;
  if (!existing) {
    sendError(res, 404, 'NOT_FOUND', 'Menu item not found.');
    return;
  }

  const {
    name,
    item_name,
    description,
    price,
    image_url,
    prep_minutes,
    preparation_time,
    food_type,
    category_id,
    stock_quantity,
    is_popular,
    dietary_tags,
    allergens,
    availability_status,
  } = req.body;

  const resolvedName = item_name || name;
  const prep = preparation_time !== undefined ? preparation_time : prep_minutes;
  const resolvedImg = image_url !== undefined ? normalizeImageUrl(image_url) : null;
  const resolvedTags = dietary_tags !== undefined ? JSON.stringify(safeJsonArray(dietary_tags)) : null;
  const resolvedAllergens = allergens !== undefined ? JSON.stringify(safeJsonArray(allergens)) : null;

  db.prepare(`
    UPDATE menu_items
    SET item_name = COALESCE(?, item_name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        image_url = COALESCE(?, image_url),
        category_id = COALESCE(?, category_id),
        preparation_time = COALESCE(?, preparation_time),
        food_type = COALESCE(?, food_type),
        stock_quantity = COALESCE(?, stock_quantity),
        is_popular = COALESCE(?, is_popular),
        dietary_tags = COALESCE(?, dietary_tags),
        allergens = COALESCE(?, allergens),
        availability_status = COALESCE(?, availability_status),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    resolvedName ? resolvedName.trim() : null,
    description !== undefined ? description : null,
    price !== undefined ? Number(price) : null,
    resolvedImg,
    category_id !== undefined ? Number(category_id) : null,
    prep !== undefined ? Number(prep) : null,
    food_type ? food_type.toUpperCase() : null,
    stock_quantity !== undefined ? Number(stock_quantity) : null,
    is_popular !== undefined ? (is_popular ? 1 : 0) : null,
    resolvedTags,
    resolvedAllergens,
    availability_status ? availability_status.toUpperCase() : null,
    id
  );

  const updated = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as any;
  sendSuccess(res, {
    ...updated,
    name: updated.item_name,
    image_url: normalizeImageUrl(updated.image_url),
    dietary_tags: safeJsonArray(updated.dietary_tags),
  }, 'Menu item updated.');
});

// 5. Toggle Availability (AVAILABLE / SOLD_OUT)
menuRouter.patch('/:id/availability', requireVendorOrAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid menu item ID required.');
    return;
  }

  const { is_available, status } = req.body;
  let newStatus = 'AVAILABLE';
  if (is_available !== undefined) {
    newStatus = is_available ? 'AVAILABLE' : 'SOLD_OUT';
  } else if (status) {
    newStatus = status.toUpperCase();
  }

  db.prepare(`
    UPDATE menu_items SET availability_status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(newStatus, id);

  sendSuccess(res, { id, is_available: newStatus === 'AVAILABLE', availability_status: newStatus }, 'Availability updated.');
});

// 6. Update Stock Quantity
menuRouter.patch('/:id/stock', requireVendorOrAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const stock = Number(req.body.stock_quantity);

  if (isNaN(id) || isNaN(stock) || stock < 0) {
    sendError(res, 400, 'BAD_REQUEST', 'stock_quantity must be a non-negative integer.');
    return;
  }

  db.prepare(`
    UPDATE menu_items
    SET stock_quantity = ?,
        availability_status = CASE WHEN ? = 0 THEN 'SOLD_OUT' ELSE 'AVAILABLE' END,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(stock, stock, id);

  sendSuccess(res, { id, stock_quantity: stock }, 'Stock quantity updated.');
});

// 7. Deactivate / Delete Item (Safe soft-delete via HIDDEN status)
menuRouter.delete('/:id', requireVendorOrAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid menu item ID required.');
    return;
  }

  db.prepare("UPDATE menu_items SET availability_status = 'HIDDEN', updated_at = datetime('now') WHERE id = ?").run(id);
  sendSuccess(res, { id, status: 'HIDDEN' }, 'Menu item deactivated.');
});
