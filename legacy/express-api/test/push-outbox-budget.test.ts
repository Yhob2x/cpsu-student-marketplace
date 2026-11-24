import { describe, expect, it } from 'bun:test';
import { reserveRecipientBudget, type BudgetDataSource, type BudgetTransaction } from '../src/push-outbox-budget.js';
import { PUSH_DAILY_CAP } from '../src/push-delivery-controls.js';
import type { PushLease } from '../src/push-outbox-worker.js';

const now = new Date('2026-11-19T15:59:00Z');
const newLease = (id: number, userId = 1): PushLease => ({
  id, notificationId: 100 + id, userId, category: 'messages', attemptCount: 0,
  expiresAt: new Date(now.getTime() + 3_600_000),
  leaseToken: 'valid-test-token-123', leasedUntil: new Date(now.getTime() + 90_000),
});

/**
 * A transactional in-memory simulation. It serializes operations and commits a
 * clone only on success, including rollback if the notification CAS loses.
 * The real MariaDB serializable/deadlock behavior still needs isolated QA.
 */
class FakeBudget implements BudgetDataSource {
  budgets = new Map<string, number>();
  markers = new Map<number, Date | null>();
  enrolled = new Map<number, PushLease>();
  failMarkerFor: number | null = null;
  transactions = 0;
  private gate: Promise<void> = Promise.resolve();

  add(lease: PushLease) { this.enrolled.set(lease.id, lease); this.markers.set(lease.id, null); }

  async $transaction<T>(
    action: (tx: BudgetTransaction) => Promise<T>,
    options: { isolationLevel: 'Serializable'; timeout: number },
  ): Promise<T> {
    expect(options.isolationLevel).toBe('Serializable');
    const previous = this.gate;
    let release!: () => void;
    this.gate = new Promise<void>(resolve => { release = resolve; });
    await previous;
    this.transactions++;
    const counts = new Map(this.budgets);
    const markers = new Map(this.markers);
    const tx: BudgetTransaction = {
      pushOutbox: {
        findFirst: async (args: object) => {
          const q = args as { where: { id: number; userId: number; state: string;
            leaseToken: string; leasedUntil: { gt: Date }; expiresAt: { gt: Date } } };
          const row = this.enrolled.get(q.where.id);
          if (!row || row.userId !== q.where.userId || q.where.state !== 'leased'
            || row.leaseToken !== q.where.leaseToken
            || row.leasedUntil <= q.where.leasedUntil.gt || row.expiresAt <= q.where.expiresAt.gt) return null;
          return { userId: row.userId, budgetReservedAt: markers.get(row.id) ?? null };
        },
        updateMany: async (args: object) => {
          const q = args as { where: { id: number; userId: number; budgetReservedAt: null;
            leaseToken: string }, data: { budgetReservedAt: Date } };
          if (this.failMarkerFor === q.where.id || !this.enrolled.has(q.where.id)
            || markers.get(q.where.id) !== null
            || this.enrolled.get(q.where.id)?.leaseToken !== q.where.leaseToken) return { count: 0 };
          markers.set(q.where.id, q.data.budgetReservedAt);
          return { count: 1 };
        },
      },
      pushDailyBudget: {
        upsert: async (args: object) => {
          const q = args as { where: { userId_dayKey: { userId: number; dayKey: string } } };
          const key = `${q.where.userId_dayKey.userId}/${q.where.userId_dayKey.dayKey}`;
          if (!counts.has(key)) counts.set(key, 0);
        },
        updateMany: async (args: object) => {
          const q = args as { where: { userId: number; dayKey: string; count: { lt: number } } };
          expect(q.where.count.lt).toBe(PUSH_DAILY_CAP);
          const key = `${q.where.userId}/${q.where.dayKey}`;
          const previousCount = counts.get(key) ?? 0;
          if (previousCount >= q.where.count.lt) return { count: 0 };
          counts.set(key, previousCount + 1);
          return { count: 1 };
        },
      },
    };
    try {
      const result = await action(tx);
      this.budgets = counts;
      this.markers = markers;
      return result;
    } finally {
      release();
    }
  }
}

describe('outbox recipient-wide DB reservation transaction (synthetic DB, no provider)', () => {
  it('reserves a single recipient/day unit before fan-out to any devices', async () => {
    const db = new FakeBudget();
    db.add(newLease(1));
    expect(await reserveRecipientBudget(db, newLease(1), now)).toBe('reserved');
    expect(db.budgets.get('1/2026-11-19')).toBe(1);
    expect(db.markers.get(1)).toEqual(now);
    expect(db.transactions).toBe(1);
  });

  it('reclaim/retry of a previously reserved job cannot charge twice', async () => {
    const db = new FakeBudget();
    db.add(newLease(1));
    expect(await reserveRecipientBudget(db, newLease(1), now)).toBe('reserved');
    expect(await reserveRecipientBudget(db, newLease(1), new Date(now.getTime() + 1000)))
      .toBe('already_reserved');
    expect(db.budgets.get('1/2026-11-19')).toBe(1);
  });

  it('never reuses yesterday\'s reserved quota for a retry after Manila midnight', async () => {
    const db = new FakeBudget();
    const lease = newLease(1);
    db.add(lease);
    expect(await reserveRecipientBudget(db, lease, now)).toBe('reserved');
    const midnight = new Date('2026-11-19T16:00:00Z');
    // The old lease is still valid for another 30 seconds at local midnight.
    expect(lease.leasedUntil > midnight).toBe(true);
    expect(await reserveRecipientBudget(db, lease, midnight)).toBe('stale_day');
    expect(db.budgets.get('1/2026-11-19')).toBe(1);
    expect(db.budgets.has('1/2026-11-20')).toBe(false);
  });

  it('prevents the sixth notice for one account, even if there are eight devices', async () => {
    const db = new FakeBudget();
    for (let id = 1; id <= 8; id++) db.add(newLease(id));
    const decisions = await Promise.all(
      Array.from({ length: 8 }, (_, i) => reserveRecipientBudget(db, newLease(i + 1), now)),
    );
    expect(decisions.filter(x => x === 'reserved')).toHaveLength(5);
    expect(decisions.filter(x => x === 'capped')).toHaveLength(3);
    expect(db.budgets.get('1/2026-11-19')).toBe(5);
    expect([...db.markers.values()].filter(Boolean)).toHaveLength(5);
  });

  it('keeps each account quota independent and rolls the day at midnight Manila', async () => {
    const db = new FakeBudget();
    db.add(newLease(1, 1)); db.add(newLease(2, 2));
    expect(await reserveRecipientBudget(db, newLease(1, 1), now)).toBe('reserved');
    expect(await reserveRecipientBudget(db, newLease(2, 2), now)).toBe('reserved');
    expect(db.budgets.get('1/2026-11-19')).toBe(1);
    expect(db.budgets.get('2/2026-11-19')).toBe(1);
    const after = new Date('2026-11-19T16:00:00Z');
    const lease = { ...newLease(3, 1), leasedUntil: new Date(after.getTime() + 90_000) };
    db.add(lease);
    expect(await reserveRecipientBudget(db, lease, after)).toBe('reserved');
    expect(db.budgets.get('1/2026-11-20')).toBe(1);
  });

  it('does not reserve a unit when a stale lease token is rejected', async () => {
    const db = new FakeBudget(); db.add(newLease(1));
    const stale = { ...newLease(1), leaseToken: 'superseded-lease-123' };
    expect(await reserveRecipientBudget(db, stale, now)).toBe('lost_lease');
    expect(db.budgets.size).toBe(0);
  });

  it('rolls back the counter when the job marker compare-and-set loses', async () => {
    const db = new FakeBudget(); db.add(newLease(1)); db.failMarkerFor = 1;
    expect(await reserveRecipientBudget(db, newLease(1), now)).toBe('lost_lease');
    expect(db.budgets.size).toBe(0);
    expect(db.markers.get(1)).toBeNull();
  });

  it('propagates invalid timestamps rather than reserving based on the wrong day', async () => {
    const db = new FakeBudget(); db.add(newLease(1));
    await expect(reserveRecipientBudget(db, newLease(1), new Date(NaN))).rejects.toThrow();
    expect(db.transactions).toBe(0);
  });
});
