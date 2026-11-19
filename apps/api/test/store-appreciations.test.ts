import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/http.js';
import { makeStoreAppreciationsRouter } from '../src/store-appreciations.js';

type FixtureOptions = { role?: 'guest' | 'student' | 'staff' | 'owner';
  verified?: boolean; hidden?: boolean; ready?: boolean; missingTable?: boolean };
function fixture(opts: FixtureOptions = {}) {
  const writes: string[] = [];
  const appreciated = new Set<number>();
  const model = {
    count: async () => { if (opts.missingTable) throw { code: 'P2021' }; return appreciated.size; },
    findUnique: async ({ where }: any) => appreciated.has(where.userId_sellerProfileId.userId) ? { userId: 11 } : null,
    upsert: async ({ create }: any) => { if (opts.missingTable) throw { code: 'P2021' }; writes.push('upsert'); appreciated.add(create.userId); },
    deleteMany: async ({ where }: any) => { writes.push('delete'); appreciated.delete(where.userId); },
  };
  const db: any = {
    sellerProfile: { findFirst: async () => opts.hidden ? null : { id: 4, ownerUserId: 22 } },
    affiliation: { findFirst: async () => opts.verified === false ? null : { id: 7 } },
    ...(opts.ready === false ? {} : { storeAppreciation: model }),
  };
  const app = express();
  app.use((req, _res, next) => {
    if (opts.role !== 'guest') {
      (req as any).user = { id: opts.role === 'owner' ? 22 : 11,
        roles: opts.role === 'staff' ? [{ role: 'campus_reviewer', campusId: 1 }] : [] };
    }
    next();
  });
  app.use(makeStoreAppreciationsRouter(db)); app.use(errorHandler);
  return { app, writes };
}

describe('store appreciation (synthetic only, no DB writes)', () => {
  test('public count does not expose names or identities', async () => {
    const h = fixture({ role: 'guest' });
    const r = await request(h.app).get('/seller-profiles/4/appreciations');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ available: true, count: 0, isAppreciated: false });
    expect(JSON.stringify(r.body)).not.toContain('userId');
  });
  test('repeat appreciate and undo are idempotent', async () => {
    const h = fixture();
    for (let i = 0; i < 2; i++) {
      const r = await request(h.app).put('/store-appreciations/4');
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ count: 1, isAppreciated: true });
    }
    for (let i = 0; i < 2; i++) {
      const r = await request(h.app).delete('/store-appreciations/4');
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ count: 0, isAppreciated: false });
    }
  });
  test('signed-out, staff, unverified and owner accounts cannot appreciate', async () => {
    for (const [opts, expected] of [
      [{ role: 'guest' }, 401],
      [{ role: 'staff' }, 403],
      [{ role: 'owner' }, 403],
      [{ verified: false }, 403],
    ] as const) {
      const h = fixture(opts);
      expect((await request(h.app).put('/store-appreciations/4')).status).toBe(expected);
      expect(h.writes).toEqual([]);
    }
  });
  test('unverified students can withdraw an earlier appreciation', async () => {
    const h = fixture({ verified: false });
    expect((await request(h.app).delete('/store-appreciations/4')).status).toBe(200);
  });
  test('hidden stores are not accessible even through appreciation routes', async () => {
    const h = fixture({ hidden: true });
    expect((await request(h.app).get('/seller-profiles/4/appreciations')).status).toBe(404);
    expect((await request(h.app).put('/store-appreciations/4')).status).toBe(404);
    expect(h.writes).toEqual([]);
  });
  test('unactivated migration never invents a zero count or allows writes', async () => {
    for (const opts of [{ ready: false }, { missingTable: true }]) {
      const h = fixture(opts);
      const result = await request(h.app).get('/seller-profiles/4/appreciations');
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ available: false, count: null, isAppreciated: false });
      expect((await request(h.app).put('/store-appreciations/4')).status).toBe(503);
      expect(h.writes).toEqual([]);
    }
  });
});
