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
import transactionRoutes from './routes/transactions.js';
import adminRoutes from './routes/admin.js';
import reviewerRoutes from './routes/reviewers.js';
import accountRoutes from './routes/account.js';
import pushRoutes from './routes/push.js';
import { makeStoreFollowRouter } from './store-follows.js';
import { prisma } from './db.js';

export function createApp() {
  const app = express();
  // Only the same-host production reverse proxy may supply a client address.
  app.set('trust proxy', env.NODE_ENV === 'production' ? 'loopback' : false);
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
  v1.use('/store-follows', makeStoreFollowRouter(prisma));
  v1.use(accountRoutes);
  v1.use('/push', pushRoutes);
  v1.use('/seller', sellerRoutes);
  v1.use('/inquiries', inquiryRoutes);
  v1.use('/transactions', transactionRoutes);
  v1.use('/admin/reviewers', reviewerRoutes);
  v1.use('/admin', adminRoutes);
  app.use('/api/v1', v1);
  app.use(errorHandler);
  return app;
}
