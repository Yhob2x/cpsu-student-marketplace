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
import { catalogAdminRoutes } from './routes/catalog-admin.js';
import homePageAdminRoutes from './routes/home-page-admin.js';
import homePagePublicRoutes from './routes/home-page-public.js';
import reviewerRoutes from './routes/reviewers.js';
import accountRoutes from './routes/account.js';
import pushRoutes from './routes/push.js';
import { makePublicStoreConnectionsRouter, makeStoreFollowRouter } from './store-follows.js';
import { prisma } from './db.js';
import { makeStoreReviewsRouter } from './store-reviews.js';
import { makeStoreAppreciationsRouter } from './store-appreciations.js';

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
  // Browsing and background reads must not starve logins or writes on a shared campus IP.
  // Keep both buckets bounded: 300 mutations/min and 900 reads/min per IP.
  // Health is inexpensive and must stay usable when a client hits either budget.
  app.use(rateLimit({ windowMs: 60_000, limit: 300, skip: req => req.method === 'GET' }));
  app.use(rateLimit({ windowMs: 60_000, limit: 900,
    skip: req => req.method !== 'GET' || req.path === '/health',
  }));
  app.use(authenticate);
  app.get('/health', (_req, res) => res.json({ ok: true }));
  const v1 = express.Router();
  v1.use('/auth', rateLimit({ windowMs: 15 * 60_000, limit: env.NODE_ENV === 'production' ? 30 : 300 }), authRoutes);
  v1.use(publicRoutes);
  v1.use(makePublicStoreConnectionsRouter(prisma));
  v1.use(makeStoreReviewsRouter(prisma));
  v1.use(makeStoreAppreciationsRouter(prisma));
  v1.use('/home-page', homePagePublicRoutes);
  v1.use('/store-follows', makeStoreFollowRouter(prisma));
  v1.use(accountRoutes);
  v1.use('/push', pushRoutes);
  v1.use('/seller', sellerRoutes);
  v1.use('/inquiries', inquiryRoutes);
  v1.use('/transactions', transactionRoutes);
  v1.use('/admin/reviewers', reviewerRoutes);
  v1.use('/admin/catalog', catalogAdminRoutes);
  v1.use('/admin/content/home-page', homePageAdminRoutes);
  v1.use('/admin', adminRoutes);
  app.use('/api/v1', v1);
  app.use(errorHandler);
  return app;
}
