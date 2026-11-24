import { describe, expect, test } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { errorHandler } from '../src/http.js';
import { makeListingViewsRouter, missingViewStorage, viewVisitorHash } from '../src/listing-views.js';

function sqlParts(...args: any[]) {
  const [raw, ...values] = args;
  const sql = Array.isArray(raw) ? raw.join('?') : raw.sql;
  const input = Array.isArray(raw) ? values : raw.values;
  return { sql, values: input.flatMap((value: any) =>
    value && typeof value === 'object' && Array.isArray(value.values) ? value.values : [value]) };
}

function fixture(missing = false) {
  const dedup = new Set<string>();
  const totals = new Map<number, bigint>();
  const visible = [1, 2];
  const unavailable = Object.assign(new Error('No table'), {
    code: 'P2010', meta: { code: '1146', message: "Table 'test.ListingViewCounter' doesn't exist" },
  });
  const db: any = {
    listing: {
      findMany: async ({ where }: any) => visible.filter(id => where.id.in.includes(id)).map(id => ({ id })),
      findFirst: async ({ where }: any) => visible.includes(where.id) ? { seller: { ownerUserId: 20 } } : null,
    },
    $transaction: async (fn: any) => {
      if (missing) throw unavailable;
      return fn({
        $executeRaw: async (...args: any[]) => {
          const q = sqlParts(...args);
          if (q.sql.includes('INSERT IGNORE')) {
            const [id, digest] = q.values;
            const key = id + ':' + digest;
            if (dedup.has(key)) return 0;
            dedup.add(key);
            return 1;
          }
          if (q.sql.includes('INSERT INTO ListingViewCounter')) {
            const id = Number(q.values[0]);
            totals.set(id, (totals.get(id) ?? 0n) + 1n);
            return 1;
          }
          throw Error('Unexpected SQL');
        },
        $queryRaw: async (...args: any[]) => [{ viewCount: totals.get(Number(sqlParts(...args).values[0])) ?? 0n }],
      });
    },
    $queryRaw: async (...args: any[]) => {
      if (missing) throw unavailable;
      const q = sqlParts(...args);
      return [...totals].filter(([id]) => q.values.includes(id))
        .map(([listingId, viewCount]) => ({ listingId, viewCount }));
    },
    $executeRaw: async (_q: any) => 0, // opportunistic TTL cleanup
  };
  const app = express();
  app.use(cookieParser());
  app.use((req, _res, next) => {
    const actor = req.get('x-test-actor');
    if (actor) (req as any).user = { id: actor === 'owner' ? 20 : 30,
      roles: actor === 'staff' ? [{ role: 'campus_reviewer' }] : [] };
    next();
  });
  app.use('/api/v1', makeListingViewsRouter(db));
  app.use(errorHandler);
  return { app, dedup, totals };
}

describe('per-listing views (synthetic DB, no real writes)', () => {
  test('once per browser per day on each listing; another browser counts separately', async () => {
    const h = fixture();
    const browser = request.agent(h.app);
    const first = await browser.post('/api/v1/listings/1/view');
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ available: true, count: 1, recorded: true });
    expect(first.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect((await browser.post('/api/v1/listings/1/view')).body).toMatchObject({ count: 1, recorded: false });
    expect((await browser.post('/api/v1/listings/2/view')).body).toMatchObject({ count: 1, recorded: true });
    expect((await request(h.app).post('/api/v1/listings/1/view')).body).toMatchObject({ count: 2, recorded: true });
    expect(h.dedup.size).toBe(3);
    const counts = await browser.get('/api/v1/listing-views?ids=1,2,999');
    expect(counts.body.views).toMatchObject({
      1: { available: true, count: 2 }, 2: { available: true, count: 1 },
    });
    expect(counts.body.views['999']).toBeUndefined();
    expect(JSON.stringify(counts.body)).not.toContain('viewerHash');
  });

  test('owners and staff never inflate counters; hidden listings and cross-site POST blocked', async () => {
    const h = fixture();
    expect((await request(h.app).post('/api/v1/listings/1/view').set('x-test-actor', 'owner')).body.recorded).toBe(false);
    expect((await request(h.app).post('/api/v1/listings/1/view').set('x-test-actor', 'staff')).body.recorded).toBe(false);
    expect((await request(h.app).post('/api/v1/listings/999/view')).status).toBe(404);
    expect((await request(h.app).post('/api/v1/listings/1/view').set('Sec-Fetch-Site', 'cross-site')).status).toBe(403);
    expect((await request(h.app).get('/api/v1/listing-views?ids=999')).body.views).toEqual({});
    expect(h.dedup.size).toBe(0);
    expect((await request(h.app).get('/api/v1/listing-views?ids=abc')).status).toBe(400);
  });

  test('unmigrated database shows unavailable, never fake zeros or visitor cookies', async () => {
    const h = fixture(true);
    const counts = await request(h.app).get('/api/v1/listing-views?ids=1');
    expect(counts.body.views['1']).toEqual({ available: false, count: null });
    const result = await request(h.app).post('/api/v1/listings/1/view');
    expect(result.body).toEqual({ available: false, count: null, recorded: false });
    expect(result.headers['set-cookie']).toBeUndefined();
    expect(h.dedup.size).toBe(0);
  });

  test('hashed daily keys are per listing/day and do not expose browser token', () => {
    const a = viewVisitorHash('browser-token', 1, new Date('2026-11-23T08:00:00Z'), 'test-secret');
    expect(a).toHaveLength(64);
    expect(a).toBe(viewVisitorHash('browser-token', 1, new Date('2026-11-23T17:00:00Z'), 'test-secret'));
    expect(a).not.toBe(viewVisitorHash('browser-token', 2, new Date('2026-11-23T08:00:00Z'), 'test-secret'));
    expect(a).not.toBe(viewVisitorHash('browser-token', 1, new Date('2026-11-24T01:00:00Z'), 'test-secret'));
    expect(a).not.toContain('browser-token');
  });

  test('unexpected database failures remain errors', () => {
    expect(missingViewStorage({ code: 'P2010', meta: { code: '1146', message: 'No table test.Other' } })).toBe(false);
  });
});
