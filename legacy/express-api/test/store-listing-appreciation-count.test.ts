import { describe, expect, test } from 'bun:test';
import { readStoreListingAppreciationCount } from '../src/store-listing-appreciation-count.js';

describe('store header appreciation aggregate', () => {
  test('counts appreciation rows across all published, nondeleted listings, not a store-wide like', async () => {
    let where: any;
    const db: any = { listingAppreciation: { count: async (arg: any) => {
      where = arg.where;
      return 37;
    } } };
    const count = await readStoreListingAppreciationCount(db, 30);
    expect(count).toBe(37);
    expect(where).toEqual({ listing: { sellerProfileId: 30, status: 'published', deletedAt: null } });
    expect(JSON.stringify(where)).not.toContain('availabilityState');
  });
  test('reports genuine zero when there are no published listing appreciations', async () => {
    const db: any = { listingAppreciation: { count: async () => 0 } };
    expect(await readStoreListingAppreciationCount(db, 30)).toBe(0);
  });
  test('unavailable table/client is unknown, not a fabricated zero', async () => {
    expect(await readStoreListingAppreciationCount({} as any, 30)).toBeNull();
    const db: any = { listingAppreciation: { count: async () => { throw { code: 'P2021' }; } } };
    expect(await readStoreListingAppreciationCount(db, 30)).toBeNull();
  });
  test('unexpected database errors must not silently hide', async () => {
    const db: any = { listingAppreciation: { count: async () => { throw new Error('db unavailable'); } } };
    await expect(readStoreListingAppreciationCount(db, 30)).rejects.toThrow('db unavailable');
  });
});
