import { Router } from 'express';
import { db, runTransaction } from '../db/database';
import { requireAuth } from '../middleware/auth';
import { sendSuccess, sendError } from '../middleware/responseContract';
import {
  getKolkataDate,
  getKolkataTime,
  addMinutesToTime,
  isValidDateFormat,
  isValidTimeFormat,
  isPastKolkata,
} from '../utils/kolkataTime';
import { createNotification } from '../services/notificationService';

export const reservationRouter = Router();

// Housekeeping helper: Expire past reservations in Asia/Kolkata
export function expireOverdueReservations() {
  const currentDate = getKolkataDate();
  const currentTime = getKolkataTime();

  // Mark expired reservations
  db.prepare(`
    UPDATE reservations
    SET reservation_status = 'EXPIRED', updated_at = datetime('now')
    WHERE reservation_status IN ('CONFIRMED', 'HELD')
      AND (
        reservation_date < ?
        OR (reservation_date = ? AND end_time < ?)
      )
  `).run(currentDate, currentDate, currentTime);

  // Free table status if no active current reservation
  db.prepare(`
    UPDATE outlet_tables
    SET status = 'available'
    WHERE status = 'reserved'
      AND id NOT IN (
        SELECT table_id FROM reservations
        WHERE reservation_status IN ('CONFIRMED', 'HELD')
          AND reservation_date = ?
          AND start_time <= ?
          AND end_time > ?
      )
  `).run(currentDate, currentTime, currentTime);
}

// 1. List Tables with Slot-Aware Availability (Never duplicates rows)
reservationRouter.get(['/', '/tables'], (req, res) => {
  expireOverdueReservations();

  const outletId = req.query.outlet_id ? parseInt(req.query.outlet_id as string, 10) : null;
  const reqDate = (req.query.reservation_date || req.query.date as string || getKolkataDate()).toString();
  const reqTime = (req.query.start_time || req.query.time as string || getKolkataTime()).toString();
  const durationMin = Math.min(60, Math.max(10, Number(req.query.duration_minutes) || 20));
  const reqEndTime = addMinutesToTime(reqTime, durationMin);

  let query = `
    SELECT
      t.id,
      t.outlet_id,
      t.table_number,
      t.capacity,
      t.location,
      t.status as physical_status,
      o.outlet_name
    FROM outlet_tables t
    JOIN outlets o ON t.outlet_id = o.id
  `;
  const params: any[] = [];

  if (outletId) {
    query += ' WHERE t.outlet_id = ?';
    params.push(outletId);
  }

  query += ' ORDER BY t.outlet_id ASC, t.table_number ASC';

  const tables = db.prepare(query).all(...params) as any[];

  // For each table, determine availability for the requested time slot
  const conflictStmt = db.prepare(`
    SELECT r.id, r.reservation_number, r.start_time, r.end_time, r.party_size, u.full_name as reserved_by
    FROM reservations r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.table_id = ?
      AND r.reservation_date = ?
      AND r.reservation_status IN ('CONFIRMED', 'HELD', 'SEATED', 'ACTIVE')
      AND r.start_time < ?
      AND r.end_time > ?
    LIMIT 1
  `);

  const result = tables.map(t => {
    const conflict = conflictStmt.get(t.id, reqDate, reqEndTime, reqTime) as any;

    let computedStatus = t.physical_status;
    if (t.physical_status === 'maintenance') {
      computedStatus = 'maintenance';
    } else if (conflict) {
      computedStatus = 'reserved';
    } else if (t.physical_status === 'occupied') {
      computedStatus = 'occupied';
    } else {
      computedStatus = 'available';
    }

    return {
      id: t.id,
      outlet_id: t.outlet_id,
      outlet_name: t.outlet_name,
      table_number: t.table_number,
      capacity: t.capacity,
      location: t.location,
      status: computedStatus,
      reserved_by: conflict?.reserved_by || undefined,
      expires_at: conflict?.end_time || undefined,
      reservation_slot: conflict ? {
        reservation_number: conflict.reservation_number,
        start_time: conflict.start_time,
        end_time: conflict.end_time,
      } : undefined,
    };
  });

  sendSuccess(res, result);
});

// 2. Table Availability Check Endpoint
reservationRouter.get('/availability', (req, res) => {
  expireOverdueReservations();

  const outletId = req.query.outlet_id ? parseInt(req.query.outlet_id as string, 10) : null;
  const dateStr = (req.query.reservation_date || req.query.date || getKolkataDate()).toString();
  const timeStr = (req.query.start_time || req.query.time || getKolkataTime()).toString();
  const durationMin = Math.min(60, Math.max(10, Number(req.query.duration_minutes) || 20));
  const partySize = Number(req.query.party_size) || 1;
  const endTimeStr = addMinutesToTime(timeStr, durationMin);

  let query = `
    SELECT t.*, o.outlet_name
    FROM outlet_tables t
    JOIN outlets o ON t.outlet_id = o.id
    WHERE t.status != 'maintenance'
      AND t.capacity >= ?
  `;
  const params: any[] = [partySize];

  if (outletId) {
    query += ' AND t.outlet_id = ?';
    params.push(outletId);
  }

  const candidateTables = db.prepare(query).all(...params) as any[];

  const conflictStmt = db.prepare(`
    SELECT id FROM reservations
    WHERE table_id = ?
      AND reservation_date = ?
      AND reservation_status IN ('CONFIRMED', 'HELD', 'SEATED', 'ACTIVE')
      AND start_time < ?
      AND end_time > ?
    LIMIT 1
  `);

  const availableTables = candidateTables.filter(t => {
    const conflict = conflictStmt.get(t.id, dateStr, endTimeStr, timeStr);
    return !conflict;
  });

  sendSuccess(res, {
    date: dateStr,
    start_time: timeStr,
    end_time: endTimeStr,
    party_size: partySize,
    available_tables_count: availableTables.length,
    tables: availableTables.map(t => ({
      id: t.id,
      outlet_id: t.outlet_id,
      outlet_name: t.outlet_name,
      table_number: t.table_number,
      capacity: t.capacity,
      location: t.location,
    })),
  });
});

// 3. Single Table Details
reservationRouter.get(['/:id', '/tables/:id'], (req, res, next) => {
  const idStr = req.params.id;
  if (['availability', 'mine'].includes(idStr)) {
    return next();
  }

  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid table ID required.');
    return;
  }

  const table = db.prepare(`
    SELECT t.*, o.outlet_name
    FROM outlet_tables t
    JOIN outlets o ON t.outlet_id = o.id
    WHERE t.id = ?
  `).get(id) as any;

  if (!table) {
    sendError(res, 404, 'NOT_FOUND', 'Table not found.');
    return;
  }

  sendSuccess(res, table);
});

// 4. Reserve a Table (Atomic Transaction & Time-Overlap Engine)
reservationRouter.post(['/:id/reserve', '/tables/:id/reserve', '/reserve', '/'], requireAuth, (req, res) => {
  expireOverdueReservations();

  const user = req.user!;
  const rawTableId = req.params.id || req.body.table_id;
  const tableId = parseInt(rawTableId, 10);

  if (isNaN(tableId)) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid table ID required.');
    return;
  }

  // Extract parameters
  const reservationDate = (req.body.reservation_date || req.body.date || getKolkataDate()).toString().trim();
  const startTime = (req.body.start_time || req.body.time || getKolkataTime()).toString().trim();
  const durationMinutes = Math.min(60, Math.max(10, Number(req.body.duration_minutes) || 20));
  const rawPartySize = req.body.party_size !== undefined ? req.body.party_size : 2;
  const partySize = Number(rawPartySize);
  const requestedOutletId = req.body.outlet_id ? parseInt(req.body.outlet_id, 10) : null;

  // Validation: Date and Time format
  if (!isValidDateFormat(reservationDate)) {
    sendError(res, 400, 'INVALID_DATE', 'Invalid reservation date format (expected YYYY-MM-DD).');
    return;
  }

  if (!isValidTimeFormat(startTime)) {
    sendError(res, 400, 'INVALID_TIME', 'Invalid start time format (expected HH:MM 24-hour).');
    return;
  }

  // Validation: Past date/time in Asia/Kolkata
  if (isPastKolkata(reservationDate, startTime, 1)) {
    sendError(res, 400, 'PAST_RESERVATION', 'Cannot book reservations in the past.');
    return;
  }

  // Validation: Positive party size
  if (isNaN(partySize) || partySize <= 0 || !Number.isInteger(partySize)) {
    sendError(res, 400, 'INVALID_PARTY_SIZE', 'Party size must be a positive integer.');
    return;
  }

  const endTime = addMinutesToTime(startTime, durationMinutes);

  try {
    const reservationResult = runTransaction(() => {
      // 1. Fetch table and outlet
      const table = db.prepare(`
        SELECT t.*, o.outlet_name, o.opening_time, o.closing_time, o.outlet_status
        FROM outlet_tables t
        JOIN outlets o ON t.outlet_id = o.id
        WHERE t.id = ?
      `).get(tableId) as any;

      if (!table) {
        const err: any = new Error('Table does not exist.');
        err.statusCode = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      if (table.status === 'maintenance') {
        const err: any = new Error(`Table ${table.table_number} is currently under maintenance.`);
        err.statusCode = 400;
        err.code = 'TABLE_UNAVAILABLE';
        throw err;
      }

      // Check outlet match if provided
      if (requestedOutletId && table.outlet_id !== requestedOutletId) {
        const err: any = new Error(`Table ${table.table_number} does not belong to the selected outlet.`);
        err.statusCode = 400;
        err.code = 'OUTLET_MISMATCH';
        throw err;
      }

      // Check outlet operating hours
      if (startTime < table.opening_time || endTime > table.closing_time) {
        const err: any = new Error(
          `Requested time ${startTime}-${endTime} is outside operating hours (${table.opening_time} - ${table.closing_time}) of ${table.outlet_name}.`
        );
        err.statusCode = 400;
        err.code = 'OUTLET_CLOSED';
        throw err;
      }

      // 2. Capacity validation: Party size must not exceed table capacity
      if (partySize > table.capacity) {
        const err: any = new Error(`Party size (${partySize}) exceeds table capacity (${table.capacity} seats).`);
        err.statusCode = 400;
        err.code = 'CAPACITY_EXCEEDED';
        throw err;
      }

      // 3. Time Overlap Detection:
      // Conflict exists if: existing_start < requested_end AND existing_end > requested_start
      const conflict = db.prepare(`
        SELECT id, reservation_number, start_time, end_time, party_size
        FROM reservations
        WHERE table_id = ?
          AND reservation_date = ?
          AND reservation_status IN ('CONFIRMED', 'HELD', 'SEATED', 'ACTIVE')
          AND start_time < ?
          AND end_time > ?
        LIMIT 1
      `).get(tableId, reservationDate, endTime, startTime) as any;

      if (conflict) {
        const err: any = new Error(
          `Table ${table.table_number} is already reserved for an overlapping slot (${conflict.start_time} - ${conflict.end_time}). Please pick a different slot or table.`
        );
        err.statusCode = 409;
        err.code = 'RESERVATION_CONFLICT';
        throw err;
      }

      // 4. Generate unique reservation number
      const resNum = 'RES-' + Math.floor(10000 + Math.random() * 90000).toString();

      // 5. Insert reservation record
      const insert = db.prepare(`
        INSERT INTO reservations (
          reservation_number, user_id, outlet_id, table_id,
          reservation_date, start_time, end_time, duration_minutes, party_size, reservation_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', datetime('now'), datetime('now'))
      `).run(
        resNum,
        user.id,
        table.outlet_id,
        tableId,
        reservationDate,
        startTime,
        endTime,
        durationMinutes,
        partySize
      );

      const reservationId = Number(insert.lastInsertRowid);

      // 6. If reservation is for immediate active current window, mark table status 'reserved'
      const curDate = getKolkataDate();
      const curTime = getKolkataTime();
      if (reservationDate === curDate && startTime <= curTime && endTime > curTime) {
        db.prepare("UPDATE outlet_tables SET status = 'reserved' WHERE id = ?").run(tableId);
      }

      // 7. Dispatch Notification for student
      createNotification(
        user.id,
        'Table Reserved',
        `Table ${table.table_number} reserved at ${table.outlet_name} for ${reservationDate} (${startTime}–${endTime}, ${partySize} guests). Ref: ${resNum}.`,
        'reservation'
      );

      return {
        id: reservationId,
        reservation_number: resNum,
        user_id: user.id,
        outlet_id: table.outlet_id,
        outlet_name: table.outlet_name,
        table_id: table.id,
        table_number: table.table_number,
        reservation_date: reservationDate,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        party_size: partySize,
        status: 'CONFIRMED',
        reservation_status: 'CONFIRMED',
        table: {
          id: table.id,
          outlet_id: table.outlet_id,
          outlet_name: table.outlet_name,
          table_number: table.table_number,
          capacity: table.capacity,
          location: table.location,
          status: 'reserved',
          reserved_by: user.full_name,
          expires_at: endTime,
          reservation_date: reservationDate,
          start_time: startTime,
          end_time: endTime,
        },
      };
    });

    sendSuccess(
      res,
      reservationResult,
      `Table ${reservationResult.table_number} successfully reserved for ${reservationDate} from ${startTime} to ${endTime}.`,
      201
    );
  } catch (err: any) {
    const statusCode = err.statusCode || (err.code === 'RESERVATION_CONFLICT' ? 409 : 400);
    const errorCode = err.code || 'RESERVATION_FAILED';
    sendError(res, statusCode, errorCode, err.message || 'Could not complete reservation.');
  }
});

// 5. Cancel / Release Table Reservation
reservationRouter.all(['/:id/cancel', '/tables/:id/cancel', '/reservations/:id/cancel'], requireAuth, (req, res) => {
  const user = req.user!;
  const targetId = parseInt(req.params.id, 10);

  if (isNaN(targetId)) {
    sendError(res, 400, 'BAD_REQUEST', 'Valid table ID or reservation ID required.');
    return;
  }

  const isTableCancel = req.originalUrl.includes('/tables/') || req.baseUrl.endsWith('/tables');

  try {
    const result = runTransaction(() => {
      let reservation: any = null;

      if (isTableCancel) {
        // targetId is table_id
        const isElevated = user.operational_role === 'ADMIN' || user.operational_role === 'VENDOR' || user.operational_role === 'OUTLET_STAFF';
        const query = isElevated
          ? `SELECT r.*, t.table_number, o.outlet_name
             FROM reservations r
             JOIN outlet_tables t ON r.table_id = t.id
             JOIN outlets o ON r.outlet_id = o.id
             WHERE r.table_id = ? AND r.reservation_status IN ('CONFIRMED', 'HELD')
             ORDER BY r.id DESC`
          : `SELECT r.*, t.table_number, o.outlet_name
             FROM reservations r
             JOIN outlet_tables t ON r.table_id = t.id
             JOIN outlets o ON r.outlet_id = o.id
             WHERE r.table_id = ? AND r.user_id = ? AND r.reservation_status IN ('CONFIRMED', 'HELD')
             ORDER BY r.id DESC`;

        const params = isElevated ? [targetId] : [targetId, user.id];
        const activeList = db.prepare(query).all(...params) as any[];

        if (activeList.length > 0) {
          for (const r of activeList) {
            db.prepare(`
              UPDATE reservations
              SET reservation_status = 'CANCELLED', updated_at = datetime('now')
              WHERE id = ?
            `).run(r.id);
          }
          reservation = activeList[0];
        } else {
          const table = db.prepare('SELECT * FROM outlet_tables WHERE id = ?').get(targetId) as any;
          if (table) {
            db.prepare("UPDATE outlet_tables SET status = 'available' WHERE id = ?").run(targetId);
            return { success: true, table: { ...table, status: 'available' } };
          }
          const err: any = new Error('No active reservation found for this table.');
          err.statusCode = 404;
          throw err;
        }
      } else {
        // targetId is reservation_id
        reservation = db.prepare(`
          SELECT r.*, t.table_number, o.outlet_name
          FROM reservations r
          JOIN outlet_tables t ON r.table_id = t.id
          JOIN outlets o ON r.outlet_id = o.id
          WHERE r.id = ?
        `).get(targetId) as any;

        if (!reservation) {
          const err: any = new Error('Reservation not found.');
          err.statusCode = 404;
          throw err;
        }

        if (user.operational_role === 'USER' && reservation.user_id !== user.id) {
          const err: any = new Error('You do not have permission to cancel this reservation.');
          err.statusCode = 403;
          throw err;
        }

        db.prepare(`
          UPDATE reservations
          SET reservation_status = 'CANCELLED', updated_at = datetime('now')
          WHERE id = ?
        `).run(reservation.id);
      }

      // Check if table status needs to be freed
      const curDate = getKolkataDate();
      const curTime = getKolkataTime();
      const otherActive = db.prepare(`
        SELECT id FROM reservations
        WHERE table_id = ?
          AND reservation_status IN ('CONFIRMED', 'HELD')
          AND reservation_date = ?
          AND start_time <= ?
          AND end_time > ?
      `).get(reservation.table_id, curDate, curTime, curTime);

      if (!otherActive) {
        db.prepare("UPDATE outlet_tables SET status = 'available' WHERE id = ?").run(reservation.table_id);
      }

      const updatedTable = db.prepare('SELECT * FROM outlet_tables WHERE id = ?').get(reservation.table_id) as any;

      createNotification(
        reservation.user_id,
        'Reservation Cancelled',
        `Reservation ${reservation.reservation_number} for Table ${reservation.table_number} has been cancelled.`,
        'reservation'
      );

      return {
        success: true,
        reservation_id: reservation.id,
        reservation_number: reservation.reservation_number,
        table: updatedTable,
      };
    });

    sendSuccess(res, result, 'Reservation successfully cancelled.');
  } catch (err: any) {
    sendError(res, err.statusCode || 400, 'CANCEL_FAILED', err.message || 'Could not cancel reservation.');
  }
});

// 6. User's Own Active & Past Reservations
reservationRouter.get('/mine', requireAuth, (req, res) => {
  expireOverdueReservations();

  const user = req.user!;
  const rows = db.prepare(`
    SELECT
      r.*,
      t.table_number,
      t.capacity,
      t.location,
      o.outlet_name
    FROM reservations r
    JOIN outlet_tables t ON r.table_id = t.id
    JOIN outlets o ON r.outlet_id = o.id
    WHERE r.user_id = ?
    ORDER BY r.reservation_date DESC, r.start_time DESC
  `).all(user.id) as any[];

  const result = rows.map(r => ({
    id: r.id,
    reservation_number: r.reservation_number,
    user_id: r.user_id,
    outlet_id: r.outlet_id,
    outlet_name: r.outlet_name,
    table_id: r.table_id,
    table_number: r.table_number,
    capacity: r.capacity,
    location: r.location,
    reservation_date: r.reservation_date,
    start_time: r.start_time,
    end_time: r.end_time,
    duration_minutes: r.duration_minutes || 20,
    party_size: r.party_size,
    status: r.reservation_status,
    reservation_status: r.reservation_status,
    created_at: r.created_at,
  }));

  sendSuccess(res, result);
});

// 7. Get All Reservations (for vendor/admin)
reservationRouter.get('/', requireAuth, (req, res) => {
  expireOverdueReservations();

  const user = req.user!;
  const outletId = req.query.outlet_id ? parseInt(req.query.outlet_id as string, 10) : null;
  const dateStr = req.query.date as string;

  let query = `
    SELECT
      r.*,
      t.table_number,
      t.capacity,
      t.location,
      o.outlet_name,
      u.full_name,
      u.email
    FROM reservations r
    JOIN outlet_tables t ON r.table_id = t.id
    JOIN outlets o ON r.outlet_id = o.id
    JOIN users u ON r.user_id = u.id
  `;
  const params: any[] = [];
  const conditions: string[] = [];

  if (user.operational_role === 'USER') {
    conditions.push('r.user_id = ?');
    params.push(user.id);
  } else if (outletId) {
    conditions.push('r.outlet_id = ?');
    params.push(outletId);
  }

  if (dateStr) {
    conditions.push('r.reservation_date = ?');
    params.push(dateStr);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY r.reservation_date DESC, r.start_time DESC LIMIT 100';

  const rows = db.prepare(query).all(...params) as any[];
  sendSuccess(res, rows);
});

// 8. Update Reservation Status
reservationRouter.patch('/:id/status', requireAuth, (req, res) => {
  const user = req.user!;
  const id = parseInt(req.params.id, 10);
  const nextStatus = (req.body.status || '').toUpperCase();

  const allowedStatuses = ['CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
  if (!allowedStatuses.includes(nextStatus)) {
    sendError(res, 400, 'BAD_REQUEST', `Status must be one of [${allowedStatuses.join(', ')}].`);
    return;
  }

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id) as any;
  if (!reservation) {
    sendError(res, 404, 'NOT_FOUND', 'Reservation not found.');
    return;
  }

  if (user.operational_role === 'USER' && reservation.user_id !== user.id) {
    sendError(res, 403, 'FORBIDDEN', 'Access denied.');
    return;
  }

  db.prepare(`
    UPDATE reservations
    SET reservation_status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(nextStatus, id);

  if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(nextStatus)) {
    db.prepare("UPDATE outlet_tables SET status = 'available' WHERE id = ?").run(reservation.table_id);
  }

  sendSuccess(res, { id, status: nextStatus, reservation_status: nextStatus }, `Reservation updated to ${nextStatus}.`);
});
