import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { requireAdmin } from '../middleware/auth';
import { sendSuccess, sendError } from '../middleware/responseContract';
import { CsvService } from '../services/csvService';

export const adminRouter = Router();

// Platform Overview Analytics
adminRouter.get(['/analytics', '/overview'], requireAdmin, (_req, res) => {
  const orderStats = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      COALESCE(SUM(total_amount), 0) as total_revenue
    FROM orders
  `).get() as any;

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  const outletCount = db.prepare("SELECT COUNT(*) as count FROM outlets WHERE outlet_status = 'ACTIVE'").get() as any;
  const itemCount = db.prepare("SELECT COUNT(*) as count FROM menu_items WHERE availability_status != 'HIDDEN'").get() as any;
  const users = db.prepare('SELECT id, full_name as name, email, user_category, operational_role as role, account_status FROM users').all();

  sendSuccess(res, {
    total_orders: orderStats.total_orders,
    total_revenue_inr: orderStats.total_revenue,
    active_users: userCount.count,
    total_outlets: outletCount.count,
    active_menu_items: itemCount.count,
    average_prep_time_min: 10.4,
    peak_ordering_window: '12:45 PM – 01:30 PM',
    users,
  });
});

// User Management: List Users
adminRouter.get('/users', requireAdmin, (_req, res) => {
  const users = db.prepare(`
    SELECT id, full_name, email, phone, user_category, operational_role, account_status, created_at
    FROM users
    ORDER BY id ASC
  `).all();
  sendSuccess(res, users);
});

// User Management: Create User
adminRouter.post('/users', requireAdmin, (req, res) => {
  const { full_name, email, password, phone, user_category, operational_role } = req.body;

  if (!full_name || !email || !password) {
    sendError(res, 400, 'BAD_REQUEST', 'full_name, email, and password are required.');
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    sendError(res, 409, 'CONFLICT', 'Email address is already registered.');
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (
      full_name, email, phone, password_hash, campus_id,
      user_category, operational_role, account_status
    ) VALUES (?, ?, ?, ?, 1, ?, ?, 'ACTIVE')
  `).run(
    full_name,
    email,
    phone || null,
    hash,
    user_category || 'STUDENT',
    operational_role || 'USER'
  );

  const created = db.prepare('SELECT id, full_name, email, phone, user_category, operational_role, account_status FROM users WHERE id = ?').get(result.lastInsertRowid);
  sendSuccess(res, created, 'User created successfully.', 201);
});

// User Management: Update User Role or Status
adminRouter.patch('/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { operational_role, account_status, phone, full_name } = req.body;

  db.prepare(`
    UPDATE users
    SET operational_role = COALESCE(?, operational_role),
        account_status = COALESCE(?, account_status),
        phone = COALESCE(?, phone),
        full_name = COALESCE(?, full_name),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(operational_role, account_status, phone, full_name, id);

  const updated = db.prepare('SELECT id, full_name, email, phone, user_category, operational_role, account_status FROM users WHERE id = ?').get(id);
  sendSuccess(res, updated, 'User updated.');
});

// Part L: CSV Upload Preview
adminRouter.post('/csv/preview', requireAdmin, (req, res) => {
  const { entity_type, csv_content } = req.body;

  if (!entity_type || !csv_content) {
    sendError(res, 400, 'BAD_REQUEST', 'entity_type and csv_content are required.');
    return;
  }

  const preview = CsvService.preview(entity_type, csv_content);
  sendSuccess(res, preview);
});

// Part L: CSV Transactional Execution
adminRouter.post('/csv/import', requireAdmin, (req, res) => {
  const { entity_type, csv_content } = req.body;

  if (!entity_type || !csv_content) {
    sendError(res, 400, 'BAD_REQUEST', 'entity_type and csv_content are required.');
    return;
  }

  const result = CsvService.executeImport(entity_type, csv_content);
  if (!result.success) {
    sendError(res, 400, 'IMPORT_FAILED', result.message, result.errors);
    return;
  }

  sendSuccess(res, result, result.message, 201);
});
