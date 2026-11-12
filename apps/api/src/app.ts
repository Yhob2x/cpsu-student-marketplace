import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './env.js';
import { authenticate } from './auth.js';
import { errorHandler } from './http.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import sellerRoutes from './routes/seller.js';
import inquiryRoutes from './routes/inquiries.js';
import adminRoutes from './routes/admin.js';
import accountRoutes from './routes/account.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // The responsive web/PWA uses the same-origin /api proxy. Only configured CORS origins are allowed.
  const origins = env.CORS_ORIGINS.split(',');
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 60_000, limit: 300 }));
  app.use(authenticate);
  app.get('/health', (_req, res) => res.json({ ok: true }));
  const v1 = express.Router();
  v1.use('/auth', rateLimit({ windowMs: 15 * 60_000, limit: env.NODE_ENV === 'production' ? 30 : 300 }), authRoutes);
  v1.use(publicRoutes);
  v1.use(accountRoutes);
  v1.use('/seller', sellerRoutes);
  v1.use('/inquiries', inquiryRoutes);
  v1.use('/admin', adminRoutes);
  app.use('/api/v1', v1);
  app.use(errorHandler);
  return app;
}
