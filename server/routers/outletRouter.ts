import { Router } from 'express';
import { db, runTransaction } from '../db/database';
import { requireAdmin, requireVendorOrAdmin } from '../middleware/auth';
import { sendSuccess, sendError } from '../middleware/responseContract';

export const outletRouter = Router();

// List Outlets
outletRouter.get('/', (req, res) => {
  const includeInactive = req.query.include_inactive === 'true';
  const query = includeInactive
    ? 'SELECT * FROM outlets ORDER BY id ASC'
    : "SELECT * FROM outlets WHERE outlet_status = 'ACTIVE' ORDER BY id ASC";

  const rows = db.prepare(query).all() as any[];

  // Augment with table counts
  const result = rows.map(o => {
    const tableStats = db.prepare(`
      SELECT
        COUNT(*) as total_tables,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_tables
      FROM outlet_tables
      WHERE outlet_id = ?
    `).get(o.id) as any;

    return {
      id: o.id,
      name: o.outlet_name,
      outlet_name: o.outlet_name,
      slug: o.slug,
      description: o.description,
      location: o.location,
      opening_time: o.opening_time,
      closing_time: o.closing_time,
      status: o.outlet_status.toLowerCase(),
      outlet_status: o.outlet_status,
      crowd_level: o.crowd_level,
      avg_wait_min: o.avg_wait_min,
      available_tables: tableStats?.available_tables || 0,
      total_tables: tableStats?.total_tables || 0,
    };
  });

  sendSuccess(res, result);
});

// Get Single Outlet
outletRouter.get('/:id', (req, res) => {
  const outletId = parseInt(req.params.id, 10);
  const outlet = db.prepare('SELECT * FROM outlets WHERE id = ?').get(outletId) as any;
  if (!outlet) {
    sendError(res, 404, 'NOT_FOUND', 'Outlet not found.');
    return;
  }
  sendSuccess(res, {
    ...outlet,
    name: outlet.outlet_name,
    status: outlet.outlet_status.toLowerCase(),
  });
});

// Nested Menu for Outlet
outletRouter.get('/:outletId/menu', (req, res) => {
  const outletId = parseInt(req.params.outletId, 10);
  const outlet = db.prepare('SELECT * FROM outlets WHERE id = ?').get(outletId) as any;
  if (!outlet) {
    sendError(res, 404, 'NOT_FOUND', 'Outlet not found.');
    return;
  }

  const categories = db.prepare(`
    SELECT * FROM menu_categories
    WHERE outlet_id = ? AND is_active = 1
    ORDER BY display_order ASC, id ASC
  `).all(outletId) as any[];

  const result = categories.map(c => {
    const items = db.prepare(`
      SELECT * FROM menu_items
      WHERE category_id = ? AND availability_status != 'HIDDEN'
      ORDER BY display_order ASC, id ASC
    `).all(c.id) as any[];

    return {
      id: c.id,
      name: c.category_name,
      category_name: c.category_name,
      description: c.description,
      items: items.map(i => ({
        id: i.id,
        outlet_id: i.outlet_id,
        category_id: i.category_id,
        name: i.item_name,
        item_name: i.item_name,
        description: i.description,
        price: i.price,
        image_url: i.image_url,
        prep_minutes: i.preparation_time,
        preparation_time: i.preparation_time,
        dietary_type: i.food_type === 'NON_VEG' ? 'non_veg' : 'veg',
        food_type: i.food_type,
        is_jain: i.dietary_tags ? i.dietary_tags.includes('JAIN') : false,
        is_available: i.availability_status === 'AVAILABLE',
        availability_status: i.availability_status,
        available_quantity: i.stock_quantity,
        rating: i.rating,
        is_popular: Boolean(i.is_popular),
      })),
    };
  });

  sendSuccess(res, result);
});

// Admin: Create Outlet
outletRouter.post('/', requireAdmin, (req, res) => {
  const { outlet_name, slug, description, location, opening_time, closing_time, campus_id, vendor_owner_id } = req.body;
  if (!outlet_name || !location) {
    sendError(res, 400, 'BAD_REQUEST', 'outlet_name and location are required.');
    return;
  }

  const generatedSlug = slug || outlet_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const insert = db.prepare(`
    INSERT INTO outlets (campus_id, outlet_name, slug, description, location, opening_time, closing_time, outlet_status, vendor_owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
  `);

  const result = insert.run(
    campus_id || 1,
    outlet_name,
    generatedSlug,
    description || '',
    location,
    opening_time || '08:00',
    closing_time || '20:00',
    vendor_owner_id || null
  );

  const created = db.prepare('SELECT * FROM outlets WHERE id = ?').get(result.lastInsertRowid);
  sendSuccess(res, created, 'Outlet created successfully.', 201);
});

// Vendor/Admin: Update Outlet Details
outletRouter.patch('/:id', requireVendorOrAdmin, (req, res) => {
  const outletId = parseInt(req.params.id, 10);
  const { outlet_name, description, location, opening_time, closing_time, crowd_level, avg_wait_min } = req.body;

  const outlet = db.prepare('SELECT * FROM outlets WHERE id = ?').get(outletId);
  if (!outlet) {
    sendError(res, 404, 'NOT_FOUND', 'Outlet not found.');
    return;
  }

  db.prepare(`
    UPDATE outlets
    SET outlet_name = COALESCE(?, outlet_name),
        description = COALESCE(?, description),
        location = COALESCE(?, location),
        opening_time = COALESCE(?, opening_time),
        closing_time = COALESCE(?, closing_time),
        crowd_level = COALESCE(?, crowd_level),
        avg_wait_min = COALESCE(?, avg_wait_min),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(outlet_name, description, location, opening_time, closing_time, crowd_level, avg_wait_min, outletId);

  const updated = db.prepare('SELECT * FROM outlets WHERE id = ?').get(outletId);
  sendSuccess(res, updated, 'Outlet updated successfully.');
});

// Admin/Vendor: Change Outlet Status
outletRouter.patch('/:id/status', requireVendorOrAdmin, (req, res) => {
  const outletId = parseInt(req.params.id, 10);
  const { status } = req.body;
  const normalized = status ? status.toUpperCase() : 'ACTIVE';

  if (!['ACTIVE', 'CLOSED', 'MAINTENANCE'].includes(normalized)) {
    sendError(res, 400, 'BAD_REQUEST', 'Invalid status. Choose ACTIVE, CLOSED, or MAINTENANCE.');
    return;
  }

  db.prepare(`
    UPDATE outlets SET outlet_status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(normalized, outletId);

  sendSuccess(res, { id: outletId, status: normalized }, 'Outlet status updated.');
});
