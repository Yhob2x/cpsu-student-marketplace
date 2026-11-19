import { describe, expect, test } from 'bun:test';
import { MESSAGE_PAGE_SIZE, messagePageInput, messagePageQuery, pageFromNewestFirst } from '../src/message-pages.js';

describe('bounded opt-in message history', () => {
  test('limits each query and uses id cursor with stable newest-first DB order', () => {
    expect(MESSAGE_PAGE_SIZE).toBe(50);
    expect(messagePageQuery(18, 50)).toEqual({
      where: { threadId: 18 }, orderBy: { id: 'desc' }, take: 51,
      include: { author: { select: { displayName: true } } },
    });
    expect(messagePageQuery(18, 50, 129).where).toEqual({ threadId: 18, id: { lt: 129 } });
    expect(messagePageQuery(18, 50, 129).take).toBe(51);
  });
  test('returns chronological messages and identifies another older page', () => {
    expect(pageFromNewestFirst([{ id: 9 }, { id: 8 }, { id: 7 }], 2))
      .toEqual({ messages: [{ id: 8 }, { id: 9 }], hasEarlier: true });
    expect(pageFromNewestFirst([{ id: 3 }], 2))
      .toEqual({ messages: [{ id: 3 }], hasEarlier: false });
  });
  test('invalid page and cursor inputs are rejected', () => {
    expect(messagePageInput.parse({ limit: '50', beforeId: '14' })).toEqual({ limit: 50, beforeId: 14 });
    for (const q of [{ limit: '0' }, { limit: '101' }, { limit: '-1' },
      { limit: 'bad' }, { beforeId: '1' }, { limit: '50', beforeId: '-3' },
      { limit: '50', beforeId: '999999999999' }]) {
      expect(messagePageInput.safeParse(q).success).toBe(false);
    }
  });
});
