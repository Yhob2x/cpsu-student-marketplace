import { describe, expect, test } from 'bun:test';
import { inboxPageInput, inboxPageQuery, inboxPageResult } from '../src/inbox-pages.js';

describe('opt-in inbox pagination', () => {
  test('bounded stable ID query and cursor', () => {
    expect(inboxPageQuery(30)).toEqual({ orderBy: { id: 'desc' }, take: 31 });
    expect(inboxPageQuery(30, 95)).toEqual({ id: { lt: 95 }, orderBy: { id: 'desc' }, take: 31 });
  });
  test('uses lookahead only for hasMore and returns a stable cursor', () => {
    expect(inboxPageResult([{ id: 10 }, { id: 9 }, { id: 8 }], 2)).toEqual({
      items: [{ id: 10 }, { id: 9 }], hasMore: true, nextBeforeId: 9,
    });
    expect(inboxPageResult([{ id: 3 }], 2)).toEqual({
      items: [{ id: 3 }], hasMore: false, nextBeforeId: null,
    });
  });
  test('legacy is optional, invalid page sizes and cursors refused', () => {
    expect(inboxPageInput.parse({})).toEqual({});
    expect(inboxPageInput.parse({ limit: '30', beforeId: '9' })).toEqual({ limit: 30, beforeId: 9 });
    for (const input of [{ limit: '0' }, { limit: '51' }, { beforeId: '9' },
      { limit: '2', beforeId: '-1' }, { limit: '2', beforeId: '99999999999' },
      { limit: '4.5' }]) {
      expect(inboxPageInput.safeParse(input).success).toBe(false);
    }
  });
});
