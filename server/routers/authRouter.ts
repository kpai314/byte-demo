import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { requireAuth } from '../middleware/auth';
import { sendSuccess, sendError } from '../middleware/responseContract';

export const authRouter = Router();

// Login
authRouter.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    sendError(res, 400, 'BAD_REQUEST', 'Email and password are required.');
    return;
  }

  const user = db.prepare(`
    SELECT id, full_name, email, phone, password_hash, campus_id, user_category, operational_role, account_status
    FROM users
    WHERE LOWER(email) = LOWER(?)
  `).get(email) as any;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    sendError(res, 401, 'INVALID_CREDENTIALS', 'Incorrect campus email or password.');
    return;
  }

  if (user.account_status !== 'ACTIVE') {
    sendError(res, 403, 'ACCOUNT_INACTIVE', `Your account is ${user.account_status.toLowerCase()}. Please contact campus administration.`);
    return;
  }

  // Set secure HTTP-only session cookie
  res.cookie('byte_session', user.id.toString(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // set to true in HTTPS production
    maxAge: 43200 * 1000, // 12 hours
  });

  const payload = {
    id: user.id,
    name: user.full_name,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.operational_role.toLowerCase(),
    operational_role: user.operational_role,
    user_type: user.user_category === 'STUDENT' ? 'student' : 'staff',
    user_category: user.user_category,
    campus_id: user.campus_id,
  };

  sendSuccess(res, payload, 'Sign-in successful.');
});

// Logout
authRouter.post('/logout', (_req, res) => {
  res.clearCookie('byte_session');
  sendSuccess(res, { ok: true }, 'Successfully logged out.');
});

// Current User Profile
authRouter.get('/me', requireAuth, (req, res) => {
  const user = req.user!;
  const payload = {
    id: user.id,
    name: user.full_name,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.operational_role.toLowerCase(),
    operational_role: user.operational_role,
    user_type: user.user_category === 'STUDENT' ? 'student' : 'staff',
    user_category: user.user_category,
    campus_id: user.campus_id,
  };
  sendSuccess(res, payload);
});

// Password Reset Flow
authRouter.post('/reset-password', (req, res) => {
  const { email, new_password } = req.body;
  if (!email || !new_password || new_password.length < 6) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid email and a password of at least 6 characters are required.');
    return;
  }

  const user = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email) as any;
  if (!user) {
    sendError(res, 404, 'NOT_FOUND', 'Campus account not found.');
    return;
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare(`
    UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
  `).run(newHash, user.id);

  sendSuccess(res, { success: true }, 'Password reset successfully.');
});
