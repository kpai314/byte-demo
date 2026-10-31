import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { sendError } from './responseContract';

export interface AuthenticatedUser {
  id: number;
  full_name: string;
  name?: string; // alias for frontend compatibility
  email: string;
  phone?: string;
  campus_id: number;
  user_category: 'STUDENT' | 'FACULTY' | 'NON_TEACHING_STAFF';
  operational_role: 'USER' | 'ADMIN' | 'VENDOR' | 'OUTLET_STAFF';
  role?: string; // lowercase alias for frontend compatibility ('user' | 'admin' | 'vendor' | 'outlet_staff')
  user_type?: string; // alias for frontend compatibility ('student' | 'staff')
  account_status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function getAuthUser(req: Request): AuthenticatedUser | null {
  const token = req.cookies?.byte_session ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!token) return null;
  const userId = parseInt(token, 10);
  if (isNaN(userId)) return null;

  const row = db.prepare(`
    SELECT id, full_name, email, phone, campus_id, user_category, operational_role, account_status
    FROM users
    WHERE id = ? AND account_status = 'ACTIVE'
  `).get(userId) as any;

  if (!row) return null;

  return {
    ...row,
    name: row.full_name,
    role: row.operational_role.toLowerCase(),
    user_type: row.user_category === 'STUDENT' ? 'student' : 'staff',
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication required. Please log in to your campus account.');
    return;
  }
  req.user = user;
  next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getAuthUser(req);
    if (!user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
      return;
    }
    const currentRole = user.operational_role.toUpperCase();
    const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());
    if (!normalizedAllowed.includes(currentRole)) {
      sendError(res, 403, 'FORBIDDEN', `Operation requires one of [${allowedRoles.join(', ')}] permissions.`);
      return;
    }
    req.user = user;
    next();
  };
}

export function requireVendorOrAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(['ADMIN', 'VENDOR', 'OUTLET_STAFF'])(req, res, next);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(['ADMIN'])(req, res, next);
}

export function requireOutletAccess(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
    return;
  }

  // Admins have platform-wide access
  if (user.operational_role === 'ADMIN') {
    req.user = user;
    next();
    return;
  }

  const outletId = parseInt(req.params.outletId || req.body.outlet_id, 10);
  if (isNaN(outletId)) {
    sendError(res, 400, 'BAD_REQUEST', 'Missing or invalid outlet_id parameter.');
    return;
  }

  // Check outlet vendor ownership or staff membership
  const outlet = db.prepare('SELECT vendor_owner_id FROM outlets WHERE id = ?').get(outletId) as any;
  if (!outlet) {
    sendError(res, 404, 'NOT_FOUND', 'Outlet not found.');
    return;
  }

  if (outlet.vendor_owner_id === user.id) {
    req.user = user;
    next();
    return;
  }

  const staff = db.prepare(`
    SELECT id FROM outlet_staff
    WHERE outlet_id = ? AND user_id = ? AND status = 'ACTIVE'
  `).get(outletId, user.id);

  if (staff) {
    req.user = user;
    next();
    return;
  }

  sendError(res, 403, 'FORBIDDEN', 'You do not have administrative access to this campus outlet.');
}
