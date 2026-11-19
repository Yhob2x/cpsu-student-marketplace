import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/http.js';
import { makeStoreReviewsRouter } from '../src/store-reviews.js';

type Options = { storeHidden?: boolean; enabled?: boolean; completed?: boolean;
  affiliation?: boolean; duplicate?: boolean; role?: 'student' | 'reviewer' | 'admin' };
function fixture(opts: Options = {}) {
  const queries: { op: string; args: any }[] = [];
  const record = (op: string, args: any) => { queries.push({ op, args }); };
  const review = { id: 8, transactionId: 31, sellerProfileId: 2, buyerUserId: 11,
    rating: 5, body: 'Great communication', status: 'pending',
    createdAt: new Date('2026-11-18T02:00:00Z'), moderatedAt: null, moderationReason: null };
  const model = {
    aggregate: async (args: any) => { record('aggregate', args); return { _avg: { rating: 4.5 }, _count: { _all: 2 } }; },
    groupBy: async (args: any) => { record('groupBy', args); return [{ rating: 4, _count: { _all: 1 } }, { rating: 5, _count: { _all: 1 } }]; },
    findMany: async (args: any) => { record('findMany', args); return [{ id: 4, rating: 4, body: 'Nice', createdAt: new Date() }]; },
    findFirst: async (args: any) => { record('review.findFirst', args); return null; },
    create: async (args: any) => { record('review.create', args); if (opts.duplicate) throw { code: 'P2002' }; return review; },
    updateMany: async (args: any) => { record('review.updateMany', args); return { count: 1 }; },
  };
  const tx = {
    transaction: { findFirst: async (args: any) => {
      record('tx.transaction.findFirst', args);
      return opts.completed === false ? null : { id: 31, sellerUserId: 12,
        status: 'completed', listing: { sellerProfileId: 2 } };
    } },
    storeReview: model,
    auditLog: { create: async (args: any) => { record('audit', args); return { id: 1 }; } },
  };
  const db = {
    sellerProfile: { findFirst: async (args: any) => { record('store.findFirst', args);
      return opts.storeHidden ? null : { id: 2, ownerUserId: 12 }; } },
    transaction: tx.transaction,
    affiliation: { findFirst: async (args: any) => { record('affiliation.findFirst', args);
      return opts.affiliation === false ? null : { id: 9 }; } },
    ...(opts.enabled === false ? {} : { storeReview: model }),
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(tx),
  };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    const role = opts.role || 'student';
    (req as any).user = { id: role === 'student' ? 11 : 30,
      email: 'qa@example.test', displayName: 'Synthetic QA',
      roles: role === 'student' ? [] : role === 'reviewer'
        ? [{ role: 'campus_reviewer', campusId: 3 }]
        : [{ role: 'system_admin', campusId: null }] };
    next();
  });
  app.use(makeStoreReviewsRouter(db as any)); app.use(errorHandler);
  return { app, queries };
}

describe('store reviews (synthetic, no database writes)', () => {
  test('public reads show only approved review fields and actual aggregate', async () => {
    const { app, queries } = fixture();
    const res = await request(app).get('/seller-profiles/2/reviews');
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ count: 2, average: 4.5,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 } });
    expect(queries.find(x => x.op === 'groupBy')!.args.where).toEqual({ sellerProfileId: 2, status: 'published' });
    const q = queries.find(x => x.op === 'findMany')!.args;
    expect(q.where).toEqual({ sellerProfileId: 2, status: 'published' });
    expect(Object.keys(q.select)).toEqual(['id', 'rating', 'body', 'createdAt']);
    expect(JSON.stringify(res.body)).not.toContain('buyerUserId');
    expect(JSON.stringify(res.body)).not.toContain('email');
  });
  test('hidden stores are 404 and feature-disabled stores do not invent zero ratings', async () => {
    expect((await request(fixture({ storeHidden: true }).app).get('/seller-profiles/2/reviews')).status).toBe(404);
    const inactive = await request(fixture({ enabled: false }).app).get('/seller-profiles/2/reviews');
    expect(inactive.body).toEqual({ available: false, summary: null, items: [], page: 1, pageSize: 8 });
  });
  test('cannot review without a completed transaction and verified affiliation', async () => {
    expect((await request(fixture({ completed: false }).app)
      .post('/transactions/31/store-review').send({ rating: 4 })).status).toBe(404);
    expect((await request(fixture({ affiliation: false }).app)
      .post('/transactions/31/store-review').send({ rating: 4 })).status).toBe(403);
    expect((await request(fixture({ role: 'reviewer' }).app)
      .post('/transactions/31/store-review').send({ rating: 4 })).status).toBe(403);
  });
  test('review eligibility reflects verified affiliation, not only transaction status', async () => {
    const verified = await request(fixture().app).get('/transactions/31/store-review');
    const unverified = await request(fixture({ affiliation: false }).app).get('/transactions/31/store-review');
    expect(verified.body.eligible).toBe(true);
    expect(unverified.body.eligible).toBe(false);
    expect(unverified.body.available).toBe(true);
  });
  test('completed buyer review is pending moderation and audit-logged', async () => {
    const h = fixture();
    const res = await request(h.app).post('/transactions/31/store-review')
      .send({ rating: 5, body: '  Great communication  ' });
    expect(res.status).toBe(201);
    const created = h.queries.find(x => x.op === 'review.create')!.args;
    expect(created.data).toEqual({ transactionId: 31, sellerProfileId: 2, buyerUserId: 11,
      rating: 5, body: 'Great communication', status: 'pending' });
    expect(h.queries.some(x => x.op === 'audit')).toBe(true);
  });
  test('duplicate reviews fail closed', async () => {
    const res = await request(fixture({ duplicate: true }).app)
      .post('/transactions/31/store-review').send({ rating: 5 });
    expect(res.status).toBe(409);
  });
  test('only campus reviewers can inspect moderator queue', async () => {
    expect((await request(fixture({ role: 'student' }).app)
      .get('/admin/store-reviews')).status).toBe(403);
    const h = fixture({ role: 'reviewer' });
    expect((await request(h.app).get('/admin/store-reviews')).status).toBe(200);
    const q = h.queries.find(x => x.op === 'findMany')!.args;
    expect(q.where).toEqual({ status: 'pending', store: { campusId: { in: [3] } } });
  });
});
