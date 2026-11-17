import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/http.js';
import { makeStoreFollowRouter, readStoreFollowSummary } from '../src/store-follows.js';

const student = { id: 8, email: 'student@example.invalid', displayName: 'Student', roles: [] };
const reviewer = { id: 11, email: 'reviewer@example.invalid', displayName: 'Reviewer',
  roles: [{ role: 'campus_reviewer', campusId: 1 }] };
const missingTable = Object.assign(new Error('Table missing'), { code: 'P2021' });

function harness(options: { actor?: typeof student | typeof reviewer | null; ownerId?: number;
  storeExists?: boolean; missing?: boolean } = {}) {
  const follows = new Set<string>();
  let mutations = 0;
  const storeId = 19;
  const makeKey = (userId: number, sellerProfileId: number) => `${userId}:${sellerProfileId}`;
  const db = {
    sellerProfile: { findFirst: async () => options.storeExists === false ? null :
      { id: storeId, ownerUserId: options.ownerId ?? 60 } },
    storeFollow: {
      count: async () => { if (options.missing) throw missingTable; return follows.size; },
      findUnique: async ({ where }: any) => {
        if (options.missing) throw missingTable;
        return follows.has(makeKey(where.userId_sellerProfileId.userId, where.userId_sellerProfileId.sellerProfileId))
          ? { userId: where.userId_sellerProfileId.userId } : null;
      },
      upsert: async ({ create }: any) => {
        if (options.missing) throw missingTable;
        mutations++; follows.add(makeKey(create.userId, create.sellerProfileId));
      },
      deleteMany: async ({ where }: any) => {
        if (options.missing) throw missingTable;
        mutations++; follows.delete(makeKey(where.userId, where.sellerProfileId));
      },
    },
  };
  const app = express();
  app.use((req, _res, next) => {
    const actor = options.actor === undefined ? student : options.actor;
    if (actor) req.user = actor as any;
    next();
  });
  app.use('/store-follows', makeStoreFollowRouter(db as any));
  app.use(errorHandler);
  return { app, db, follows, mutations: () => mutations };
}

describe('store follows (synthetic database, no live writes)', () => {
  test('follow and unfollow are idempotent, count changes only once', async () => {
    const h = harness();
    const put = () => request(h.app).put('/store-follows/19');
    expect((await put()).body).toEqual({ count: 1, isFollowing: true });
    expect((await put()).body).toEqual({ count: 1, isFollowing: true });
    expect((await request(h.app).delete('/store-follows/19')).body)
      .toEqual({ count: 0, isFollowing: false });
    expect((await request(h.app).delete('/store-follows/19')).body)
      .toEqual({ count: 0, isFollowing: false });
  });
  test('signed-out and staff attempts fail before any write', async () => {
    for (const actor of [null, reviewer]) {
      const h = harness({ actor });
      expect((await request(h.app).put('/store-follows/19')).status).toBe(actor ? 403 : 401);
      expect((await request(h.app).delete('/store-follows/19')).status).toBe(actor ? 403 : 401);
      expect(h.mutations()).toBe(0);
    }
  });
  test('owner cannot follow own store', async () => {
    const h = harness({ ownerId: 8 });
    expect((await request(h.app).put('/store-follows/19')).status).toBe(400);
    expect(h.mutations()).toBe(0);
  });
  test('non-existent or invalid store cannot be followed', async () => {
    const h = harness({ storeExists: false });
    expect((await request(h.app).put('/store-follows/19')).status).toBe(404);
    expect((await request(h.app).put('/store-follows/-1')).status).toBe(400);
    expect(h.mutations()).toBe(0);
  });
  test('unmigrated table is unavailable, never displayed as zero followers', async () => {
    const h = harness({ missing: true });
    expect(await readStoreFollowSummary(h.db as any, 19, 8))
      .toEqual({ count: null, isFollowing: false, available: false });
    expect((await request(h.app).put('/store-follows/19')).status).toBe(503);
    expect((await request(h.app).delete('/store-follows/19')).status).toBe(503);
  });
});
