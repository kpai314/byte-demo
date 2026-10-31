import { Router } from 'express';
import { db } from '../db/database';
import { sendSuccess } from '../middleware/responseContract';

export const canteenStatusRouter = Router();

canteenStatusRouter.get(['/', '/canteen-status'], (_req, res) => {
  const outlets = db.prepare(`
    SELECT id, outlet_name as name, location, crowd_level, avg_wait_min, outlet_status as status
    FROM outlets
    WHERE outlet_status = 'ACTIVE'
  `).all() as any[];

  const tableStats = db.prepare(`
    SELECT
      COUNT(*) as total_tables,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_tables
    FROM outlet_tables
  `).get() as any;

  const avgWait = outlets.length
    ? Math.round(outlets.reduce((acc, o) => acc + (o.avg_wait_min || 10), 0) / outlets.length)
    : 10;

  const result = {
    campus: 'DJSCE, Mumbai',
    crowd_level: 'MODERATE',
    average_wait_minutes: avgWait,
    available_tables: tableStats?.available_tables || 0,
    total_tables: tableStats?.total_tables || 0,
    active_outlets_count: outlets.length,
    rush_period: '12:30 PM – 02:00 PM',
    outlets,
  };

  sendSuccess(res, result);
});
