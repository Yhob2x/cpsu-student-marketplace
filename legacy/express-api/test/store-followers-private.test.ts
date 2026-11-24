import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/http.js';
import { makeStoreFollowRouter } from '../src/store-follows.js';

const owner = { id: 8, email: 'owner@example.invalid', displayName: 'Owner', roles: [] };
const otherStudent = { id: 9, email: 'other@example.invalid', displayName: 'Other', roles: [] };
const reviewer = { id: 10, email: 'reviewer@example.invalid', displayName: 'Reviewer',
  roles: [{ role: 'campus_reviewer', campusId: 1 }] };
const rows = Array.from({ length: 8 }, (_, i) => ({
  createdAt: new Date(Date.UTC(2026, 10, 18 - i)),
  user: { displayName: `Student ${i + 1}`, email: `student${i + 1}@example.invalid`,
    studentIdentity: { studentIdNumber: `PRIVATE-${i + 1}` } },
}));

function harness(options: {
  actor?: typeof owner | typeof reviewer | null; missingTable?: boolean; noStore?: boolean;
  missingDelegate?: boolean;
} = {}) {
  const lookups: unknown[] = [];
  const db = {
    sellerProfile: {
      findFirst: async (args: any) => {
        lookups.push(args.where);
        if (options.noStore || args.where.ownerUserId !== 8) return null;
        return { id: 21 };
      },
    },
    ...(options.missingDelegate ? {} : { storeFollow: {
      count: async (args: any) => {
        lookups.push(args.where);
        if (options.missingTable) throw Object.assign(new Error('Missing table'), { code: 'P2021' });
        return args.where.userId === 8 ? 3 : rows.length;
      },
      findMany: async (args: any) => {
        lookups.push(args);
        if (options.missingTable) throw Object.assign(new Error('Missing table'), { code: 'P2021' });
        if (args.where.userId === 8) return [
          { createdAt: new Date('2026-11-18T00:00:00.000Z'), store: { id: 31, storeName: 'Campus Crafts', campus: { name: 'Main Campus' } } },
          { createdAt: new Date('2026-11-17T00:00:00.000Z'), store: { id: 32, storeName: 'Study Finds', campus: { name: 'Cauayan Campus' } } },
        ].slice(args.skip, args.skip + args.take);
        return rows.slice(args.skip, args.skip + args.take);
      },
    } }),
  };
  const app = express();
  app.use((req, _res, next) => {
    const actor = options.actor === undefined ? owner : options.actor;
    if (actor) req.user = actor as any;
    next();
  });
  app.use('/store-follows', makeStoreFollowRouter(db as any));
  app.use(errorHandler);
  return { app, lookups };
}

describe('private store follower list, synthetic-only', () => {
  test('counts-only refresh skips private follower rows', async () => {
    const h = harness();
    const response = await request(h.app).get('/store-follows/mine?countsOnly=true');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ followerCount: 8, followingCount: 3 });
    expect(h.lookups).toHaveLength(3);
  });
  test('owner sees paginated display names and follow dates, never private student data', async () => {
    const h = harness();
    const first = await request(h.app).get('/store-follows/mine');
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('private, no-store');
    expect(first.body).toEqual({
      page: 1, pageSize: 6, total: 8, followingCount: 3,
      items: rows.slice(0, 6).map(row => ({
        displayName: row.user.displayName,
        followedAt: row.createdAt.toISOString(),
      })),
    });
    expect(JSON.stringify(first.body)).not.toContain('example.invalid');
    expect(JSON.stringify(first.body)).not.toContain('PRIVATE-');
    expect(JSON.stringify(first.body)).not.toContain('userId');
    expect((h.lookups[0] as any).ownerUserId).toBe(8);
    expect((h.lookups[3] as any).select).toEqual({
      createdAt: true, user: { select: { displayName: true } },
    });
    expect(h.lookups.some(x => (x as any).userId === 8 && !('sellerProfileId' in (x as any)))).toBe(true);
    const second = await request(h.app).get('/store-follows/mine?page=2');
    expect(second.status).toBe(200);
    expect(second.body.items.map((row: any) => row.displayName)).toEqual(['Student 7', 'Student 8']);
    expect((await request(h.app).get('/store-follows/mine?page=3')).body.items).toEqual([]);
  });
  test('signed-out, staff, and other student accounts cannot read an owner list', async () => {
    for (const actor of [null, reviewer, otherStudent]) {
      const h = harness({ actor });
      const result = await request(h.app).get('/store-follows/mine');
      expect(result.status).toBe(actor === null ? 401 : actor === reviewer ? 403 : 404);
      expect(h.lookups.some(x => 'sellerProfileId' in (x as any))).toBe(false);
    }
  });
  test('no owner store, unavailable model and missing table are distinguished', async () => {
    expect((await request(harness({ noStore: true }).app).get('/store-follows/mine')).status).toBe(404);
    expect((await request(harness({ missingDelegate: true }).app).get('/store-follows/mine')).status).toBe(503);
    expect((await request(harness({ missingTable: true }).app).get('/store-follows/mine')).status).toBe(503);
  });
  test('pagination input is bounded', async () => {
    for (const badPage of ['-1', '0', 'abc', '10001']) {
      expect((await request(harness().app).get('/store-follows/mine?page=' + badPage)).status).toBe(400);
    }
  });
  test('owner can page through stores they follow without private owner details', async () => {
    const h = harness();
    const result = await request(h.app).get('/store-follows/mine?view=following');
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(result.body).toEqual({
      total: 3, followerCount: 8, followingCount: 3, page: 1, pageSize: 6,
      items: [
        { storeId: 31, storeName: 'Campus Crafts', campusName: 'Main Campus', followedAt: '2026-11-18T00:00:00.000Z' },
        { storeId: 32, storeName: 'Study Finds', campusName: 'Cauayan Campus', followedAt: '2026-11-17T00:00:00.000Z' },
      ],
    });
    expect(JSON.stringify(result.body)).not.toContain('example.invalid');
    expect(JSON.stringify(result.body)).not.toContain('PRIVATE-');
    expect(h.lookups.some(x => (x as any).where?.userId === 8 && (x as any).select?.store &&
      (x as any).where.store.approvalStatus === 'approved')).toBe(true);
    expect((await request(h.app).get('/store-follows/mine?view=unknown')).status).toBe(400);
    expect((await request(harness({ actor: otherStudent }).app).get('/store-follows/mine?view=following')).status).toBe(404);
  });
});
