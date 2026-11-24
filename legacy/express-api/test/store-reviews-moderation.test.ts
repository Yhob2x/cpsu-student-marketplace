import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/http.js';
import { makeStoreReviewsRouter } from '../src/store-reviews.js';

type State = 'pending' | 'published' | 'rejected' | 'hidden';
function fixture(options: { current?: State; campusId?: number; actorRole?: string; affected?: number } = {}) {
  const observed: Array<{ action: string; value: any }> = [];
  const current = options.current ?? 'pending';
  let status: State = current;
  const review = {
    findFirst: async ({ where }: any) => {
      observed.push({ action: 'find', value: where });
      if (where.store?.campusId?.in && !where.store.campusId.in.includes(options.campusId ?? 3)) return null;
      return { id: 8, status };
    },
    updateMany: async (args: any) => {
      observed.push({ action: 'update', value: args });
      if (args.where.status !== status) return { count: 0 };
      if (options.affected === 0) return { count: 0 };
      status = args.data.status;
      return { count: 1 };
    },
  };
  const db = {
    storeReview: review,
    $transaction: async (fn: (tx: any) => Promise<any>) => fn({
      storeReview: review,
      auditLog: { create: async ({ data }: any) => {
        observed.push({ action: 'audit', value: data });
        return { id: 4 };
      } },
    }),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = options.actorRole ?? 'campus_reviewer';
    (req as any).user = { id: 22, email: 'reviewer@example.test', displayName: 'Reviewer',
      roles: role === 'student' ? [] : [{ role, campusId: role === 'university_admin' ? null : 3 }] };
    next();
  });
  app.use(makeStoreReviewsRouter(db as any));
  app.use(errorHandler);
  return { app, observed, getStatus: () => status };
}
const body = (decision: string) => ({ decision, reason: 'Reviewed against campus content policy.' });

describe('store review moderation: synthetic-only, no database writes', () => {
  test('campus reviewer can approve pending review with a scoped conditional update and audit', async () => {
    const h = fixture();
    const res = await request(h.app).post('/admin/store-reviews/8/decision').send(body('published'));
    expect(res.status).toBe(200);
    expect(h.getStatus()).toBe('published');
    expect(h.observed.find(x => x.action === 'update')!.value.where).toEqual({
      id: 8, store: { campusId: { in: [3] } }, status: 'pending',
    });
    expect(h.observed.find(x => x.action === 'audit')!.value).toMatchObject({
      actorUserId: 22, action: 'store_review.published', targetType: 'store_review', targetId: 8,
    });
  });

  test('reviewer cannot read or moderate review from another campus', async () => {
    const h = fixture({ campusId: 7 });
    const res = await request(h.app).post('/admin/store-reviews/8/decision').send(body('published'));
    expect(res.status).toBe(404);
    expect(h.observed.map(x => x.action)).toEqual(['find']);
    expect(h.getStatus()).toBe('pending');
  });

  test('can reject pending or hide published reviews only', async () => {
    const rejected = fixture();
    expect((await request(rejected.app).post('/admin/store-reviews/8/decision').send(body('rejected'))).status).toBe(200);
    expect(rejected.getStatus()).toBe('rejected');
    const hidden = fixture({ current: 'published' });
    expect((await request(hidden.app).post('/admin/store-reviews/8/decision').send(body('hidden'))).status).toBe(200);
    expect(hidden.getStatus()).toBe('hidden');
  });

  test('invalid state transitions cannot write an update or an audit', async () => {
    for (const [current, decision] of [['pending','hidden'], ['published','published'], ['rejected','published']] as const) {
      const h = fixture({ current });
      const res = await request(h.app).post('/admin/store-reviews/8/decision').send(body(decision));
      expect(res.status).toBe(409);
      expect(h.observed.map(x => x.action)).toEqual(['find']);
    }
  });

  test('concurrent state changes fail closed before audit', async () => {
    const h = fixture({ affected: 0 });
    const res = await request(h.app).post('/admin/store-reviews/8/decision').send(body('published'));
    expect(res.status).toBe(409);
    expect(h.observed.some(x => x.action === 'audit')).toBe(false);
  });

  test('students and system admins cannot moderate', async () => {
    for (const role of ['student','system_admin']) {
      const h = fixture({ actorRole: role });
      const res = await request(h.app).post('/admin/store-reviews/8/decision').send(body('published'));
      expect(res.status).toBe(403);
      expect(h.observed).toEqual([]);
    }
  });

  test('global university admin uses the deliberate unrestricted review scope', async () => {
    const h = fixture({ actorRole: 'university_admin', campusId: 7 });
    const res = await request(h.app).post('/admin/store-reviews/8/decision').send(body('published'));
    expect(res.status).toBe(200);
    expect(h.observed.find(x => x.action === 'update')!.value.where).toEqual({ id: 8, status: 'pending' });
  });
});
