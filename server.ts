import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { initializeDatabase } from './server/db/database';
import { seedDatabase } from './server/db/seed';

import { authRouter } from './server/routers/authRouter';
import { outletRouter } from './server/routers/outletRouter';
import { categoryRouter } from './server/routers/categoryRouter';
import { menuRouter } from './server/routers/menuRouter';
import { cartRouter } from './server/routers/cartRouter';
import { orderRouter } from './server/routers/orderRouter';
import { reservationRouter } from './server/routers/reservationRouter';
import { canteenStatusRouter } from './server/routers/canteenStatusRouter';
import { adminRouter } from './server/routers/adminRouter';
import { vendorRouter } from './server/routers/vendorRouter';
import { reviewRouter } from './server/routers/reviewRouter';
import { mediaRouter } from './server/routers/mediaRouter';
import { notificationRouter } from './server/routers/notificationRouter';
import { sendError } from './server/middleware/responseContract';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Initialize Relational Database & Seed Data
try {
  initializeDatabase();
  seedDatabase();
} catch (err) {
  console.error('[BYTE Database Init Error]', err);
}

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Static asset delivery for food images and campus media (Dev & Prod)
app.use('/images', express.static(path.resolve(__dirname, 'public/images')));
app.use('/public', express.static(path.resolve(__dirname, 'public')));
app.use('/src/assets/images', express.static(path.resolve(__dirname, 'public/images/food')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'BYTE Campus Food OS Relational API',
      version: '0.4.1',
      database: 'SQLite (WAL Mode, Foreign Keys Enforced)',
      campus: 'Dwarkadas J. Sanghvi College of Engineering (DJSCE)',
    },
    message: null,
  });
});

// Mount Routers with Dual Prefix Support (/api/v1 and /api)
const routers = [
  { path: '/auth', router: authRouter },
  { path: '/outlets', router: outletRouter },
  { path: '/categories', router: categoryRouter },
  { path: '/foods', router: menuRouter },
  { path: '/menu-items', router: menuRouter },
  { path: '/cart', router: cartRouter },
  { path: '/orders', router: orderRouter },
  { path: '/checkout', router: orderRouter },
  { path: '/tables', router: reservationRouter },
  { path: '/reservations', router: reservationRouter },
  { path: '/notifications', router: notificationRouter },
  { path: '/canteen-status', router: canteenStatusRouter },
  { path: '/admin', router: adminRouter },
  { path: '/vendor', router: vendorRouter },
  { path: '/reviews', router: reviewRouter },
  { path: '/media', router: mediaRouter },
];

for (const { path: routePath, router } of routers) {
  app.use(`/api/v1${routePath}`, router);
  app.use(`/api${routePath}`, router);
}

// Global Express Error Middleware (Never return raw stack or HTML)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[BYTE API Uncaught Error]', err);
  sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'A server error occurred. Please try again.');
});

// Server Configuration
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, host: HOST, port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`[BYTE Campus Food OS] Relational Backend active on http://${HOST}:${PORT}`);
  });
  return server;
}

export { startServer };

if (process.env.NODE_ENV !== 'test' && process.env.npm_lifecycle_event !== 'test') {
  startServer();
}
