/**
 * Stage 6B budget transaction (inactive until isolated MariaDB acceptance).
 * Reserve exactly once PER NOTICE, not once per device. The parent transaction
 * must use Serializable isolation to retry/fail safely on contention.
 */
import { PUSH_DAILY_CAP, manilaDayAndMinute } from './push-delivery-controls.js';
import type { PushLease } from './push-outbox-worker.js';

type Count = { count: number };
type ReservedRow = { userId: number; budgetReservedAt: Date | null };
export interface BudgetTransaction {
  pushOutbox: {
    findFirst: (args: object) => Promise<ReservedRow | null>;
    updateMany: (args: object) => Promise<Count>;
  };
  pushDailyBudget: {
    upsert: (args: object) => Promise<unknown>;
    updateMany: (args: object) => Promise<Count>;
  };
}
export interface BudgetDataSource {
  $transaction<T>(
    action: (tx: BudgetTransaction) => Promise<T>,
    options: { isolationLevel: 'Serializable'; timeout: number },
  ): Promise<T>;
}
export type BudgetReservation = 'reserved' | 'already_reserved' | 'capped' | 'lost_lease' | 'stale_day';
const LOST = Symbol('push_lost_lease');

/**
 * The lease fence, account-day counter increment, and one-time job marker
 * participate in one DB transaction. If the marker CAS loses, throw a sentinel
 * and roll back the counter; never charge twice for the same notification.
 */
export async function reserveRecipientBudget(
  db: BudgetDataSource, lease: PushLease, now: Date,
): Promise<BudgetReservation> {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid budget timestamp');
  const { dayKey } = manilaDayAndMinute(now);
  try {
    return await db.$transaction(async tx => {
      const row = await tx.pushOutbox.findFirst({
        where: {
          id: lease.id, userId: lease.userId, state: 'leased',
          leaseToken: lease.leaseToken,
          leasedUntil: { gt: now }, expiresAt: { gt: now },
        },
        select: { userId: true, budgetReservedAt: true },
      });
      if (!row) return 'lost_lease';
      if (row.budgetReservedAt) {
        // A previously reserved alert can be retried later. Never spend a
        // previous Manila day's quota on the new day after midnight, because
        // that could bypass the recipient's current-day delivery cap.
        const reservedDay = manilaDayAndMinute(row.budgetReservedAt).dayKey;
        return reservedDay === dayKey ? 'already_reserved' : 'stale_day';
      }
      await tx.pushDailyBudget.upsert({
        where: { userId_dayKey: { userId: row.userId, dayKey } },
        create: { userId: row.userId, dayKey, count: 0 },
        update: {},
      });
      const reserved = await tx.pushDailyBudget.updateMany({
        where: { userId: row.userId, dayKey, count: { lt: PUSH_DAILY_CAP } },
        data: { count: { increment: 1 } },
      });
      if (reserved.count !== 1) return 'capped';
      const marked = await tx.pushOutbox.updateMany({
        where: {
          id: lease.id, userId: lease.userId, state: 'leased',
          leaseToken: lease.leaseToken,
          leasedUntil: { gt: now }, expiresAt: { gt: now },
          budgetReservedAt: null,
        },
        data: { budgetReservedAt: now },
      });
      if (marked.count !== 1) throw LOST;
      return 'reserved';
    }, { isolationLevel: 'Serializable', timeout: 10_000 });
  } catch (error) {
    if (error === LOST) return 'lost_lease';
    // A serializable DB conflict/deadlock is a retryable worker error, not an
    // indication that budget was granted. Never send until this returns allowed.
    throw error;
  }
}
