import { describe, expect, it } from 'bun:test';
import { insertPushOutbox, pushOutboxWritesActivated, stagePushOutbox, OUTBOX_TTL_MS,
  type OutboxInsert } from '../src/push-outbox.js';
import { durableOutboxWorkerActivated, pushDeliveryReady } from '../src/push.js';

describe('transaction-scoped outbox producer, staged no provider traffic', () => {
  it('leaves both producer and outbound worker hard-disabled until separately activated', async () => {
    expect(pushOutboxWritesActivated).toBe(false);
    expect(durableOutboxWorkerActivated).toBe(false);
    expect(pushDeliveryReady).toBe(false);
    let writes = 0;
    await stagePushOutbox({ pushOutbox: { create: async () => { writes++; } } },
      { id: 7, userId: 3, type: 'inquiry.new' });
    expect(writes).toBe(0);
  });

  it('constructs an idempotency-keyed row from an existing in-app notice ID without payload', async () => {
    const saved: OutboxInsert[] = [];
    const now = new Date('2026-11-19T06:30:00Z');
    const recorded = await insertPushOutbox({
      pushOutbox: { create: async ({ data }) => { saved.push(data); } },
    }, { id: 999, userId: 5, type: 'inquiry.reply' }, now);
    expect(recorded).toBe(true);
    expect(saved).toEqual([{
      notificationId: 999, userId: 5, category: 'messages',
      expiresAt: new Date(now.getTime() + OUTBOX_TTL_MS),
    }]);
    expect(JSON.stringify(saved)).not.toMatch(/messageBody|email|senderName|endpoint|p256dh|secret/i);
  });

  it('recognizes all three opt-in categories and does not queue unsupported types', async () => {
    const categories: string[] = [];
    const writer = { pushOutbox: { create: async ({ data }: { data: OutboxInsert }) => {
      categories.push(data.category);
    } } };
    for (const type of ['inquiry.new', 'listing.decision', 'transaction.requested', 'store.new_listing'])
      await insertPushOutbox(writer, { id: 1, userId: 2, type });
    expect(categories).toEqual(['messages', 'listingReviews', 'accountUpdates', 'accountUpdates']);
    expect(await insertPushOutbox(writer, { id: 2, userId: 2, type: 'unknown.type' })).toBe(false);
    expect(categories).toHaveLength(4);
  });

  it('propagates insert errors for caller transaction rollback; never silently skips a failed queue insert', async () => {
    await expect(insertPushOutbox({
      pushOutbox: { create: async () => { throw new Error('synthetic duplicate notification ID'); } },
    }, { id: 33, userId: 11, type: 'listing.decision' })).rejects.toThrow('duplicate');
  });

  it('refuses invalid notice identifiers before any database call', async () => {
    let calls = 0;
    const writer = { pushOutbox: { create: async () => { calls++; } } };
    for (const item of [
      { id: 0, userId: 1, type: 'inquiry.new' },
      { id: 1.3, userId: 1, type: 'inquiry.new' },
      { id: 1, userId: 0, type: 'inquiry.new' },
    ]) await expect(insertPushOutbox(writer, item)).rejects.toThrow('Invalid');
    expect(calls).toBe(0);
  });
});
