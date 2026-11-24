import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/http.js';
import { makePublicStoreConnectionsRouter } from '../src/store-follows.js';

function harness(options: { hidden?: boolean; missingFollow?: boolean } = {}) {
  const queries: any[] = [];
  const db = {
    sellerProfile: { findFirst: async (query: any) => {
      queries.push(query);
      return options.hidden ? null : { id: 7, ownerUserId: 12 };
    } },
    ...(options.missingFollow ? {} : { storeFollow: {
      count: async (query: any) => { queries.push(query); return 'sellerProfileId' in query.where ? 1 : 2; },
      findMany: async (query: any) => {
        queries.push(query);
        return 'sellerProfileId' in query.where
          ? [{ createdAt: new Date('2026-11-18T08:00:00Z'), user: { displayName: 'Campus Buyer' } }]
          : [{ createdAt: new Date('2026-11-17T08:00:00Z'),
            store: { id: 3, storeName: 'Campus Crafts', campus: { name: 'Main Campus' } } }];
      },
    } }),
  };
  const app = express();
  app.use(makePublicStoreConnectionsRouter(db as any));
  app.use(errorHandler);
  return { app, queries };
}

describe('public store connections', () => {
  test('counts-only refresh never queries follower names', async () => {
    const h = harness();
    const response = await request(h.app).get('/seller-profiles/7/connections?countsOnly=true');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ followerCount: 1, followingCount: 2 });
    expect(h.queries).toHaveLength(3);
  });
  test('guest can see paged display names and followed public stores, without private fields', async () => {
    const h = harness();
    const followers = await request(h.app).get('/seller-profiles/7/connections');
    expect(followers.status).toBe(200);
    expect(followers.body).toEqual({ total: 1, followerCount: 1, followingCount: 2,
      page: 1, pageSize: 6, items: [{ displayName: 'Campus Buyer', followedAt: '2026-11-18T08:00:00.000Z' }] });
    expect(followers.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(followers.body)).not.toContain('ownerUserId');
    expect(JSON.stringify(followers.body)).not.toContain('email');
    expect(h.queries[0].where).toEqual(expect.objectContaining({ id: 7, approvalStatus: 'approved', sellerType: 'student',
      owner: expect.objectContaining({ status: 'active', affiliations: { some: expect.objectContaining({ verificationStatus: 'verified' }) } }) }));
    expect(h.queries[3].where).toEqual({ sellerProfileId: 7, user: { status: 'active' } });
    expect(h.queries[3].select).toEqual({ createdAt: true, user: { select: { displayName: true } } });
    const following = await request(h.app).get('/seller-profiles/7/connections?view=following');
    expect(following.status).toBe(200);
    expect(following.body.items).toEqual([{ storeId: 3, storeName: 'Campus Crafts',
      campusName: 'Main Campus', followedAt: '2026-11-17T08:00:00.000Z' }]);
    expect(h.queries[7].where).toEqual({ userId: 12,
      store: expect.objectContaining({ approvalStatus: 'approved', sellerType: 'student' }) });
  });

  test('hidden stores, invalid queries and unavailable follows cannot expose data', async () => {
    expect((await request(harness({ hidden: true }).app).get('/seller-profiles/7/connections')).status).toBe(404);
    expect((await request(harness({ missingFollow: true }).app).get('/seller-profiles/7/connections')).status).toBe(503);
    for (const path of ['/seller-profiles/0/connections', '/seller-profiles/7/connections?page=0',
      '/seller-profiles/7/connections?view=private']) {
      expect((await request(harness().app).get(path)).status).toBe(400);
    }
  });
});
