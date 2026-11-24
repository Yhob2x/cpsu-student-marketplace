import { describe, expect, test } from 'bun:test';
import { readMostFollowedStores } from '../src/most-followed-stores.js';

const missingTable = Object.assign(new Error('StoreFollow table missing'), { code: 'P2021' });

describe('most followed stores (synthetic, no database writes)', () => {
  test('ranks by genuine follower counts, filtering inactive and unpublished stores', async () => {
    let query: any;
    const mock = {
      storeFollow: {},
      sellerProfile: { findMany: async (args: any) => {
        query = args;
        return [{ id: 7, storeName: 'Campus Arts', campus: { code: 'CPSU', name: 'Main Campus' },
          avatarPath: null, _count: { storeFollows: 3, listings: 2 } },
          { id: 9, storeName: 'Student Prints', campus: { code: 'CPSU', name: 'Main Campus' },
            avatarPath: null, _count: { storeFollows: 1, listings: 1 } }];
      } },
    };
    const result = await readMostFollowedStores(mock as any, true);
    expect(result).toEqual({ available: true, items: [
      { id: 7, storeName: 'Campus Arts', campus: { code: 'CPSU', name: 'Main Campus' },
        avatarUrl: null, followerCount: 3, listingCount: 2 },
      { id: 9, storeName: 'Student Prints', campus: { code: 'CPSU', name: 'Main Campus' },
        avatarUrl: null, followerCount: 1, listingCount: 1 },
    ] });
    expect(query.orderBy).toEqual([{ storeFollows: { _count: 'desc' } }, { id: 'asc' }]);
    expect(query.take).toBe(4);
    expect(query.where.approvalStatus).toBe('approved');
    expect(query.where.owner.status).toBe('active');
    expect(query.where.storeFollows).toEqual({ some: {} });
    expect(query.where.listings.some).toEqual({ status: 'published', availabilityState: 'available', deletedAt: null });
    expect(query.select._count.select.listings.where).toEqual(query.where.listings.some);
  });
  test('does not publish a misleading leaderboard without an active follow table/client', async () => {
    expect(await readMostFollowedStores({ sellerProfile: { findMany: () => { throw Error('Must not query'); } } } as any, false))
      .toEqual({ available: false, items: [] });
    expect(await readMostFollowedStores({ storeFollow: {}, sellerProfile: {
      findMany: async () => { throw missingTable; },
    } } as any, false)).toEqual({ available: false, items: [] });
  });
  test('unexpected data errors still surface', async () => {
    expect(readMostFollowedStores({ storeFollow: {}, sellerProfile: {
      findMany: async () => { throw new Error('Connection lost'); },
    } } as any, false)).rejects.toThrow('Connection lost');
  });
});
