import { expect, mock, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { prisma } from '../src/db.js';
import { errorHandler, HttpError } from '../src/http.js';
import { createReadCache, publicCategoriesCache } from '../src/public-read-cache.js';
import { catalogAdminRoutes } from '../src/routes/catalog-admin.js';
import publicRoutes from '../src/routes/public.js';

test('shares an in-flight read and reuses its result until the TTL elapses', async () => {
  let now = 0;
  let loads = 0;
  const firstResult = Promise.withResolvers<number>();
  const cache = createReadCache(() => ++loads === 1 ? firstResult.promise : Promise.resolve(loads), 30, () => now);

  const first = cache.read();
  const concurrent = cache.read();
  expect(concurrent).toBe(first);
  now = 50;
  firstResult.resolve(1);
  expect(await concurrent).toBe(1);
  now = 79;
  expect(await cache.read()).toBe(1);
  now = 80;
  expect(await cache.read()).toBe(2);
});

test('retries after a failed load', async () => {
  let loads = 0;
  const cache = createReadCache(async () => {
    if (++loads === 1) throw new Error('database unavailable');
    return [];
  }, 30);

  await expect(cache.read()).rejects.toThrow('database unavailable');
  expect(await cache.read()).toEqual([]);
  expect(await cache.read()).toEqual([]);
  expect(loads).toBe(2);
});

test('an invalidated read cannot repopulate the cache after a newer read', async () => {
  const oldResult = Promise.withResolvers<string>();
  let loads = 0;
  const cache = createReadCache(() => ++loads === 1 ? oldResult.promise : Promise.resolve('updated'), 30_000);

  const beforeWrite = cache.read();
  cache.invalidate();
  expect(await cache.read()).toBe('updated');
  oldResult.resolve('old');
  expect(await beforeWrite).toBe('old');
  expect(await cache.read()).toBe('updated');
  expect(loads).toBe(2);
});

test('category requests reuse a query and refresh after a catalog write', async () => {
  const original = { id: 1, parentId: null, name: 'Tutoring', listingType: 'service' as const };
  const updated = { ...original, name: 'Language tutoring' };
  const read = mock(async () => [updated]).mockResolvedValueOnce([original]);
  const write = mock(async () => updated).mockRejectedValueOnce(new HttpError(409, 'catalog_duplicate'));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 5, displayName: 'Staff', email: 'staff@test.local', roles: [{ role: 'university_admin', campusId: null }] };
    next();
  });
  app.use('/api/v1', publicRoutes);
  app.use('/api/v1/admin/catalog', catalogAdminRoutes);
  app.use(errorHandler);
  const api = request(app);

  // Prisma model methods are generated on access, so replace the proxy property directly.
  const category = prisma.category;
  const transaction = prisma.$transaction;
  Object.defineProperty(prisma, 'category', { configurable: true, value: { findMany: read } });
  Object.defineProperty(prisma, '$transaction', { configurable: true, value: write });
  publicCategoriesCache.invalidate();
  try {
    await api.get('/api/v1/categories').expect(200, [original]);
    await api.get('/api/v1/categories').expect(200, [original]);
    await api.patch('/api/v1/admin/catalog/services/1').send({ name: updated.name }).expect(409);
    await api.get('/api/v1/categories').expect(200, [original]);
    expect(read).toHaveBeenCalledTimes(1);
    await api.patch('/api/v1/admin/catalog/services/1').send({ name: updated.name }).expect(200, updated);
    await api.get('/api/v1/categories').expect(200, [updated]);
    expect(read).toHaveBeenCalledTimes(2);
  } finally {
    publicCategoriesCache.invalidate();
    Object.defineProperty(prisma, 'category', { configurable: true, value: category });
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: transaction });
  }
});
