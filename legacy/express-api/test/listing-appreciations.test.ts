import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/http.js';
import { makeListingAppreciationsRouter } from '../src/listing-appreciations.js';

type Case = { actor?: 'guest' | 'student' | 'owner' | 'staff'; verified?: boolean; missingTable?: boolean; missingClient?: boolean };
function fixture(options: Case = {}) {
  const records = new Set<string>();
  const userId = options.actor === 'owner' ? 20 : 10;
  const visible = [{ id: 1, seller: { ownerUserId: 20 } }, { id: 2, seller: { ownerUserId: 20 } }];
  const key = (u: number, l: number) => `${u}:${l}`;
  const db: any = {
    listing: {
      findFirst: async ({ where }: any) => visible.find(row => row.id === where.id) ?? null,
      findMany: async ({ where }: any) => visible.filter(row => where.id.in.includes(row.id)).map(row => ({ id: row.id })),
    },
    affiliation: { findFirst: async () => options.verified === false ? null : { id: 10 } },
    listingAppreciation: {
      groupBy: async ({ where }: any) => {
        if (options.missingTable) throw { code: 'P2021' };
        return where.listingId.in.map((listingId: number) => ({
          listingId, _count: { _all: [...records].filter(r => r.endsWith(':'+listingId)).length },
        }));
      },
      findMany: async ({ where }: any) => {
        if (options.missingTable) throw { code: 'P2021' };
        return where.listingId.in.filter((id: number) => records.has(key(where.userId, id))).map((id: number) => ({ listingId: id }));
      },
      upsert: async ({ create }: any) => {
        if (options.missingTable) throw { code: 'P2021' };
        records.add(key(create.userId, create.listingId));
      },
      deleteMany: async ({ where }: any) => {
        if (options.missingTable) throw { code: 'P2021' };
        records.delete(key(where.userId, where.listingId));
      },
    },
  };
  if (options.missingClient) delete db.listingAppreciation;
  const app = express();
  app.use((req, _res, next) => {
    if (options.actor !== 'guest') (req as any).user = { id: userId,
      roles: options.actor === 'staff' ? [{ role: 'campus_reviewer', campusId: 1 }] : [] };
    next();
  });
  app.use(makeListingAppreciationsRouter(db));
  app.use(errorHandler);
  return { app, records };
}

describe('listing appreciation is per listing (synthetic database)', () => {
  test('one student may appreciate two listings in the same store separately', async () => {
    const h = fixture({ actor: 'student' });
    expect((await request(h.app).put('/listing-appreciations/1')).body).toMatchObject({ count: 1, isAppreciated: true });
    expect((await request(h.app).put('/listing-appreciations/2')).body).toMatchObject({ count: 1, isAppreciated: true });
    expect((await request(h.app).put('/listing-appreciations/1')).body).toMatchObject({ count: 1, isAppreciated: true });
    expect(h.records.size).toBe(2);
    const batch = await request(h.app).get('/listing-appreciations?ids=1,2');
    expect(batch.body.summaries['1']).toMatchObject({ count: 1, isAppreciated: true });
    expect(batch.body.summaries['2']).toMatchObject({ count: 1, isAppreciated: true });
    await request(h.app).delete('/listing-appreciations/1');
    expect(h.records.size).toBe(1);
    expect((await request(h.app).get('/listings/2/appreciations')).body.count).toBe(1);
  });
  test('guest can read counts but not identities or appreciate', async () => {
    const h = fixture({ actor: 'guest' });
    const res = await request(h.app).get('/listing-appreciations?ids=1,2,999');
    expect(res.status).toBe(200);
    expect(res.body.summaries['1']).toEqual({ available: true, count: 0, isAppreciated: false });
    expect(res.body.summaries['999']).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('userId');
    expect((await request(h.app).put('/listing-appreciations/1')).status).toBe(401);
  });
  test('owner, staff, unverified students and hidden listings cannot receive an appreciation', async () => {
    for (const [options, id, expected] of [
      [{ actor: 'owner' }, 1, 403],
      [{ actor: 'staff' }, 1, 403],
      [{ actor: 'student', verified: false }, 1, 403],
      [{ actor: 'student' }, 999, 404],
    ] as const) {
      const h = fixture(options);
      expect((await request(h.app).put('/listing-appreciations/'+id)).status).toBe(expected);
      expect(h.records.size).toBe(0);
    }
  });
  test('withdrawal is allowed when affiliation expires', async () => {
    const h = fixture({ actor: 'student', verified: false });
    expect((await request(h.app).delete('/listing-appreciations/1')).status).toBe(200);
  });
  test('unactivated table or old generated Prisma client never fabricate counts', async () => {
    for (const options of [{ missingTable: true }, { missingClient: true }]) {
      const h = fixture({ actor: 'student', ...options });
      const result = await request(h.app).get('/listing-appreciations?ids=1');
      expect(result.body.summaries['1']).toEqual({ available: false, count: null, isAppreciated: false });
      expect((await request(h.app).put('/listing-appreciations/1')).status).toBe(503);
      expect(h.records.size).toBe(0);
    }
  });
});
