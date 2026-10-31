import { Router } from 'express';
import { db } from '../db/database';
import { requireVendorOrAdmin } from '../middleware/auth';
import { sendSuccess, sendError } from '../middleware/responseContract';

export const mediaRouter = Router();

// List Media Assets
mediaRouter.get('/', (req, res) => {
  const outletId = req.query.outlet_id ? parseInt(req.query.outlet_id as string, 10) : null;
  let query = 'SELECT * FROM media_assets';
  const params: any[] = [];

  if (outletId) {
    query += ' WHERE outlet_id = ?';
    params.push(outletId);
  }
  query += ' ORDER BY id DESC';

  const rows = db.prepare(query).all(...params);
  sendSuccess(res, rows);
});

// Register Media Asset Metadata
mediaRouter.post('/', requireVendorOrAdmin, (req, res) => {
  const { outlet_id, media_type, media_url, thumbnail_url, alt_text, title, duration_seconds } = req.body;

  if (!media_url) {
    sendError(res, 400, 'BAD_REQUEST', 'media_url is required.');
    return;
  }

  const result = db.prepare(`
    INSERT INTO media_assets (
      outlet_id, media_type, media_url, thumbnail_url, alt_text, title, duration_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    outlet_id || null,
    media_type || 'IMAGE',
    media_url,
    thumbnail_url || null,
    alt_text || '',
    title || 'Campus Asset',
    duration_seconds || 0
  );

  const created = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(result.lastInsertRowid);
  sendSuccess(res, created, 'Media asset registered.', 201);
});
