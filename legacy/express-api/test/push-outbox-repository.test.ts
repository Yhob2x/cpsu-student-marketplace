import { describe, expect, it } from 'bun:test';
import { PrismaPushLeasePort, type PushOutboxDataSource } from '../src/push-outbox-repository.js';
import type { PushLease, PushCompletion } from '../src/push-outbox-worker.js';

const now = new Date('2026-11-19T06:00:00Z');
const dueJob = {
  id: 12, notificationId: 124, userId: 42, category: 'messages',
  attemptCount: 0, expiresAt: new Date(now.getTime() + 3_600_000),
};
const lease: PushLease = {
  ...dueJob, leaseToken: 'test-token-1234567890', leasedUntil: new Date(now.getTime() + 90_000),
};
function probe(resultCount = 1) {
  const queries: Array<{ operation: string; query: any }> = [];
  const db: PushOutboxDataSource = { pushOutbox: {
    findMany: async query => {
      queries.push({ operation: 'findMany', query });
      return [{ ...dueJob }];
    },
    updateMany: async query => {
      queries.push({ operation: 'updateMany', query });
      return { count: resultCount };
    },
  } };
  return { repo: new PrismaPushLeasePort(db), queries };
}

describe('Prisma-shaped push lease CAS repository (query-only, no DB)', () => {
  it('reads only due unexpired rows with a safe minimal select and bounded take', async () => {
    const { repo, queries } = probe();
    expect(await repo.listDue(now, 8)).toEqual([dueJob]);
    const { where, take, select, orderBy } = queries[0]!.query;
    expect(take).toBe(8);
    expect(where.expiresAt.gt).toEqual(now);
    expect(where.attemptCount.lt).toBe(5);
    expect(where.OR).toEqual([
      { state: 'pending', nextAttemptAt: { lte: now } },
      { state: 'leased', leasedUntil: { lte: now } },
    ]);
    expect(select).not.toHaveProperty('payload');
    expect(select).not.toHaveProperty('endpoint');
    expect(orderBy).toEqual([{ nextAttemptAt: 'asc' }, { id: 'asc' }]);
  });

  it('uses a single compare-and-set update to claim a due job', async () => {
    const { repo, queries } = probe();
    const until = new Date(now.getTime() + 90_000);
    expect(await repo.claimOne(12, 'test-token-1234567890', now, until)).toBe(true);
    const q = queries[0]!.query;
    expect(q.where).toMatchObject({
      id: 12, expiresAt: { gt: now }, attemptCount: { lt: 5 },
    });
    expect(q.data).toMatchObject({
      state: 'leased', leaseToken: 'test-token-1234567890',
      leasedUntil: until, attemptCount: { increment: 1 },
    });
  });

  it('losing a lease compare-and-set cannot impersonate the owner', async () => {
    const { repo } = probe(0);
    expect(await repo.claimOne(12, 'test-token-1234567890', now,
      new Date(now.getTime() + 90_000))).toBe(false);
  });

  it('acknowledges only the exact lease token while unexpired, and clears the token', async () => {
    const { repo, queries } = probe(1);
    // Lease needs to be future-relative for the real-world settle deadline check.
    const future = { ...lease, leasedUntil: new Date(Date.now() + 90_000) };
    const result: PushCompletion = { state: 'sent', status: 'accepted' };
    expect(await repo.settle(future, result)).toBe(true);
    const q = queries[0]!.query;
    expect(q.where).toMatchObject({
      id: 12, leaseToken: 'test-token-1234567890', state: 'leased',
    });
    expect(q.where.leasedUntil.gt).toBeInstanceOf(Date);
    expect(q.data).toMatchObject({
      state: 'sent', leaseToken: null, leasedUntil: null, lastStatus: 'accepted',
    });
    expect(q.data.sentAt).toBeInstanceOf(Date);
  });

  it('reschedules transient failures without marking sent', async () => {
    const { repo, queries } = probe();
    const nextAttemptAt = new Date(now.getTime() + 50_000);
    await repo.settle({ ...lease, leasedUntil: new Date(Date.now() + 90_000) }, {
      state: 'pending', status: '503', nextAttemptAt,
    });
    expect(queries[0]!.query.data).toMatchObject({
      state: 'pending', nextAttemptAt, leaseToken: null, leasedUntil: null,
    });
    expect(queries[0]!.query.data).not.toHaveProperty('sentAt');
  });

  it('a stale lease settlement update affects zero rows', async () => {
    const { repo } = probe(0);
    expect(await repo.settle(lease, { state: 'sent', status: 'accepted' })).toBe(false);
  });

  it('has bounded, explicit expiry and exhausted-attempt cleanup', async () => {
    const { repo, queries } = probe();
    expect(await repo.expireDue(now)).toBe(1);
    expect(await repo.expireExhausted(now)).toBe(1);
    expect(queries[0]!.query).toMatchObject({
      where: { expiresAt: { lte: now }, state: { in: ['pending', 'leased'] } },
      data: { state: 'skipped', lastStatus: 'expired' },
    });
    expect(queries[1]!.query).toMatchObject({
      where: { attemptCount: { gte: 5 }, expiresAt: { gt: now } },
      data: { state: 'failed', lastStatus: 'attempt_limit' },
    });
    expect(queries[1]!.query.where.OR).toEqual([
      { state: 'pending' },
      { state: 'leased', leasedUntil: { lte: now } },
    ]);
  });
});
