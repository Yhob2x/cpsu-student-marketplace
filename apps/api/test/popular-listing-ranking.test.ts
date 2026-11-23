import { expect, test } from 'bun:test';
import { popularListingIdsQuery, popularListingScore, readPopularListingIds } from '../src/popular-listing-ranking.js';

test('real appreciations dominate logarithmic views with 30-day age decay', () => {
  expect(popularListingScore(1, 0, 0)).toBe(4);
  expect(popularListingScore(0, 1, 0)).toBe(1);
  expect(popularListingScore(0, 15, 0)).toBe(4);
  expect(popularListingScore(2, 0, 720)).toBe(4);
  expect(popularListingScore(0, 0, 0)).toBe(0);
  expect(popularListingScore(1, 0, -10)).toBe(4);
});

test('global ranking includes only per-listing likes and views, never saves or store totals', () => {
  const sql = popularListingIdsQuery(true).sql;
  expect(sql).toContain('FROM ListingAppreciation');
  expect(sql).toContain('ListingViewCounter AS views');
  expect(sql).not.toContain('SavedListing');
  expect(sql).toContain('GROUP BY listingId');
  expect(sql).toContain('4 * COALESCE(likes.total, 0)');
  expect(sql).toContain('LOG2(1 + COALESCE(views.viewCount, 0))');
  expect(sql).toContain('TIMESTAMPDIFF(HOUR, l.createdAt');
  expect(sql.indexOf('ORDER BY')).toBeLessThan(sql.indexOf('LIMIT 8'));
  expect(sql).toContain("l.status = 'published'");
  expect(sql).toContain("l.availabilityState = 'available'");
  expect(sql).toContain('l.deletedAt IS NULL');
  expect(sql).toContain("s.sellerType = 'student'");
  expect(sql).toContain("s.approvalStatus = 'approved'");
  expect(sql).toContain("owner.status = 'active'");
  expect(sql).toContain('NOT EXISTS');
  expect(sql).toContain('FROM UserRole');
  expect(sql).toContain('FROM Affiliation');
  expect(sql).toContain('affiliation.expirationAt > UTC_TIMESTAMP()');
  expect(sql).toContain('campus.active = 1');
  expect(sql).toContain('l.createdAt DESC, l.id DESC');
});

test('absent view migration falls back to real per-listing appreciations only', async () => {
  const calls: string[] = [];
  const db = { $queryRaw: async (query: { sql: string }) => {
    calls.push(query.sql);
    if (calls.length === 1) throw Object.assign(new Error('Missing view counter'), {
      code: 'P2010',
      meta: { code: '1146', message: "Table 'cpsu_marketplace.ListingViewCounter' doesn't exist" },
    });
    return [{ id: 4 }, { id: 2 }];
  } };
  expect(await readPopularListingIds(db as any)).toEqual({
    ranking: 'appreciations_only', ids: [4, 2],
  });
  expect(calls).toHaveLength(2);
  expect(calls[0]).toContain('ListingViewCounter');
  expect(calls[1]).not.toContain('ListingViewCounter');
  expect(calls[1]).toContain('ListingAppreciation');
  expect(calls[1]).not.toContain('SavedListing');
});

test('missing appreciation migration does not fabricate a popular leaderboard', async () => {
  const db = { $queryRaw: async () => { throw Object.assign(new Error('Missing table'), {
    code: 'P2010',
    meta: { code: '1146', message: "Table 'cpsu_marketplace.ListingAppreciation' doesn't exist" },
  }); } };
  expect(await readPopularListingIds(db as any)).toEqual({
    ranking: 'unavailable', ids: [],
  });
});

test('unexpected SQL failures propagate and success identifies both engagement signals', async () => {
  expect(await readPopularListingIds({ $queryRaw: async () => [{ id: 7 }] } as any))
    .toEqual({ ranking: 'appreciations_and_views', ids: [7] });
  await expect(readPopularListingIds({ $queryRaw: async () => {
    throw new Error('Connection lost');
  } } as any)).rejects.toThrow('Connection lost');
  const otherTable = Object.assign(new Error('Unrelated missing table'), {
    code: 'P2010', meta: { code: '1146', message: "Table 'cpsu_marketplace.Other' doesn't exist" },
  });
  await expect(readPopularListingIds({ $queryRaw: async () => {
    throw otherTable;
  } } as any)).rejects.toBe(otherTable);
});
