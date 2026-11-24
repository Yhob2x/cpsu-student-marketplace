import { describe, expect, test } from 'bun:test';
import { readPublishedStoreRatings } from '../src/store-rating-summaries';

describe('published store ratings for public listing cards', () => {
  test('queries only published reviews in one batch, rounds averages and keeps store IDs separate', async () => {
    let queries = 0;
    let query: any;
    const source = { storeReview: { groupBy: async (args: unknown) => {
      queries++;
      query = args;
      return [
        { sellerProfileId: 9, _avg: { rating: 4.25 }, _count: { _all: 4 } },
        { sellerProfileId: 10, _avg: { rating: 5 }, _count: { _all: 1 } },
      ];
    } } };
    const ratings = await readPublishedStoreRatings(source, [9, 9, 10, -1]);
    expect(queries).toBe(1);
    expect(query).toEqual({ by: ['sellerProfileId'], where: { sellerProfileId: { in: [9, 10] }, status: 'published' },
      _avg: { rating: true }, _count: { _all: true } });
    expect(ratings.get(9)).toEqual({ average: 4.3, count: 4 });
    expect(ratings.get(10)).toEqual({ average: 5, count: 1 });
  });

  test('never shows a rating for a store with zero published reviews', async () => {
    const source = { storeReview: { groupBy: async () => [
      { sellerProfileId: 2, _avg: { rating: null }, _count: { _all: 0 } },
    ] } };
    expect((await readPublishedStoreRatings(source, [2, 3])).size).toBe(0);
  });

  test('handles an unmigrated review table without invented ratings', async () => {
    const missing = { storeReview: { groupBy: async (): Promise<never> => { throw { code: 'P2021' }; } } };
    expect((await readPublishedStoreRatings(missing, [4])).size).toBe(0);
    expect((await readPublishedStoreRatings({}, [4])).size).toBe(0);
  });

  test('unexpected database errors are not silently swallowed', async () => {
    const broken = { storeReview: { groupBy: async (): Promise<never> => { throw new Error('connection failed'); } } };
    await expect(readPublishedStoreRatings(broken, [4])).rejects.toThrow('connection failed');
  });
});
